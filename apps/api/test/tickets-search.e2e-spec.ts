import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  Role,
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

describe('Ticket search, sort and counts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: { admin: string; technician: string; otherTechnician: string };
  let ids: { client: string; technician: string };
  let hardwareCategory: string;
  let networkCategory: string;

  const get = (path: string, token = tokens.admin) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  let clock = Date.UTC(2026, 0, 1);
  const make = (
    title: string,
    extra: Partial<{
      priority: TicketPriority;
      status: TicketStatus;
      categoryId: string;
      technicianId: string | null;
      createdAt: Date;
      updatedAt: Date;
      number: number;
    }> = {},
  ) => {
    clock += 60_000;
    return prisma.ticket.create({
      data: {
        title,
        description: 'desc',
        clientId: ids.client,
        categoryId: hardwareCategory,
        createdAt: new Date(clock),
        ...extra,
      },
    });
  };

  const titles = async (query: string, token = tokens.admin) => {
    const { body } = await get(`${TICKETS}?${query}`, token).expect(200);
    return (body.data as { title: string }[]).map((t) => t.title);
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
    const technician = await createTechnician(prisma, 'tech@test.local', [
      hardware.areaId,
    ]);
    const otherTechnician = await createTechnician(prisma, 'tech2@test.local', [
      network.areaId,
    ]);
    ids = { client: client.id, technician: technician.id };
    tokens = {
      admin: (await login(app, admin.email)).accessToken,
      technician: (await login(app, technician.email)).accessToken,
      otherTechnician: (await login(app, otherTechnician.email)).accessToken,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds tickets by title, ignoring case', async () => {
    await make('Impressora parada');
    await make('Monitor quebrado');
    expect(await titles('q=IMPRESS')).toEqual(['Impressora parada']);
    expect(await titles('q=%20%20monitor%20')).toEqual(['Monitor quebrado']);
  });

  it('finds a ticket by number with or without #', async () => {
    const target = await make('Sem relação');
    await make('Outro');
    expect(await titles(`q=${target.number}`)).toContain('Sem relação');
    expect(
      await titles(`q=${encodeURIComponent('#' + target.number)}`),
    ).toEqual(['Sem relação']);
    expect(await titles(`q=${target.number}`)).toEqual(['Sem relação']);
  });

  it('treats %, _ and \\ as literal text', async () => {
    await make('100% pronto');
    await make('axb');
    await make('a_b');
    await make('caminho\\rede');
    expect(await titles('q=%25')).toEqual(['100% pronto']);
    expect(await titles('q=a_b')).toEqual(['a_b']);
    expect(await titles('q=_')).toEqual(['a_b']);
    expect(await titles('q=%5C')).toEqual(['caminho\\rede']);
  });

  it('does not crash on 0, a huge number, spaces only, or an e-mail-looking text', async () => {
    await make('Qualquer');
    expect(await titles('q=0')).toEqual([]);
    expect(await titles('q=99999999999')).toEqual([]);
    expect(await titles('q=%2399999999999999999999')).toEqual([]);
    expect(await titles('q=%20%20%20')).toEqual(['Qualquer']);
    expect(await titles('q=a%40b.com')).toEqual([]);
  });

  it('rejects q longer than 100 characters with 400', async () => {
    await get(`${TICKETS}?q=${'a'.repeat(101)}`).expect(400);
    await get(`${TICKETS}?q=${'a'.repeat(100)}`).expect(200);
  });

  it('never lets a technician find a ticket outside his scope, by title or by number', async () => {
    const hidden = await make('Segredo de rede', {
      categoryId: networkCategory,
    });
    const seen = await make('Segredo de hardware');
    expect(await titles('q=segredo', tokens.technician)).toEqual([
      'Segredo de hardware',
    ]);
    expect(await titles(`q=${hidden.number}`, tokens.technician)).toEqual([]);
    expect(await titles(`q=%23${hidden.number}`, tokens.technician)).toEqual(
      [],
    );
    expect(await titles(`q=${seen.number}`, tokens.technician)).toEqual([
      'Segredo de hardware',
    ]);
  });

  it('sorts by newest (default), updated, oldest and priority with a stable tie-break', async () => {
    const a = await make('A');
    await make('B');
    await make('C');
    await prisma.ticket.update({
      where: { id: a.id },
      data: { updatedAt: new Date(Date.UTC(2030, 0, 1)) },
    });
    expect(await titles('')).toEqual(['C', 'B', 'A']);
    expect(await titles('sort=newest')).toEqual(['C', 'B', 'A']);
    expect(await titles('sort=oldest')).toEqual(['A', 'B', 'C']);
    expect((await titles('sort=updated'))[0]).toBe('A');

    // Same createdAt: the id breaks the tie, so pages never overlap.
    const same = new Date(Date.UTC(2031, 0, 1));
    await make('D', { createdAt: same });
    await make('E', { createdAt: same });
    await make('F', { createdAt: same });
    const page1 = await titles('sort=oldest&limit=3&page=1');
    const page2 = await titles('sort=oldest&limit=3&page=2');
    const page3 = await titles('sort=oldest&limit=3&page=3');
    const all = [...page1, ...page2, ...page3];
    expect(new Set(all).size).toBe(6);
  });

  it('priority sort puts URGENT first and older first inside the same priority', async () => {
    await make('low', { priority: TicketPriority.LOW });
    await make('urgent new', { priority: TicketPriority.URGENT });
    await make('normal old', { priority: TicketPriority.NORMAL });
    await make('high', { priority: TicketPriority.HIGH });
    await make('normal new', { priority: TicketPriority.NORMAL });
    await make('urgent old', {
      priority: TicketPriority.URGENT,
      createdAt: new Date(Date.UTC(2020, 0, 1)),
    });
    expect(await titles('sort=priority')).toEqual([
      'urgent old',
      'urgent new',
      'high',
      'normal old',
      'normal new',
      'low',
    ]);
  });

  it('rejects an unknown sort with 400', async () => {
    await get(`${TICKETS}?sort=foo`).expect(400);
  });
});
