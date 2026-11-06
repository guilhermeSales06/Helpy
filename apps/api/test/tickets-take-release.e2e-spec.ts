import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  Role,
  TicketEventType,
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

describe('Take and release tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: {
    admin: string;
    client: string;
    technician: string;
    colleague: string;
    outsider: string;
  };
  let ids: { client: string; technician: string; colleague: string };
  let hardwareCategory: string;
  let networkCategory: string;

  const send = (action: 'take' | 'release', id: string, token: string) =>
    request(app.getHttpServer())
      .patch(`${TICKETS}/${id}/${action}`)
      .set('Authorization', `Bearer ${token}`);
  const take = (id: string, token = tokens.technician) =>
    send('take', id, token);

  const release = (id: string, token = tokens.technician) =>
    send('release', id, token);

  const makeTicket = (
    extra: {
      status?: TicketStatus;
      technicianId?: string | null;
      categoryId?: string;
    } = {},
  ) =>
    prisma.ticket.create({
      data: {
        title: 'Printer is down',
        description: 'desc',
        clientId: ids.client,
        categoryId: hardwareCategory,
        ...extra,
      },
    });

  // The two events of one change are created together, so their order is not
  // something to rely on.
  const eventsOf = async (ticketId: string) =>
    (await prisma.ticketEvent.findMany({ where: { ticketId } }))
      .map((e) => [e.type, e.from, e.to, e.actorId])
      .sort();

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
    const technician = await createTechnician(prisma, 'tech@test.local', [
      hardware.areaId,
    ]);
    const colleague = await createTechnician(prisma, 'tech2@test.local', [
      hardware.areaId,
    ]);
    const outsider = await createTechnician(prisma, 'tech3@test.local', [
      network.areaId,
    ]);
    ids = {
      client: client.id,
      technician: technician.id,
      colleague: colleague.id,
    };
    tokens = {
      admin: (await login(app, admin.email)).accessToken,
      client: (await login(app, client.email)).accessToken,
      technician: (await login(app, technician.email)).accessToken,
      colleague: (await login(app, colleague.email)).accessToken,
      outsider: (await login(app, outsider.email)).accessToken,
    };
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('take', () => {
    it('lets a technician take an unassigned OPEN ticket of his area: technician set, IN_PROGRESS, two events', async () => {
      const ticket = await makeTicket();

      const { body } = await take(ticket.id).expect(200);

      expect(body).toMatchObject({
        id: ticket.id,
        status: TicketStatus.IN_PROGRESS,
        technician: { id: ids.technician },
      });
      expect(await eventsOf(ticket.id)).toEqual(
        [
          [TicketEventType.ASSIGNED, null, ids.technician, ids.technician],
          [
            TicketEventType.STATUS_CHANGED,
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            ids.technician,
          ],
        ].sort(),
      );
    });

    it('answers 404 when the ticket is outside the technician areas', async () => {
      const ticket = await makeTicket();

      await take(ticket.id, tokens.outsider).expect(404);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({ technicianId: null, status: TicketStatus.OPEN });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 404 for an unknown ticket', async () => {
      await take('3f2b1c0e-8a4d-4e6f-9b1a-0c2d4e6f8a1b').expect(404);
    });

    it('answers 409 when the ticket already has a technician', async () => {
      const ticket = await makeTicket({
        technicianId: ids.colleague,
        status: TicketStatus.IN_PROGRESS,
      });

      await take(ticket.id).expect(409);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({ technicianId: ids.colleague });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 409 to a technician taking a ticket he already holds', async () => {
      const ticket = await makeTicket({
        technicianId: ids.technician,
        status: TicketStatus.IN_PROGRESS,
      });

      await take(ticket.id).expect(409);

      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('does not reveal a ticket that another technician holds in an area he does not serve', async () => {
      const ticket = await makeTicket({
        technicianId: ids.colleague,
        status: TicketStatus.IN_PROGRESS,
      });

      await take(ticket.id, tokens.outsider).expect(404);
    });

    it('answers 409 when the ticket is not OPEN', async () => {
      const ticket = await makeTicket({ status: TicketStatus.CLOSED });

      await take(ticket.id).expect(409);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({ technicianId: null, status: TicketStatus.CLOSED });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 409 to the second of two simultaneous takes and leaves exactly one technician', async () => {
      for (let round = 0; round < 10; round++) {
        const ticket = await makeTicket();

        const responses = await Promise.all([
          take(ticket.id, tokens.technician),
          take(ticket.id, tokens.colleague),
        ]);

        const statuses = responses.map((r) => r.status).sort();
        expect(statuses).toEqual([200, 409]);
        const winner = responses.find((r) => r.status === 200)!.body.technician
          .id as string;
        expect([ids.technician, ids.colleague]).toContain(winner);
        expect(
          await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
        ).toMatchObject({
          technicianId: winner,
          status: TicketStatus.IN_PROGRESS,
        });
        // Only the winner left a trace.
        expect(await eventsOf(ticket.id)).toHaveLength(2);
        expect(
          await prisma.ticketEvent.count({
            where: { ticketId: ticket.id, actorId: { not: winner } },
          }),
        ).toBe(0);
      }
    });

    it('forbids admin and client from taking', async () => {
      const ticket = await makeTicket();

      await take(ticket.id, tokens.admin).expect(403);
      await take(ticket.id, tokens.client).expect(403);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({ technicianId: null, status: TicketStatus.OPEN });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 401 without a token', async () => {
      const ticket = await makeTicket();

      await request(app.getHttpServer())
        .patch(`${TICKETS}/${ticket.id}/take`)
        .expect(401);
    });
  });

  describe('release', () => {
    it.each([TicketStatus.IN_PROGRESS, TicketStatus.PENDING])(
      'lets the assigned technician release a %s ticket: no technician, OPEN, two events',
      async (status) => {
        const ticket = await makeTicket({
          status,
          technicianId: ids.technician,
        });

        const { body } = await release(ticket.id).expect(200);

        expect(body).toMatchObject({
          id: ticket.id,
          status: TicketStatus.OPEN,
          technician: null,
        });
        expect(
          await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
        ).toMatchObject({ technicianId: null, status: TicketStatus.OPEN });
        expect(await eventsOf(ticket.id)).toEqual(
          [
            [TicketEventType.ASSIGNED, ids.technician, null, ids.technician],
            [
              TicketEventType.STATUS_CHANGED,
              status,
              TicketStatus.OPEN,
              ids.technician,
            ],
          ].sort(),
        );
      },
    );

    it('forbids another technician of the area from releasing', async () => {
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
      });

      await release(ticket.id, tokens.colleague).expect(403);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({
        technicianId: ids.technician,
        status: TicketStatus.IN_PROGRESS,
      });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 404 to a technician outside the area of a ticket held by someone else', async () => {
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
      });

      await release(ticket.id, tokens.outsider).expect(404);
    });

    it.each([TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.CLOSED])(
      'answers 409 when releasing a %s ticket',
      async (status) => {
        const ticket = await makeTicket({
          status,
          technicianId: ids.technician,
        });

        await release(ticket.id).expect(409);

        expect(
          await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
        ).toMatchObject({ technicianId: ids.technician, status });
        expect(await prisma.ticketEvent.count()).toBe(0);
      },
    );

    it('answers 409 when releasing an unassigned OPEN ticket of the queue', async () => {
      const ticket = await makeTicket();

      await release(ticket.id).expect(409);

      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('answers 409 to the second of two simultaneous releases and records one pair of events', async () => {
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
      });

      const responses = await Promise.all([
        release(ticket.id),
        release(ticket.id),
      ]);

      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await eventsOf(ticket.id)).toHaveLength(2);
    });

    it('forbids admin and client from releasing', async () => {
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
      });

      await release(ticket.id, tokens.admin).expect(403);
      await release(ticket.id, tokens.client).expect(403);

      expect(
        await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({
        technicianId: ids.technician,
        status: TicketStatus.IN_PROGRESS,
      });
      expect(await prisma.ticketEvent.count()).toBe(0);
    });

    it('a released ticket can be taken by another technician of the area', async () => {
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
      });
      await release(ticket.id).expect(200);

      const { body } = await take(ticket.id, tokens.colleague).expect(200);

      expect(body).toMatchObject({
        status: TicketStatus.IN_PROGRESS,
        technician: { id: ids.colleague },
      });
    });

    it('the technician no longer sees a released ticket of an area he does not serve', async () => {
      // An admin can assign a ticket of an area the technician does not serve.
      const ticket = await makeTicket({
        status: TicketStatus.IN_PROGRESS,
        technicianId: ids.technician,
        categoryId: networkCategory,
      });
      const get = () =>
        request(app.getHttpServer())
          .get(`${TICKETS}/${ticket.id}`)
          .set('Authorization', `Bearer ${tokens.technician}`);
      await get().expect(200);

      await release(ticket.id).expect(200);

      await get().expect(404);
    });
  });
});
