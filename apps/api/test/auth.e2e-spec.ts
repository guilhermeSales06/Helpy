import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  cookiePair,
  createTestApp,
  createUser,
  login,
  PASSWORD,
  refreshCookie,
  resetDatabase,
} from './helpers.js';

const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/auth/me';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const refresh = (cookie: string) =>
    http().post(REFRESH).set('Cookie', cookie);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('login', () => {
    it('returns the access token and user, and sets a protected cookie', async () => {
      const user = await createUser(prisma, Role.CLIENT);

      const { response, accessToken } = await login(app, user.email);

      expect(accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toBeUndefined();
      expect(response.body.user).toMatchObject({
        id: user.id,
        email: user.email,
        role: Role.CLIENT,
      });
      expect(response.body.user.passwordHash).toBeUndefined();

      const cookie = refreshCookie(response);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure');
    });

    it('marks the cookie for cross-site use in production', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      vi.stubEnv('NODE_ENV', 'production');

      const { response } = await login(app, user.email);

      const cookie = refreshCookie(response);
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=None');
    });

    it('stores only a hash of the refresh token', async () => {
      const user = await createUser(prisma, Role.CLIENT);

      const { cookie } = await login(app, user.email);

      const token = cookie.split('=')[1];
      const [stored] = await prisma.refreshToken.findMany();
      expect(stored.tokenHash).not.toBe(token);
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('ignores email case and surrounding spaces', async () => {
      const user = await createUser(prisma, Role.CLIENT);

      await http()
        .post(LOGIN)
        .send({ email: `  ${user.email.toUpperCase()} `, password: PASSWORD })
        .expect(200);
    });

    it('gives the same answer for a wrong password, an unknown email and an inactive user', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const inactive = await createUser(prisma, Role.CLIENT, {
        email: 'inactive@test.local',
        active: false,
      });

      const responses = await Promise.all([
        http()
          .post(LOGIN)
          .send({ email: user.email, password: 'wrong-password' }),
        http()
          .post(LOGIN)
          .send({ email: 'nobody@test.local', password: PASSWORD }),
        http().post(LOGIN).send({ email: inactive.email, password: PASSWORD }),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid credentials');
        expect(response.get('Set-Cookie')).toBeUndefined();
      }
    });

    it('rejects a malformed body', async () => {
      await http()
        .post(LOGIN)
        .send({ email: 'not-an-email', password: PASSWORD })
        .expect(400);
      await http().post(LOGIN).send({ email: 'a@test.local' }).expect(400);
    });
  });

  describe('access token', () => {
    const me = (token: string) =>
      http().get(ME).set('Authorization', `Bearer ${token}`);

    it('identifies the user on /auth/me', async () => {
      const user = await createUser(prisma, Role.TECHNICIAN);
      const { accessToken } = await login(app, user.email);

      const { body } = await me(accessToken).expect(200);

      expect(body.id).toBe(user.id);
      expect(body.passwordHash).toBeUndefined();
    });

    it('is required', async () => {
      await http().get(ME).expect(401);
      await http().get(ME).set('Authorization', 'Basic abc').expect(401);
      await me('garbage').expect(401);
    });

    it('is rejected when expired', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const token = await app
        .get(JwtService)
        .signAsync({ sub: user.id, role: user.role }, { expiresIn: -1 });

      await me(token).expect(401);
    });

    it('is rejected when signed with another secret', async () => {
      const user = await createUser(prisma, Role.ADMIN);
      const token = await app
        .get(JwtService)
        .signAsync(
          { sub: user.id, role: user.role },
          { secret: 'another-secret' },
        );

      await me(token).expect(401);
    });

    it('is rejected when unsigned (alg: none)', async () => {
      const user = await createUser(prisma, Role.ADMIN);
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
        sub: user.id,
        role: Role.ADMIN,
      })}.`;

      await me(token).expect(401);
    });

    it('stops working on /auth/me once the user is deactivated', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { accessToken } = await login(app, user.email);

      await prisma.user.update({
        where: { id: user.id },
        data: { active: false },
      });

      await me(accessToken).expect(401);
    });
  });

  describe('refresh', () => {
    it('issues a working access token and rotates the cookie', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, user.email);

      const response = await refresh(cookie).expect(200);

      const rotated = cookiePair(refreshCookie(response));
      expect(rotated).not.toBe(cookie);
      expect(response.body.refreshToken).toBeUndefined();
      await http()
        .get(ME)
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      await refresh(rotated).expect(200);
    });

    it('ends every session when a used token comes back', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie: stolen } = await login(app, user.email);
      const { cookie: otherDevice } = await login(app, user.email);
      const rotated = cookiePair(
        refreshCookie(await refresh(stolen).expect(200)),
      );

      const reuse = await refresh(stolen).expect(401);

      expect(refreshCookie(reuse)).toContain('refresh_token=;');
      await refresh(rotated).expect(401);
      await refresh(otherDevice).expect(401);
    });

    it('lets only one of two concurrent requests win', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, user.email);

      const responses = await Promise.all([refresh(cookie), refresh(cookie)]);

      expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
      expect(
        await prisma.refreshToken.count({ where: { revokedAt: null } }),
      ).toBe(0);
    });

    it('rejects a missing or unknown token', async () => {
      await http().post(REFRESH).expect(401);
      await refresh('refresh_token=unknown').expect(401);
    });

    it('rejects an expired token', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, user.email);
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh(cookie).expect(401);
    });

    it('rejects a deactivated user', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { active: false },
      });

      await refresh(cookie).expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the token and clears the cookie', async () => {
      const user = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, user.email);

      const response = await http()
        .post(LOGOUT)
        .set('Cookie', cookie)
        .expect(204);

      expect(refreshCookie(response)).toContain('refresh_token=;');
      await refresh(cookie).expect(401);
    });

    it('succeeds without a cookie', async () => {
      await http().post(LOGOUT).expect(204);
    });
  });
});
