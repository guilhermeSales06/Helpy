import { describe, expect, it } from 'vitest';
import type { User } from '../auth/use-auth';
import {
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  allowedActions,
  formatNumber,
  type Ticket,
  type TicketAction,
  type TicketStatus,
} from './ticket-model';

const ME = '6f1c1c8e-0000-4000-8000-0000000000a1';
const OTHER = '6f1c1c8e-0000-4000-8000-0000000000b2';

function user(role: User['role'], id = ME): User {
  return {
    id,
    name: 'Pessoa',
    email: 'pessoa@helpy.test',
    role,
    phone: null,
    specialty: null,
    areas: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

type Who = 'nobody' | 'me' | 'other';

function ticket(status: TicketStatus, who: Who): Ticket {
  const technicianId = who === 'me' ? ME : who === 'other' ? OTHER : null;
  return {
    id: '6f1c1c8e-0000-4000-8000-0000000000c3',
    number: 4821,
    title: 'Impressora parada',
    description: 'Não imprime',
    status,
    priority: 'NORMAL',
    client: {
      id: '6f1c1c8e-0000-4000-8000-0000000000d4',
      name: 'Ana',
      email: 'ana@helpy.test',
    },
    technician: technicianId ? { id: technicianId, name: 'Téc' } : null,
    category: {
      id: '6f1c1c8e-0000-4000-8000-0000000000e5',
      name: 'Hardware',
    },
    resolvedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  } as Ticket;
}

type Row = [string, User['role'], TicketStatus, Who, TicketAction[]];

const rows: Row[] = [
  // Technician, ticket assigned to them
  ['tech mine OPEN', 'TECHNICIAN', 'OPEN', 'me', ['start', 'changePriority']],
  [
    'tech mine IN_PROGRESS',
    'TECHNICIAN',
    'IN_PROGRESS',
    'me',
    ['release', 'pending', 'resolve', 'changePriority'],
  ],
  [
    'tech mine PENDING',
    'TECHNICIAN',
    'PENDING',
    'me',
    ['release', 'resume', 'changePriority'],
  ],
  [
    'tech mine RESOLVED',
    'TECHNICIAN',
    'RESOLVED',
    'me',
    ['reopen', 'changePriority'],
  ],
  ['tech mine CLOSED', 'TECHNICIAN', 'CLOSED', 'me', []],
  // Technician, queue (nobody assigned)
  ['tech queue OPEN', 'TECHNICIAN', 'OPEN', 'nobody', ['take']],
  ['tech queue IN_PROGRESS', 'TECHNICIAN', 'IN_PROGRESS', 'nobody', []],
  ['tech queue PENDING', 'TECHNICIAN', 'PENDING', 'nobody', []],
  ['tech queue RESOLVED', 'TECHNICIAN', 'RESOLVED', 'nobody', []],
  ['tech queue CLOSED', 'TECHNICIAN', 'CLOSED', 'nobody', []],
  // Technician, someone else's ticket
  ['tech other OPEN', 'TECHNICIAN', 'OPEN', 'other', []],
  ['tech other IN_PROGRESS', 'TECHNICIAN', 'IN_PROGRESS', 'other', []],
  ['tech other PENDING', 'TECHNICIAN', 'PENDING', 'other', []],
  ['tech other RESOLVED', 'TECHNICIAN', 'RESOLVED', 'other', []],
  ['tech other CLOSED', 'TECHNICIAN', 'CLOSED', 'other', []],
  // Admin, with and without technician
  ...(['nobody', 'other'] as const).flatMap((who): Row[] => [
    [
      `admin ${who} OPEN`,
      'ADMIN',
      'OPEN',
      who,
      who === 'nobody'
        ? ['assign', 'changePriority']
        : ['assign', 'start', 'changePriority'],
    ],
    [
      `admin ${who} IN_PROGRESS`,
      'ADMIN',
      'IN_PROGRESS',
      who,
      ['assign', 'pending', 'resolve', 'changePriority'],
    ],
    [
      `admin ${who} PENDING`,
      'ADMIN',
      'PENDING',
      who,
      ['assign', 'resume', 'changePriority'],
    ],
    [
      `admin ${who} RESOLVED`,
      'ADMIN',
      'RESOLVED',
      who,
      ['reopen', 'changePriority'],
    ],
    [`admin ${who} CLOSED`, 'ADMIN', 'CLOSED', who, []],
  ]),
  // Client: the client screen belongs to a later slice
  ['client OPEN', 'CLIENT', 'OPEN', 'nobody', []],
  ['client IN_PROGRESS', 'CLIENT', 'IN_PROGRESS', 'other', []],
  ['client PENDING', 'CLIENT', 'PENDING', 'other', []],
  ['client RESOLVED', 'CLIENT', 'RESOLVED', 'other', []],
  ['client CLOSED', 'CLIENT', 'CLOSED', 'other', []],
];

describe('formatNumber', () => {
  it('formats the number as #4821', () => {
    expect(formatNumber(4821)).toBe('#4821');
    expect(formatNumber(7)).toBe('#7');
  });
});

describe('labels', () => {
  it('has a Portuguese label and colors for every status', () => {
    expect(STATUS_LABELS).toEqual({
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      PENDING: 'Pendente',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
    });
    expect(STATUS_COLORS.OPEN).toEqual({ fg: '#2457A8', bg: '#EEF3FB' });
    expect(STATUS_COLORS.IN_PROGRESS).toEqual({ fg: '#8A5300', bg: '#FBF2E2' });
    expect(STATUS_COLORS.PENDING).toEqual({ fg: '#5E45A3', bg: '#F3F0FA' });
    expect(STATUS_COLORS.RESOLVED).toEqual({ fg: '#22704A', bg: '#EAF4EE' });
    expect(STATUS_COLORS.CLOSED).toEqual({ fg: '#57524D', bg: '#F5F3F1' });
  });

  it('has a Portuguese label for every priority', () => {
    expect(PRIORITY_LABELS).toEqual({
      LOW: 'Baixa',
      NORMAL: 'Média',
      HIGH: 'Alta',
      URGENT: 'Urgente',
    });
  });
});

describe('allowedActions', () => {
  it.each(rows)('allowedActions: %s', (_name, role, status, who, expected) => {
    expect(allowedActions(ticket(status, who), user(role))).toEqual(expected);
  });

  it('gives an admin no take or release, ever', () => {
    const statuses = Object.keys(STATUS_LABELS) as TicketStatus[];
    for (const status of statuses) {
      for (const who of ['nobody', 'me', 'other'] as const) {
        const actions = allowedActions(ticket(status, who), user('ADMIN'));
        expect(actions).not.toContain('take');
        expect(actions).not.toContain('release');
      }
    }
  });

  it('gives nobody any action on a CLOSED ticket', () => {
    for (const role of ['CLIENT', 'TECHNICIAN', 'ADMIN'] as const) {
      for (const who of ['nobody', 'me', 'other'] as const) {
        expect(allowedActions(ticket('CLOSED', who), user(role))).toEqual([]);
      }
    }
  });
});
