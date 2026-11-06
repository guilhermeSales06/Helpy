import type { operations } from '../../shared/api/schema';
import type { User } from '../auth/use-auth';
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  type TicketPriority,
  type TicketStatus,
} from './ticket-model';

export type Sort = 'newest' | 'updated' | 'oldest' | 'priority';

/** Query string the API accepts on `GET /api/v1/tickets`. */
export type ApiTicketQuery = NonNullable<
  operations['TicketsController_findAll']['parameters']['query']
>;

/** Filters kept in the URL of `/chamados`. */
export type TicketSearch = {
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Category id. */
  category?: string;
  /** `me`, `none` or a technician id. */
  assignee?: string;
  q?: string;
  sort: Sort;
  page: number;
};

export const SORTS: readonly Sort[] = [
  'newest',
  'updated',
  'oldest',
  'priority',
];

export const MAX_QUERY_LENGTH = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((item) => item === value);
}

function parsePage(value: unknown): number {
  const page =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : 0;
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function parseQuery(value: unknown): string | undefined {
  // The router turns `?q=4821` into the number 4821.
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  const trimmed = text.trim().slice(0, MAX_QUERY_LENGTH);
  return trimmed === '' ? undefined : trimmed;
}

function parseAssignee(value: unknown): string | undefined {
  if (value === 'me' || value === 'none') return value;
  return typeof value === 'string' && UUID.test(value) ? value : undefined;
}

/** Reads the URL's search params; anything invalid falls back to the default. */
export function parseTicketSearch(raw: Record<string, unknown>): TicketSearch {
  const status = pick(raw.status, Object.keys(STATUS_LABELS) as TicketStatus[]);
  const priority = pick(
    raw.priority,
    Object.keys(PRIORITY_LABELS) as TicketPriority[],
  );
  const category =
    typeof raw.category === 'string' && UUID.test(raw.category)
      ? raw.category
      : undefined;
  const assignee = parseAssignee(raw.assignee);
  const q = parseQuery(raw.q);

  // Every key is present, even when empty: the router merges this over the raw
  // search params, so an absent key would let an invalid raw value through.
  return {
    status,
    priority,
    category,
    assignee,
    q,
    sort: pick(raw.sort, SORTS) ?? 'newest',
    page: parsePage(raw.page),
  };
}

/** The filters the API takes for a list, with `me` resolved to the user's id. */
export function toApiQuery(search: TicketSearch, me: string): ApiTicketQuery {
  const { status, priority, category, assignee, q, sort, page } = search;
  return {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(category && { categoryId: category }),
    ...(assignee === 'none'
      ? { unassigned: true }
      : assignee && { technicianId: assignee === 'me' ? me : assignee }),
    ...(q && { q }),
    sort,
    page,
  };
}

/**
 * Takes out what this role cannot use. A technician id is for admins only,
 * and an admin does not take tickets, so `me` means nothing to them. The
 * same object comes back when there is nothing to take out.
 */
export function restrictSearch(
  search: TicketSearch,
  role: User['role'],
): TicketSearch {
  const { assignee } = search;
  const allowed =
    assignee === undefined ||
    assignee === 'none' ||
    (assignee === 'me' ? role !== 'ADMIN' : role === 'ADMIN');
  return allowed ? search : { ...search, assignee: undefined };
}
