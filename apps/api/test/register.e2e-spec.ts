import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  cookiePair,
  createTestApp,
  createUser,
  refreshCookie,
  resetDatabase,
} from './helpers.js';

const REGISTER = '/api/v1/auth/register';
const LOGIN = '/api/v1/auth/login';
const ME = '/api/v1/auth/me';

const valid = {
  name: 'Ana Souza',
  email: 'ana@empresa.com',
  password: 'Abcdefg1',
};

describe('Register (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const register = (body: object) => http().post(REGISTER).send(body);

  beforeEach(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('creates a CLIENT, logs them in and sets the refresh cookie', async () => {
    const response = await register(valid).expect(201);

    expect(response.body.user).toMatchObject({
      name: 'Ana Souza',
      email: 'ana@empresa.com',
      role: 'CLIENT',
      active: true,
    });
    expect(response.body.accessToken).toEqual(expect.any(String));
    const cookie = refreshCookie(response);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');

    const me = await http()
      .get(ME)
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(me.body.id).toBe(response.body.user.id);

    await http()
      .post(LOGIN)
      .send({ email: valid.email, password: valid.password })
      .expect(200);
    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiePair(cookie))
      .expect(200);
  });

  it('stores the e-mail trimmed and lowercased', async () => {
    await register({ ...valid, email: '  Ana@Empresa.COM ' }).expect(201);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.email).toBe('ana@empresa.com');
  });

  it('answers 409 to an e-mail already in use, in any letter case', async () => {
    await createUser(prisma, Role.CLIENT, { email: 'ana@empresa.com' });
    await register(valid).expect(409);
    await register({ ...valid, email: 'ANA@Empresa.com' }).expect(409);
  });

  it('answers 409, never 500, when two requests race on the same e-mail', async () => {
    const responses = await Promise.all([register(valid), register(valid)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each(['role', 'phone', 'active', 'areaIds'])(
    'rejects the extra field %s with 400',
    async (field) => {
      await register({
        ...valid,
        [field]: field === 'active' ? true : 'x',
      }).expect(400);
      expect(await prisma.user.count()).toBe(0);
    },
  );

  it('never creates an admin or technician even when role is sent', async () => {
    await register({ ...valid, role: 'ADMIN' }).expect(400);
    await register({ ...valid, role: 'TECHNICIAN' }).expect(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ['7 characters', 'Abcdef1'],
    ['129 characters', 'A1' + 'a'.repeat(127)],
    ['no uppercase letter', 'abcdefg1'],
    ['no number', 'Abcdefgh'],
  ])('rejects a password with %s', async (_label, password) => {
    await register({ ...valid, password }).expect(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ['exactly 8', 'Abcdefg1'],
    ['exactly 128', 'A1' + 'a'.repeat(126)],
  ])('accepts a password with %s', async (_label, password) => {
    await register({ ...valid, password }).expect(201);
  });

  it('rejects a blank name and a name over 120 characters', async () => {
    await register({ ...valid, name: '   ' }).expect(400);
    await register({ ...valid, name: 'a'.repeat(121) }).expect(400);
    await register({ ...valid, name: 'a'.repeat(120) }).expect(201);
  });

  it('rejects an invalid e-mail', async () => {
    await register({ ...valid, email: 'not-an-email' }).expect(400);
  });

  it('does not return the password hash', async () => {
    const response = await register(valid).expect(201);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$argon2/);
  });

  it('answers 429 to the 6th attempt in a minute when throttling is on', async () => {
    vi.stubEnv('THROTTLE_DISABLED', 'false');
    await app.close();
    ({ app, prisma } = await createTestApp());

    await register(valid).expect(201);
    await register(valid).expect(409);
    for (let i = 0; i < 3; i++) {
      await register({ ...valid, password: 'short' }).expect(400);
    }
    await register(valid).expect(429);
  });
});
