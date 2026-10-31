import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createCategory,
  createTestApp,
  createUser,
  login,
  PASSWORD,
  resetDatabase,
} from './helpers.js';

const AREAS = '/api/v1/areas';
const CATEGORIES = '/api/v1/categories';
const USERS = '/api/v1/users';

describe('Areas and categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let clientToken: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    post: (path: string) =>
      http().post(path).set('Authorization', `Bearer ${token}`),
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string) =>
      http().patch(path).set('Authorization', `Bearer ${token}`),
    delete: (path: string) =>
      http().delete(path).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const admin = await createUser(prisma, Role.ADMIN);
    const client = await createUser(prisma, Role.CLIENT);
    ({ accessToken: adminToken } = await login(app, admin.email));
    ({ accessToken: clientToken } = await login(app, client.email));
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each([
    ['areas', AREAS],
    ['categories', CATEGORIES],
  ])('%s permissions', (_name, base) => {
    const id = randomUUID();

    it.each([
      ['post', base],
      ['get', base],
      ['get', `${base}/${id}`],
      ['patch', `${base}/${id}`],
      ['delete', `${base}/${id}`],
    ] as const)('%s %s rejects anonymous callers', async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each([
      ['post', base],
      ['patch', `${base}/${id}`],
      ['delete', `${base}/${id}`],
    ] as const)('%s %s rejects non-admins', async (method, path) => {
      await as(clientToken)[method](path).send({ name: 'X' }).expect(403);
    });

    it('lets any logged-in user read', async () => {
      await as(clientToken).get(base).expect(200);
    });
  });

  describe('areas', () => {
    it('creates, lists sorted, updates and deletes', async () => {
      const { body: network } = await as(adminToken)
        .post(AREAS)
        .send({ name: '  Redes ' })
        .expect(201);
      expect(network.name).toBe('Redes');
      await as(adminToken).post(AREAS).send({ name: 'Hardware' }).expect(201);

      const { body: list } = await as(clientToken).get(AREAS).expect(200);
      expect(list.map((a: { name: string }) => a.name)).toEqual([
        'Hardware',
        'Redes',
      ]);

      const { body: updated } = await as(adminToken)
        .patch(`${AREAS}/${network.id}`)
        .send({ name: 'Infra' })
        .expect(200);
      expect(updated.name).toBe('Infra');

      await as(adminToken).delete(`${AREAS}/${network.id}`).expect(204);
      await as(adminToken).get(`${AREAS}/${network.id}`).expect(404);
    });

    it('rejects a blank or duplicate name', async () => {
      await as(adminToken).post(AREAS).send({ name: '   ' }).expect(400);
      await as(adminToken).post(AREAS).send({ name: 'Redes' }).expect(201);
      await as(adminToken).post(AREAS).send({ name: 'Redes' }).expect(409);
    });

    it('does not delete an area that has categories', async () => {
      const category = await createCategory(prisma, 'Hardware');

      await as(adminToken).delete(`${AREAS}/${category.areaId}`).expect(409);
    });

    it('returns 404 for an unknown area and 400 for an invalid id', async () => {
      await as(adminToken).delete(`${AREAS}/${randomUUID()}`).expect(404);
      await as(adminToken).get(`${AREAS}/not-a-uuid`).expect(400);
    });
  });

  describe('categories', () => {
    it('creates inside an area and returns the area', async () => {
      const { body: area } = await as(adminToken)
        .post(AREAS)
        .send({ name: 'Hardware' })
        .expect(201);

      const { body } = await as(adminToken)
        .post(CATEGORIES)
        .send({ name: 'Impressora', areaId: area.id })
        .expect(201);

      expect(body).toMatchObject({
        name: 'Impressora',
        area: { id: area.id, name: 'Hardware' },
      });
    });

    it('filters by area', async () => {
      const printer = await createCategory(prisma, 'Hardware', 'Impressora');
      await createCategory(prisma, 'Redes', 'VPN');

      const { body } = await as(clientToken)
        .get(`${CATEGORIES}?areaId=${printer.areaId}`)
        .expect(200);

      expect(body.map((c: { name: string }) => c.name)).toEqual(['Impressora']);
    });

    it('rejects an unknown area on create and on update', async () => {
      const category = await createCategory(prisma, 'Hardware');

      await as(adminToken)
        .post(CATEGORIES)
        .send({ name: 'X', areaId: randomUUID() })
        .expect(400);
      await as(adminToken)
        .patch(`${CATEGORIES}/${category.id}`)
        .send({ areaId: randomUUID() })
        .expect(400);
    });

    it('allows the same name in different areas, but not in the same one', async () => {
      const category = await createCategory(prisma, 'Hardware', 'Outros');
      const other = await createCategory(prisma, 'Redes', 'VPN');

      await as(adminToken)
        .post(CATEGORIES)
        .send({ name: 'Outros', areaId: other.areaId })
        .expect(201);
      await as(adminToken)
        .post(CATEGORIES)
        .send({ name: 'Outros', areaId: category.areaId })
        .expect(409);
    });

    it('does not delete a category that has tickets', async () => {
      const category = await createCategory(prisma, 'Hardware');
      await as(clientToken)
        .post('/api/v1/tickets')
        .send({
          title: 'Sem tinta',
          description: 'A impressora parou',
          categoryId: category.id,
        })
        .expect(201);

      await as(adminToken).delete(`${CATEGORIES}/${category.id}`).expect(409);
    });
  });

  describe('technician areas', () => {
    const technician = (areaIds: string[]) => ({
      name: 'João',
      email: 'joao@test.local',
      password: PASSWORD,
      role: Role.TECHNICIAN,
      areaIds,
    });

    it('sets the areas on create and replaces them on update', async () => {
      const hardware = await createCategory(prisma, 'Hardware');
      const network = await createCategory(prisma, 'Redes');

      const { body: created } = await as(adminToken)
        .post(USERS)
        .send(technician([hardware.areaId]))
        .expect(201);
      expect(created.areas.map((a: { id: string }) => a.id)).toEqual([
        hardware.areaId,
      ]);

      const { body: updated } = await as(adminToken)
        .patch(`${USERS}/${created.id}`)
        .send({ areaIds: [network.areaId] })
        .expect(200);
      expect(updated.areas.map((a: { id: string }) => a.id)).toEqual([
        network.areaId,
      ]);

      const { body: cleared } = await as(adminToken)
        .patch(`${USERS}/${created.id}`)
        .send({ areaIds: [] })
        .expect(200);
      expect(cleared.areas).toEqual([]);
    });

    it('keeps the areas when updating something else', async () => {
      const hardware = await createCategory(prisma, 'Hardware');
      const { body: created } = await as(adminToken)
        .post(USERS)
        .send(technician([hardware.areaId]))
        .expect(201);

      const { body } = await as(adminToken)
        .patch(`${USERS}/${created.id}`)
        .send({ specialty: 'Impressoras' })
        .expect(200);

      expect(body.areas).toHaveLength(1);
      expect(body.specialty).toBe('Impressoras');
    });

    it('rejects unknown areas and repeated ids', async () => {
      const hardware = await createCategory(prisma, 'Hardware');

      await as(adminToken)
        .post(USERS)
        .send(technician([randomUUID()]))
        .expect(400);
      await as(adminToken)
        .post(USERS)
        .send(technician([hardware.areaId, hardware.areaId]))
        .expect(400);
      expect(
        await prisma.user.count({ where: { email: 'joao@test.local' } }),
      ).toBe(0);
    });

    it('rejects areas on a client', async () => {
      const hardware = await createCategory(prisma, 'Hardware');

      await as(adminToken)
        .post(USERS)
        .send({
          ...technician([hardware.areaId]),
          role: Role.CLIENT,
        })
        .expect(400);
    });
  });
});
