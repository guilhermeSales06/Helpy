import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import type { operations } from '../../shared/api/schema';
import type { TicketPriority, TicketStatus } from './ticket-model';
import { toApiQuery, type TicketSearch } from './ticket-search';

/** A request that came back with an error status. */
export class TicketRequestError extends Error {
  constructor(readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof TicketRequestError && error.status === 404;
}

const keys = {
  all: ['tickets'] as const,
  lists: ['tickets', 'list'] as const,
  counts: ['tickets', 'counts'] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
};

type ApiCountsQuery = NonNullable<
  operations['TicketsController_counts']['parameters']['query']
>;

/**
 * The counts endpoint answers 400 to `status`, `sort`, `page` and `limit`, so
 * only the filters it accepts go out.
 */
function toCountsQuery(search: TicketSearch, me: string): ApiCountsQuery {
  const { priority, categoryId, technicianId, unassigned, q } = toApiQuery(
    search,
    me,
  );
  return {
    ...(priority && { priority }),
    ...(categoryId && { categoryId }),
    ...(technicianId && { technicianId }),
    ...(unassigned !== undefined && { unassigned }),
    ...(q && { q }),
  };
}

export function ticketListQuery(search: TicketSearch, me: string) {
  const query = toApiQuery(search, me);
  return queryOptions({
    queryKey: [...keys.lists, me, query] as const,
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/tickets', {
        params: { query },
      });
      if (!data) throw new TicketRequestError(response.status);
      return data;
    },
  });
}

export function ticketCountsQuery(search: TicketSearch, me: string) {
  const query = toCountsQuery(search, me);
  return queryOptions({
    queryKey: [...keys.counts, me, query] as const,
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/tickets/counts', {
        params: { query },
      });
      if (!data) throw new TicketRequestError(response.status);
      return data;
    },
  });
}

const FIVE_MINUTES = 5 * 60_000;

/** The categories a ticket can have, for the filter menu. */
export function categoriesQuery() {
  return queryOptions({
    queryKey: ['categories'] as const,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/categories', {});
      if (!data) throw new TicketRequestError(response.status);
      return data;
    },
  });
}

/**
 * The active technicians, for the admin's "Responsável" filter. The users
 * endpoint answers admins only, and takes at most 100 per page.
 */
export function techniciansQuery() {
  return queryOptions({
    queryKey: ['users', 'technicians'] as const,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/users', {
        params: { query: { role: 'TECHNICIAN', active: true, limit: 100 } },
      });
      if (!data) throw new TicketRequestError(response.status);
      return data.data;
    },
  });
}

export function ticketQuery(id: string) {
  return queryOptions({
    queryKey: keys.detail(id),
    queryFn: async () => {
      const { data, response } = await api.GET('/api/v1/tickets/{id}', {
        params: { path: { id } },
      });
      if (!data) throw new TicketRequestError(response.status);
      return data;
    },
  });
}

export type TicketMutationResult =
  'ok' | 'conflict' | 'forbidden' | 'not-found' | 'unavailable';

function resultFor(status: number): TicketMutationResult {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 409) return 'conflict';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'unavailable';
}

/** Runs the request; never throws, so a screen can show the right message. */
async function settle(
  request: () => Promise<{ response: Response }>,
): Promise<TicketMutationResult> {
  try {
    const { response } = await request();
    return resultFor(response.status);
  } catch {
    return 'unavailable';
  }
}

// Whatever the outcome, the screen reloads: after a 409 the ticket is not as
// the person saw it, so the list, the counts and the ticket are read again.
function reload(queryClient: QueryClient, id: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.lists }),
    queryClient.invalidateQueries({ queryKey: keys.counts }),
    queryClient.invalidateQueries({ queryKey: keys.detail(id) }),
  ]);
}

function useTicketMutation<V extends { id: string }>(
  run: (vars: V) => Promise<TicketMutationResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: (_result, _error, vars) => reload(queryClient, vars.id),
  });
}

export function useTakeTicket() {
  return useTicketMutation(({ id }: { id: string }) =>
    settle(() =>
      api.PATCH('/api/v1/tickets/{id}/take', { params: { path: { id } } }),
    ),
  );
}

export function useReleaseTicket() {
  return useTicketMutation(({ id }: { id: string }) =>
    settle(() =>
      api.PATCH('/api/v1/tickets/{id}/release', { params: { path: { id } } }),
    ),
  );
}

export function useChangeTicketStatus() {
  return useTicketMutation(
    ({ id, status }: { id: string; status: TicketStatus }) =>
      settle(() =>
        api.PATCH('/api/v1/tickets/{id}/status', {
          params: { path: { id } },
          body: { status },
        }),
      ),
  );
}

export function useChangeTicketPriority() {
  return useTicketMutation(
    ({ id, priority }: { id: string; priority: TicketPriority }) =>
      settle(() =>
        api.PATCH('/api/v1/tickets/{id}/priority', {
          params: { path: { id } },
          body: { priority },
        }),
      ),
  );
}

export function useAssignTicket() {
  return useTicketMutation(
    ({ id, technicianId }: { id: string; technicianId: string }) =>
      settle(() =>
        api.PATCH('/api/v1/tickets/{id}/assign', {
          params: { path: { id } },
          body: { technicianId },
        }),
      ),
  );
}
