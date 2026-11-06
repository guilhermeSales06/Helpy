import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { vi } from 'vitest';
import { AppRouter, createAppRouter } from '../app/router';
import {
  AuthContext,
  type AuthContextValue,
  type User,
} from '../features/auth/use-auth';
import type { Ticket } from '../features/tickets/ticket-model';

export const ME = '6f1c1c8e-0000-4000-8000-0000000000a1';
export const TECH_ID = '6f1c1c8e-0000-4000-8000-0000000000b2';
export const CATEGORY_ID = '6f1c1c8e-0000-4000-8000-0000000000c3';
export const AREA_ID = '6f1c1c8e-0000-4000-8000-0000000000e5';

export function makeUser(
  role: User['role'] = 'TECHNICIAN',
  overrides: Partial<User> = {},
): User {
  return {
    id: ME,
    name: 'Junior Silva',
    email: 'junior@helpy.test',
    role,
    phone: null,
    specialty: null,
    areas: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function ticketId(n: number): string {
  return `6f1c1c8e-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function makeTicket(n: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: ticketId(n),
    number: 4800 + n,
    title: `Chamado número ${n}`,
    description: 'Descrição',
    status: 'OPEN',
    priority: 'NORMAL',
    client: {
      id: '6f1c1c8e-0000-4000-8000-0000000000f6',
      name: 'Mariana Costa',
      email: 'mariana@helpy.test',
    },
    technician: null,
    category: {
      id: CATEGORY_ID,
      name: 'Acesso e senhas',
      area: { id: AREA_ID, name: 'Suporte' },
    },
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    ...overrides,
  };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function listBody(
  items: unknown[],
  meta: { page?: number; limit?: number; total?: number } = {},
) {
  const limit = meta.limit ?? 20;
  const total = meta.total ?? items.length;
  return {
    data: items,
    meta: {
      page: meta.page ?? 1,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const ZERO_COUNTS = {
  OPEN: 0,
  IN_PROGRESS: 0,
  PENDING: 0,
  RESOLVED: 0,
  CLOSED: 0,
};

type Handler = (url: URL, request: Request) => Response | Promise<Response>;

/** Answers the API with empty data; `routes` replaces an answer by pathname. */
export function mockApi(routes: Record<string, Handler> = {}) {
  const requests: URL[] = [];
  const handlers: Record<string, Handler> = {
    '/api/v1/tickets': () => json(listBody([])),
    '/api/v1/tickets/counts': () =>
      json({ total: 0, byStatus: { ...ZERO_COUNTS } }),
    '/api/v1/categories': () => json([]),
    '/api/v1/users': () => json(listBody([])),
    ...routes,
  };
  const fetchMock = vi.fn(async (input: Request) => {
    const url = new URL(input.url);
    requests.push(url);
    const handler = handlers[url.pathname];
    return handler ? handler(url, input) : json({ message: 'Not found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    requests,
    to: (pathname: string) => requests.filter((u) => u.pathname === pathname),
    lastList: () =>
      requests.filter((u) => u.pathname === '/api/v1/tickets').at(-1),
  };
}

export async function renderApp(path: string, user: User = makeUser()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const value: AuthContextValue = {
    state: { status: 'authenticated', user },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    retry: vi.fn(),
  };
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  await act(async () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext value={value}>
          <AppRouter router={router} />
        </AuthContext>
      </QueryClientProvider>,
    ),
  );
  return { router, queryClient };
}
