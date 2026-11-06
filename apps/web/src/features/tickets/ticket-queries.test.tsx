import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../../shared/api/token-store';
import {
  ticketCountsQuery,
  ticketListQuery,
  ticketQuery,
  useAssignTicket,
  useChangeTicketPriority,
  useChangeTicketStatus,
  useReleaseTicket,
  useTakeTicket,
  type TicketMutationResult,
} from './ticket-queries';
import type { TicketSearch } from './ticket-search';

const ME = '6f1c1c8e-0000-4000-8000-0000000000a1';
const TECH = '6f1c1c8e-0000-4000-8000-0000000000b2';
const CATEGORY = '6f1c1c8e-0000-4000-8000-0000000000c3';
const ID = '6f1c1c8e-0000-4000-8000-0000000000d4';

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastRequest(): Request {
  const call = fetchMock.mock.calls.at(-1);
  return call![0] as Request;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken('token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

const full: TicketSearch = {
  status: 'OPEN',
  priority: 'HIGH',
  category: CATEGORY,
  assignee: 'me',
  q: '#12',
  sort: 'priority',
  page: 3,
};

describe('ticketListQuery', () => {
  it('keys on the filters and on the user', () => {
    const a = ticketListQuery(full, ME).queryKey;
    expect(a).not.toEqual(ticketListQuery({ ...full, page: 4 }, ME).queryKey);
    expect(a).not.toEqual(ticketListQuery(full, TECH).queryKey);
    expect(a).toEqual(ticketListQuery({ ...full }, ME).queryKey);
  });

  it('sends the filters, sort and page to the API', async () => {
    fetchMock.mockImplementation(async () => json({ data: [], meta: {} }));
    await new QueryClient().fetchQuery(ticketListQuery(full, ME));
    const url = new URL(lastRequest().url);
    expect(url.pathname).toBe('/api/v1/tickets');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'OPEN',
      priority: 'HIGH',
      categoryId: CATEGORY,
      technicianId: ME,
      q: '#12',
      sort: 'priority',
      page: '3',
    });
  });
});

describe('ticketCountsQuery', () => {
  it('sends only the filters the counts endpoint accepts', async () => {
    fetchMock.mockImplementation(async () => json({ total: 0, byStatus: {} }));
    await new QueryClient().fetchQuery(ticketCountsQuery(full, ME));
    const url = new URL(lastRequest().url);
    expect(url.pathname).toBe('/api/v1/tickets/counts');
    const sent = Object.fromEntries(url.searchParams);
    expect(sent).toEqual({
      priority: 'HIGH',
      categoryId: CATEGORY,
      technicianId: ME,
      q: '#12',
    });
    for (const forbidden of ['status', 'sort', 'page', 'limit']) {
      expect(url.searchParams.has(forbidden)).toBe(false);
    }
  });

  it('sends unassigned for the queue and nothing else when no filter is set', async () => {
    fetchMock.mockImplementation(async () => json({ total: 0, byStatus: {} }));
    const client = new QueryClient();
    await client.fetchQuery(
      ticketCountsQuery({ assignee: 'none', sort: 'oldest', page: 2 }, ME),
    );
    expect(new URL(lastRequest().url).search).toBe('?unassigned=true');
    await client.fetchQuery(ticketCountsQuery({ sort: 'newest', page: 1 }, ME));
    expect(new URL(lastRequest().url).search).toBe('');
  });

  it('shares its cache between lists that differ only by status, sort or page', () => {
    const base = ticketCountsQuery({ ...full }, ME).queryKey;
    expect(
      ticketCountsQuery(
        { ...full, status: 'PENDING', page: 9, sort: 'oldest' },
        ME,
      ).queryKey,
    ).toEqual(base);
    expect(ticketCountsQuery(full, TECH).queryKey).not.toEqual(base);
  });
});

describe('ticketQuery', () => {
  it('fetches one ticket by id', async () => {
    fetchMock.mockImplementation(async () => json({ id: ID }));
    const data = await new QueryClient().fetchQuery(ticketQuery(ID));
    expect(data).toEqual({ id: ID });
    expect(new URL(lastRequest().url).pathname).toBe(`/api/v1/tickets/${ID}`);
  });

  it('fails with the HTTP status so the screen can tell 404 apart', async () => {
    fetchMock.mockImplementation(async () =>
      json({ message: 'Not found' }, 404),
    );
    await expect(
      new QueryClient().fetchQuery({ ...ticketQuery(ID), retry: false }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

describe('ticket mutations', () => {
  it.each([
    [
      'take',
      () => useTakeTicket(),
      { id: ID },
      `/api/v1/tickets/${ID}/take`,
      undefined,
    ],
    [
      'release',
      () => useReleaseTicket(),
      { id: ID },
      `/api/v1/tickets/${ID}/release`,
      undefined,
    ],
    [
      'status',
      () => useChangeTicketStatus(),
      { id: ID, status: 'PENDING' as const },
      `/api/v1/tickets/${ID}/status`,
      { status: 'PENDING' },
    ],
    [
      'priority',
      () => useChangeTicketPriority(),
      { id: ID, priority: 'URGENT' as const },
      `/api/v1/tickets/${ID}/priority`,
      { priority: 'URGENT' },
    ],
    [
      'assign',
      () => useAssignTicket(),
      { id: ID, technicianId: TECH },
      `/api/v1/tickets/${ID}/assign`,
      { technicianId: TECH },
    ],
  ])(
    '%s: PATCHes the right path and body, then reloads',
    async (_n, hook, vars, path, body) => {
      fetchMock.mockImplementation(async () => json({ id: ID }));
      const { wrapper, invalidate } = setup();
      const { result } = renderHook(
        hook as () => ReturnType<typeof useTakeTicket>,
        {
          wrapper,
        },
      );

      let outcome: TicketMutationResult | undefined;
      await act(async () => {
        outcome = await result.current.mutateAsync(vars as never);
      });

      expect(outcome).toBe('ok');
      const request = lastRequest();
      expect(request.method).toBe('PATCH');
      expect(new URL(request.url).pathname).toBe(path);
      if (body) expect(await request.clone().json()).toEqual(body);
      const keys = invalidate.mock.calls.map(([filter]) => filter?.queryKey);
      expect(keys).toEqual(
        expect.arrayContaining([
          ['tickets', 'list'],
          ['tickets', 'counts'],
          ['tickets', 'detail', ID],
        ]),
      );
    },
  );

  it.each([
    [200, 'ok'],
    [409, 'conflict'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'unavailable'],
    [502, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, expected) => {
    fetchMock.mockImplementation(async () => json({}, status));
    const { wrapper } = setup();
    const { result } = renderHook(() => useTakeTicket(), { wrapper });
    let outcome: TicketMutationResult | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: ID });
    });
    expect(outcome).toBe(expected);
  });

  it('maps a network failure to unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useReleaseTicket(), { wrapper });
    let outcome: TicketMutationResult | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({ id: ID });
    });
    expect(outcome).toBe('unavailable');
  });

  it('reloads the ticket even when another person got there first (409)', async () => {
    fetchMock.mockImplementation(async () => json({}, 409));
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useTakeTicket(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: ID });
    });
    await waitFor(() =>
      expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toContainEqual([
        'tickets',
        'detail',
        ID,
      ]),
    );
  });
});
