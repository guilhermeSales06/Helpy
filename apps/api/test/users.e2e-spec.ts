import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestApp,
  createUser,
  login,
  PASSWORD,
  resetDatabase,
} from './helpers.js';

const USERS = '/api/v1/users';
const newClient = {
  name: 'Maria',
  email: 'maria@test.local',
  password: PASSWORD,
  role: Role.CLIENT,
};
const newTechnician = {
  name: 'João',
  email: 'joao@test.local',
  password: PASSWORD,
  role: Role.TECHNICIAN,
  specialty: 'Redes',
};

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let adminToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = {
    post: (path: string) =>
      http().post(path).set('Authorization', `Bearer ${adminToken}`),
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${adminToken}`),
    patch: (path: string) =>
      http().patch(path).set('Authorization', `Bearer ${adminToken}`),
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await createUser(prisma, Role.ADMIN);
    ({ accessToken: adminToken } = await login(app, admin.email));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permissions', () => {
    const routes = [
      ['post', USERS],
      ['get', USERS],
      ['get', `${USERS}/${randomUUID()}`],
      ['patch', `${USERS}/${randomUUID()}`],
      ['patch', `${USERS}/${randomUUID()}/active`],
    ] as const;

    it.each(routes)('%s %s rejects anonymous callers', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each(routes)('%s %s rejects clients', async (method, path) => {
      const user = await createUser(prisma, Role.CLIENT);
      const { accessToken } = await login(app, user.email);

      await http()
        [method](path)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it.each(routes)('%s %s rejects technicians', async (method, path) => {
      const user = await createUser(prisma, Role.TECHNICIAN);
      const { accessToken } = await login(app, user.email);

      await http()
        [method](path)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('create', () => {
    it('creates a client without exposing the password', async () => {
      const { body } = await asAdmin.post(USERS).send(newClient).expect(201);

      expect(body).toMatchObject({
        name: 'Maria',
        email: 'maria@test.local',
        role: Role.CLIENT,
        active: true,
        specialty: null,
      });
      expect(JSON.stringify(body)).not.toContain('assword');

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('creates a technician who can log in', async () => {
      const { body } = await asAdmin
        .post(USERS)
        .send(newTechnician)
        .expect(201);

      expect(body.specialty).toBe('Redes');
      await login(app, newTechnician.email);
    });

    it('rejects creating an admin', async () => {
      await asAdmin
        .post(USERS)
        .send({ ...newClient, role: Role.ADMIN })
        .expect(400);
    });

    it('rejects unknown fields', async () => {
      await asAdmin
        .post(USERS)
        .send({ ...newClient, passwordHash: 'x' })
        .expect(400);
    });

    it('rejects a short password', async () => {
      await asAdmin
        .post(USERS)
        .send({ ...newClient, password: 'short' })
        .expect(400);
    });

    it('rejects a specialty on a client', async () => {
      await asAdmin
        .post(USERS)
        .send({ ...newClient, specialty: 'Redes' })
        .expect(400);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await asAdmin.post(USERS).send(newClient).expect(201);

      await asAdmin
        .post(USERS)
        .send({ ...newClient, email: 'MARIA@test.local' })
        .expect(409);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await createUser(prisma, Role.CLIENT);
      await createUser(prisma, Role.CLIENT, {
        email: 'old-client@test.local',
        active: false,
      });
      await createUser(prisma, Role.TECHNICIAN);
    });

    it('paginates', async () => {
      const { body } = await asAdmin.get(`${USERS}?page=2&limit=3`).expect(200);

      expect(body.data).toHaveLength(1);
      expect(body.meta).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
      expect(JSON.stringify(body)).not.toContain('passwordHash');
    });

    it('filters by role', async () => {
      const { body } = await asAdmin.get(`${USERS}?role=CLIENT`).expect(200);

      expect(body.meta.total).toBe(2);
    });

    it('filters by active, including false', async () => {
      const { body } = await asAdmin.get(`${USERS}?active=false`).expect(200);

      expect(body.data.map((u: { email: string }) => u.email)).toEqual([
        'old-client@test.local',
      ]);
    });

    it.each(['limit=101', 'page=0', 'role=BOSS', 'active=maybe'])(
      'rejects %s',
      async (query) => {
        await asAdmin.get(`${USERS}?${query}`).expect(400);
      },
    );
  });

  describe('find one', () => {
    it('returns the user', async () => {
      const { body } = await asAdmin.get(`${USERS}/${admin.id}`).expect(200);

      expect(body.id).toBe(admin.id);
    });

    it('returns 404 for an unknown id and 400 for an invalid one', async () => {
      await asAdmin.get(`${USERS}/${randomUUID()}`).expect(404);
      await asAdmin.get(`${USERS}/not-a-uuid`).expect(400);
    });
  });

  describe('update', () => {
    it('updates the name and the specialty', async () => {
      const { body: created } = await asAdmin
        .post(USERS)
        .send(newTechnician)
        .expect(201);

      const { body } = await asAdmin
        .patch(`${USERS}/${created.id}`)
        .send({ name: 'João Silva', specialty: 'Hardware' })
        .expect(200);

      expect(body).toMatchObject({ name: 'João Silva', specialty: 'Hardware' });
    });

    it('does not allow changing the role', async () => {
      const client = await createUser(prisma, Role.CLIENT);

      await asAdmin
        .patch(`${USERS}/${client.id}`)
        .send({ role: Role.ADMIN })
        .expect(400);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: client.id },
      });
      expect(stored.role).toBe(Role.CLIENT);
    });

    it('rejects a specialty on a client', async () => {
      const client = await createUser(prisma, Role.CLIENT);

      await asAdmin
        .patch(`${USERS}/${client.id}`)
        .send({ specialty: 'Redes' })
        .expect(400);
    });

    it('rejects an email that is already taken', async () => {
      const client = await createUser(prisma, Role.CLIENT);

      await asAdmin
        .patch(`${USERS}/${client.id}`)
        .send({ email: admin.email })
        .expect(409);
    });

    it('returns 404 for an unknown user', async () => {
      await asAdmin
        .patch(`${USERS}/${randomUUID()}`)
        .send({ name: 'Nobody' })
        .expect(404);
    });

    it('changing the password ends sessions and replaces the old one', async () => {
      const client = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, client.email);
      const newPassword = 'a-brand-new-password';

      await asAdmin
        .patch(`${USERS}/${client.id}`)
        .send({ password: newPassword })
        .expect(200);

      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: client.email, password: PASSWORD })
        .expect(401);
      await login(app, client.email, newPassword);
    });
  });

  describe('activate and deactivate', () => {
    it('deactivating blocks login and ends sessions; reactivating restores login', async () => {
      const client = await createUser(prisma, Role.CLIENT);
      const { cookie } = await login(app, client.email);

      const { body } = await asAdmin
        .patch(`${USERS}/${client.id}/active`)
        .send({ active: false })
        .expect(200);
      expect(body.active).toBe(false);

      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email: client.email, password: PASSWORD })
        .expect(401);

      await asAdmin
        .patch(`${USERS}/${client.id}/active`)
        .send({ active: true })
        .expect(200);
      await login(app, client.email);
    });

    it('keeps the user in the database', async () => {
      const client = await createUser(prisma, Role.CLIENT);

      await asAdmin
        .patch(`${USERS}/${client.id}/active`)
        .send({ active: false })
        .expect(200);

      expect(await prisma.user.count({ where: { id: client.id } })).toBe(1);
    });

    it('does not let admins deactivate themselves', async () => {
      await asAdmin
        .patch(`${USERS}/${admin.id}/active`)
        .send({ active: false })
        .expect(400);
    });

    it('requires a boolean', async () => {
      const client = await createUser(prisma, Role.CLIENT);

      await asAdmin
        .patch(`${USERS}/${client.id}/active`)
        .send({ active: 'false' })
        .expect(400);
    });
  });
});
