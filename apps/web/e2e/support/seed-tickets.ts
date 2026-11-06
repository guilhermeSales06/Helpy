// Builds the data of a ticket scenario through the API, so each test starts
// from its own area, technicians, client and tickets. Every name carries a
// suffix that is unique per call, so reruns never collide.

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';
const API = `${API_TARGET}/api/v1`;

const PASSWORD = 'Senha1234';

type Method = 'GET' | 'POST' | 'PATCH';

async function request<T>(
  method: Method,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${path} answered ${response.status}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

async function loginAdmin(): Promise<string> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD (the seeded admin).');
  }
  const { accessToken } = await request<{ accessToken: string }>(
    'POST',
    '/auth/login',
    { body: { email, password } },
  );
  return accessToken;
}

export type Account = { email: string; password: string; name: string };
export type SeededTicket = { id: string; number: number; title: string };

export type TicketScenario = {
  /** Unique text shared by every name of this scenario: search for it. */
  run: string;
  area: { id: string; name: string };
  category: { id: string; name: string };
  /** Both technicians work in `area`. */
  technician: Account & { id: string };
  otherTechnician: Account & { id: string };
  client: Account;
  tickets: {
    /** OPEN, no technician, in `area`: both technicians see it. */
    open: SeededTicket;
    /** OPEN, in another area: neither technician sees it. */
    otherAreaOpen: SeededTicket;
  };
};

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

async function loginClient({ email, password }: Account): Promise<string> {
  const { accessToken } = await request<{ accessToken: string }>(
    'POST',
    '/auth/login',
    { body: { email, password } },
  );
  return accessToken;
}

/** Opens one more ticket, as the scenario's client. */
export async function openTicket(
  scenario: Pick<TicketScenario, 'client'>,
  categoryId: string,
  title: string,
  priority?: Priority,
): Promise<SeededTicket> {
  const token = await loginClient(scenario.client);
  const ticket = await request<SeededTicket>('POST', '/tickets', {
    token,
    body: {
      title,
      description: `Descrição de ${title}`,
      categoryId,
      ...(priority && { priority }),
    },
  });
  return { id: ticket.id, number: ticket.number, title: ticket.title };
}

export async function seedTickets(): Promise<TicketScenario> {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const admin = await loginAdmin();

  const area = await request<{ id: string; name: string }>('POST', '/areas', {
    token: admin,
    body: { name: `Area ${run}` },
  });
  const otherArea = await request<{ id: string; name: string }>(
    'POST',
    '/areas',
    { token: admin, body: { name: `Outra area ${run}` } },
  );
  const category = await request<{ id: string; name: string }>(
    'POST',
    '/categories',
    { token: admin, body: { name: `Categoria ${run}`, areaId: area.id } },
  );
  const otherCategory = await request<{ id: string }>('POST', '/categories', {
    token: admin,
    body: { name: `Outra categoria ${run}`, areaId: otherArea.id },
  });

  async function createTechnician(label: string) {
    const account = {
      name: `Tecnico ${label} ${run}`,
      email: `tec-${label}-${run}@helpy.test`,
      password: PASSWORD,
    };
    const { id } = await request<{ id: string }>('POST', '/users', {
      token: admin,
      body: { ...account, role: 'TECHNICIAN', areaIds: [area.id] },
    });
    return { ...account, id };
  }
  const technician = await createTechnician('a');
  const otherTechnician = await createTechnician('b');

  const client: Account = {
    name: `Cliente ${run}`,
    email: `cli-${run}@helpy.test`,
    password: PASSWORD,
  };
  await request('POST', '/auth/register', { body: client });

  const scenario = { client };
  const open = await openTicket(scenario, category.id, `Impressora ${run}`);
  const otherAreaOpen = await openTicket(
    scenario,
    otherCategory.id,
    `Rede ${run}`,
  );

  return {
    run,
    area,
    category,
    technician,
    otherTechnician,
    client,
    tickets: { open, otherAreaOpen },
  };
}
