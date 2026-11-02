import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  Role,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createCategory,
  createTechnician,
  createTestApp,
  createUser,
  login,
  resetDatabase,
} from './helpers.js';

const TICKETS = '/api/v1/tickets';
const { OPEN, IN_PROGRESS, RESOLVED, CLOSED } = TicketStatus;

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Hardware has one technician, Redes has another.
  let tokens: {
    admin: string;
    client: string;
    otherClient: string;
    technician: string;
    otherTechnician: string;
  };
  let ids: { client: string; technician: string; otherTechnician: string };
  let hardwareCategory: string;
  let networkCategory: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    post: (path: string) =>
      http().post(path).set('Authorization', `Bearer ${token}`),
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string) =>
      http().patch(path).set('Authorization', `Bearer ${token}`),
  });

  const openTicket = async (
    overrides: { categoryId?: string; priority?: TicketPriority } = {},
    token = tokens.client,
  ) => {
    const { body } = await as(token)
      .post(TICKETS)
      .send({
        title: 'Impressora parada',
        description: 'Não imprime desde ontem',
        categoryId: hardwareCategory,
        ...overrides,
      })
      .expect(201);
    return body as { id: string };
  };

  const assign = (ticketId: string, technicianId = ids.technician) =>
    as(tokens.admin)
      .patch(`${TICKETS}/${ticketId}/assign`)
      .send({ technicianId })
      .expect(200);

  const setStatus = (ticketId: string, status: TicketStatus, token: string) =>
    as(token).patch(`${TICKETS}/${ticketId}/status`).send({ status });

  /** Opens a ticket and walks it to the given status through the API. */
  const ticketIn = async (status: TicketStatus) => {
    const { id } = await openTicket();
    if (status === OPEN) return id;
    await assign(id);
    await setStatus(id, IN_PROGRESS, tokens.technician).expect(200);
    if (status === IN_PROGRESS) return id;
    await setStatus(id, RESOLVED, tokens.technician).expect(200);
    if (status === RESOLVED) return id;
    await setStatus(id, CLOSED, tokens.client).expect(200);
    return id;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const hardware = await createCategory(prisma, 'Hardware');
    const network = await createCategory(prisma, 'Redes');
    hardwareCategory = hardware.id;
    networkCategory = network.id;

    const admin = await createUser(prisma, Role.ADMIN);
    const client = await createUser(prisma, Role.CLIENT);
    const otherClient = await createUser(prisma, Role.CLIENT, {
      email: 'other-client@test.local',
    });
    const technician = await createTechnician(prisma, 'tech@test.local', [
      hardware.areaId,
    ]);
    const otherTechnician = await createTechnician(prisma, 'tech2@test.local', [
      network.areaId,
    ]);

    ids = {
      client: client.id,
      technician: technician.id,
      otherTechnician: otherTechnician.id,
    };
    tokens = {
      admin: (await login(app, admin.email)).accessToken,
      client: (await login(app, client.email)).accessToken,
      otherClient: (await login(app, otherClient.email)).accessToken,
      technician: (await login(app, technician.email)).accessToken,
      otherTechnician: (await login(app, otherTechnician.email)).accessToken,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires login on every route', async () => {
    const id = randomUUID();
    await http().post(TICKETS).expect(401);
    await http().get(TICKETS).expect(401);
    await http().get(`${TICKETS}/${id}`).expect(401);
    await http().patch(`${TICKETS}/${id}/assign`).expect(401);
    await http().patch(`${TICKETS}/${id}/status`).expect(401);
    await http().patch(`${TICKETS}/${id}/priority`).expect(401);
  });

  describe('open', () => {
    it('creates an open, unassigned ticket owned by the client', async () => {
      const { body } = await as(tokens.client)
        .post(TICKETS)
        .send({
          title: '  Sem internet ',
          description: 'Caiu tudo',
          categoryId: networkCategory,
          priority: TicketPriority.HIGH,
        })
        .expect(201);

      expect(body).toMatchObject({
        title: 'Sem internet',
        status: OPEN,
        priority: TicketPriority.HIGH,
        technician: null,
        resolvedAt: null,
        client: { id: ids.client },
        category: { id: networkCategory, area: { name: 'Redes' } },
      });
      expect(JSON.stringify(body)).not.toContain('passwordHash');
      expect(JSON.stringify(body)).not.toContain('email');
    });

    it('defaults to normal priority', async () => {
      const { id } = await openTicket();

      const { body } = await as(tokens.client)
        .get(`${TICKETS}/${id}`)
        .expect(200);
      expect(body.priority).toBe(TicketPriority.NORMAL);
    });

    it.each(['admin', 'technician'] as const)(
      'rejects %s callers',
      async (role) => {
        await as(tokens[role])
          .post(TICKETS)
          .send({
            title: 'X',
            description: 'Y',
            categoryId: hardwareCategory,
          })
          .expect(403);
      },
    );

    it.each([
      ['a blank title', { title: '   ' }],
      ['an unknown priority', { priority: 'PANIC' }],
      ['an invalid category id', { categoryId: 'nope' }],
      ['an unknown field', { clientId: randomUUID() }],
      ['a status', { status: CLOSED }],
    ])('rejects %s', async (_name, overrides) => {
      await as(tokens.client)
        .post(TICKETS)
        .send({
          title: 'X',
          description: 'Y',
          categoryId: hardwareCategory,
          ...overrides,
        })
        .expect(400);
    });

    it('rejects an unknown category', async () => {
      await as(tokens.client)
        .post(TICKETS)
        .send({ title: 'X', description: 'Y', categoryId: randomUUID() })
        .expect(400);
    });
  });

  describe('visibility', () => {
    const listIds = async (token: string, query = '') => {
      const { body } = await as(token).get(`${TICKETS}${query}`).expect(200);
      return body.data.map((t: { id: string }) => t.id).sort();
    };
    const sorted = (...values: string[]) => [...values].sort();

    it('clients only see their own tickets', async () => {
      const mine = await openTicket();
      const theirs = await openTicket({}, tokens.otherClient);

      expect(await listIds(tokens.client)).toEqual([mine.id]);
      await as(tokens.client).get(`${TICKETS}/${mine.id}`).expect(200);
      await as(tokens.client).get(`${TICKETS}/${theirs.id}`).expect(404);
    });

    it('filters cannot widen what a client sees', async () => {
      const mine = await openTicket();
      await openTicket({}, tokens.otherClient);

      expect(await listIds(tokens.client, '?unassigned=true')).toEqual([
        mine.id,
      ]);
      expect(
        await listIds(tokens.client, `?categoryId=${hardwareCategory}`),
      ).toEqual([mine.id]);
    });

    it('technicians see their tickets and the unassigned queue of their areas', async () => {
      const queue = await openTicket();
      const mine = await openTicket({ categoryId: networkCategory });
      await assign(mine.id);
      const otherArea = await openTicket({ categoryId: networkCategory });
      const assignedToOther = await openTicket();
      await assign(assignedToOther.id, ids.otherTechnician);

      expect(await listIds(tokens.technician)).toEqual(
        sorted(queue.id, mine.id),
      );
      await as(tokens.technician).get(`${TICKETS}/${queue.id}`).expect(200);
      await as(tokens.technician).get(`${TICKETS}/${mine.id}`).expect(200);
      await as(tokens.technician).get(`${TICKETS}/${otherArea.id}`).expect(404);
      await as(tokens.technician)
        .get(`${TICKETS}/${assignedToOther.id}`)
        .expect(404);
    });

    it('admins see everything', async () => {
      const first = await openTicket();
      const second = await openTicket({}, tokens.otherClient);

      expect(await listIds(tokens.admin)).toEqual(sorted(first.id, second.id));
    });

    it('answers the same for an unknown ticket and an invisible one', async () => {
      const theirs = await openTicket({}, tokens.otherClient);

      const invisible = await as(tokens.client)
        .get(`${TICKETS}/${theirs.id}`)
        .expect(404);
      const unknown = await as(tokens.client)
        .get(`${TICKETS}/${randomUUID()}`)
        .expect(404);

      expect(invisible.body).toEqual(unknown.body);
    });
  });

  describe('list', () => {
    const count = async (query: string) => {
      const { body } = await as(tokens.admin)
        .get(`${TICKETS}?${query}`)
        .expect(200);
      return body.meta.total as number;
    };

    it('filters by status, priority, category, technician and assignment', async () => {
      const assigned = await openTicket({ priority: TicketPriority.URGENT });
      await assign(assigned.id);
      await setStatus(assigned.id, IN_PROGRESS, tokens.technician).expect(200);
      await openTicket({ categoryId: networkCategory });
      await openTicket({ categoryId: networkCategory });

      expect(await count(`status=${IN_PROGRESS}`)).toBe(1);
      expect(await count(`status=${OPEN}`)).toBe(2);
      expect(await count(`priority=${TicketPriority.URGENT}`)).toBe(1);
      expect(await count(`categoryId=${networkCategory}`)).toBe(2);
      expect(await count(`technicianId=${ids.technician}`)).toBe(1);
      expect(await count('unassigned=true')).toBe(2);
      expect(await count('unassigned=false')).toBe(1);
      expect(await count(`status=${OPEN}&categoryId=${hardwareCategory}`)).toBe(
        0,
      );
    });

    it('paginates, newest first', async () => {
      const first = await openTicket();
      const second = await openTicket();
      const third = await openTicket();

      const { body } = await as(tokens.admin)
        .get(`${TICKETS}?page=1&limit=2`)
        .expect(200);

      expect(body.data.map((t: { id: string }) => t.id)).toEqual([
        third.id,
        second.id,
      ]);
      expect(body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const { body: page2 } = await as(tokens.admin)
        .get(`${TICKETS}?page=2&limit=2`)
        .expect(200);
      expect(page2.data.map((t: { id: string }) => t.id)).toEqual([first.id]);
    });

    it.each([
      'status=DONE',
      'priority=PANIC',
      'categoryId=nope',
      'technicianId=nope',
      'unassigned=maybe',
      'limit=101',
    ])('rejects %s', async (query) => {
      await as(tokens.admin).get(`${TICKETS}?${query}`).expect(400);
    });
  });

  describe('assign', () => {
    it('assigns and records who did it', async () => {
      const { id } = await openTicket();

      const { body } = await assign(id);

      expect(body.technician.id).toBe(ids.technician);
      expect(await prisma.ticketEvent.findMany()).toEqual([
        expect.objectContaining({
          ticketId: id,
          type: TicketEventType.ASSIGNED,
          from: null,
          to: ids.technician,
        }),
      ]);
    });

    it('reassigns and records both technicians', async () => {
      const { id } = await openTicket();
      await assign(id);

      await assign(id, ids.otherTechnician);

      const event = await prisma.ticketEvent.findFirstOrThrow({
        orderBy: { createdAt: 'desc' },
      });
      expect(event).toMatchObject({
        from: ids.technician,
        to: ids.otherTechnician,
      });
    });

    it('records nothing when the technician is already assigned', async () => {
      const { id } = await openTicket();
      await assign(id);

      await assign(id);

      expect(await prisma.ticketEvent.count()).toBe(1);
    });

    it.each(['client', 'technician'] as const)(
      'rejects %s callers',
      async (role) => {
        const { id } = await openTicket();

        await as(tokens[role])
          .patch(`${TICKETS}/${id}/assign`)
          .send({ technicianId: ids.technician })
          .expect(403);
      },
    );

    it('only accepts active technicians', async () => {
      const { id } = await openTicket();
      const inactive = await createTechnician(prisma, 'off@test.local');
      await prisma.user.update({
        where: { id: inactive.id },
        data: { active: false },
      });

      for (const technicianId of [ids.client, inactive.id, randomUUID()]) {
        await as(tokens.admin)
          .patch(`${TICKETS}/${id}/assign`)
          .send({ technicianId })
          .expect(400);
      }
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it.each([RESOLVED, CLOSED])('rejects a %s ticket', async (status) => {
      const id = await ticketIn(status);

      await as(tokens.admin)
        .patch(`${TICKETS}/${id}/assign`)
        .send({ technicianId: ids.otherTechnician })
        .expect(409);
    });

    it('returns 404 for an unknown ticket', async () => {
      await as(tokens.admin)
        .patch(`${TICKETS}/${randomUUID()}/assign`)
        .send({ technicianId: ids.technician })
        .expect(404);
    });
  });

  describe('status', () => {
    it('walks the whole flow and sets the dates', async () => {
      const { id } = await openTicket();
      await assign(id);

      const started = await setStatus(id, IN_PROGRESS, tokens.technician);
      expect(started.status).toBe(200);
      expect(started.body.resolvedAt).toBeNull();

      const resolved = await setStatus(id, RESOLVED, tokens.technician);
      expect(resolved.status).toBe(200);
      expect(resolved.body.resolvedAt).toEqual(expect.any(String));

      const closed = await setStatus(id, CLOSED, tokens.client);
      expect(closed.status).toBe(200);
      expect(closed.body.status).toBe(CLOSED);
      expect(closed.body.resolvedAt).toEqual(resolved.body.resolvedAt);

      const events = await prisma.ticketEvent.findMany({
        where: { type: TicketEventType.STATUS_CHANGED },
        orderBy: { createdAt: 'asc' },
      });
      expect(events.map((e) => [e.from, e.to])).toEqual([
        [OPEN, IN_PROGRESS],
        [IN_PROGRESS, RESOLVED],
        [RESOLVED, CLOSED],
      ]);
    });

    it('needs a technician before starting', async () => {
      const { id } = await openTicket();

      const { body } = await setStatus(id, IN_PROGRESS, tokens.admin).expect(
        409,
      );

      expect(body.message).toBe('Assign a technician first');
    });

    it('rejects a transition that does not exist, without changing anything', async () => {
      const { id } = await openTicket();
      await assign(id);

      await setStatus(id, RESOLVED, tokens.technician).expect(409);
      await setStatus(id, OPEN, tokens.technician).expect(409);

      const stored = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(stored.status).toBe(OPEN);
    });

    it('never reopens a closed ticket', async () => {
      const id = await ticketIn(CLOSED);

      for (const token of [tokens.admin, tokens.client, tokens.technician]) {
        await setStatus(id, IN_PROGRESS, token).expect(409);
      }
    });

    it('lets the client confirm or reopen, and reopening clears the date', async () => {
      const id = await ticketIn(RESOLVED);

      const { body } = await setStatus(id, IN_PROGRESS, tokens.client).expect(
        200,
      );

      expect(body.resolvedAt).toBeNull();
      await setStatus(id, RESOLVED, tokens.technician).expect(200);
      await setStatus(id, CLOSED, tokens.client).expect(200);
    });

    it('does not let the client start or resolve the work', async () => {
      const { id } = await openTicket();
      await assign(id);

      await setStatus(id, IN_PROGRESS, tokens.client).expect(403);
      await setStatus(id, IN_PROGRESS, tokens.technician).expect(200);
      await setStatus(id, RESOLVED, tokens.client).expect(403);
    });

    it('does not let the technician close', async () => {
      const id = await ticketIn(RESOLVED);

      await setStatus(id, CLOSED, tokens.technician).expect(403);
    });

    it('lets the admin close when the client never answers', async () => {
      const id = await ticketIn(RESOLVED);

      await setStatus(id, CLOSED, tokens.admin).expect(200);
    });

    it('does not let a technician change a queue ticket they can only see', async () => {
      const { id } = await openTicket();

      await as(tokens.technician).get(`${TICKETS}/${id}`).expect(200);
      await setStatus(id, IN_PROGRESS, tokens.technician).expect(403);
    });

    it("hides another person's ticket", async () => {
      const id = await ticketIn(RESOLVED);

      await setStatus(id, CLOSED, tokens.otherClient).expect(404);
      await setStatus(id, IN_PROGRESS, tokens.otherTechnician).expect(404);
    });

    it('rejects an unknown status', async () => {
      const { id } = await openTicket();

      await as(tokens.admin)
        .patch(`${TICKETS}/${id}/status`)
        .send({ status: 'DONE' })
        .expect(400);
    });

    it('lets only one of two simultaneous changes win', async () => {
      const { id } = await openTicket();
      await assign(id);

      const responses = await Promise.all([
        setStatus(id, IN_PROGRESS, tokens.technician),
        setStatus(id, IN_PROGRESS, tokens.admin),
      ]);

      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.ticketEvent.count({
          where: { type: TicketEventType.STATUS_CHANGED },
        }),
      ).toBe(1);
    });
  });

  describe('priority', () => {
    const setPriority = (id: string, priority: string, token: string) =>
      as(token).patch(`${TICKETS}/${id}/priority`).send({ priority });

    it('lets the admin and the assigned technician change it, and records it', async () => {
      const { id } = await openTicket();
      await assign(id);

      const { body } = await setPriority(
        id,
        TicketPriority.HIGH,
        tokens.technician,
      ).expect(200);
      expect(body.priority).toBe(TicketPriority.HIGH);

      await setPriority(id, TicketPriority.URGENT, tokens.admin).expect(200);

      const events = await prisma.ticketEvent.findMany({
        where: { type: TicketEventType.PRIORITY_CHANGED },
        orderBy: { createdAt: 'asc' },
      });
      expect(events.map((e) => [e.from, e.to])).toEqual([
        [TicketPriority.NORMAL, TicketPriority.HIGH],
        [TicketPriority.HIGH, TicketPriority.URGENT],
      ]);
    });

    it('records nothing when the priority is the same', async () => {
      const { id } = await openTicket();

      await setPriority(id, TicketPriority.NORMAL, tokens.admin).expect(200);

      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('rejects clients, even on their own ticket', async () => {
      const { id } = await openTicket();

      await setPriority(id, TicketPriority.URGENT, tokens.client).expect(403);
    });

    it('rejects a technician who is not assigned', async () => {
      const { id } = await openTicket();

      await setPriority(id, TicketPriority.URGENT, tokens.technician).expect(
        403,
      );
    });

    it('rejects a closed ticket', async () => {
      const id = await ticketIn(CLOSED);

      await setPriority(id, TicketPriority.URGENT, tokens.admin).expect(409);
    });

    it('rejects an unknown priority', async () => {
      const { id } = await openTicket();

      await setPriority(id, 'PANIC', tokens.admin).expect(400);
    });
  });
});
