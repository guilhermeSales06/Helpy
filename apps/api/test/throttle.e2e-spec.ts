import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createUser, login, resetDatabase } from './helpers.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    vi.stubEnv('THROTTLE_DISABLED', 'false');
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const attemptLogin = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-123' });

  it('allows 10 logins per minute and answers 429 to the 11th', async () => {
    for (let i = 0; i < 10; i++) {
      await attemptLogin('nobody@test.local').expect(401);
    }
    await attemptLogin('nobody@test.local').expect(429);
  });

  it('does not limit refresh, logout or me', async () => {
    const user = await createUser(prisma, Role.CLIENT);
    const { accessToken } = await login(app, user.email);
    const http = request(app.getHttpServer());

    for (let i = 0; i < 10; i++) {
      await http.post('/api/v1/auth/refresh').expect(401);
      await http.post('/api/v1/auth/logout').expect(204);
      await http
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }
  });

  it('counts login attempts per IP, not per e-mail', async () => {
    for (let i = 0; i < 10; i++) {
      await attemptLogin(`person-${i}@test.local`).expect(401);
    }
    await attemptLogin('another@test.local').expect(429);
  });

  it('does not throttle at all when THROTTLE_DISABLED is true', async () => {
    vi.stubEnv('THROTTLE_DISABLED', 'true');
    for (let i = 0; i < 15; i++) {
      await attemptLogin('nobody@test.local').expect(401);
    }
  });
});
