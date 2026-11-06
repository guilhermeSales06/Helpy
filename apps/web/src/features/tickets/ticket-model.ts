import type { components } from '../../shared/api/schema';
import type { User } from '../auth/use-auth';

export type Ticket = components['schemas']['TicketResponseDto'];
export type TicketStatus = components['schemas']['TicketStatus'];
export type TicketPriority = components['schemas']['TicketPriority'];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  PENDING: 'Pendente',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

export const STATUS_COLORS: Record<TicketStatus, { fg: string; bg: string }> = {
  OPEN: { fg: '#2457A8', bg: '#EEF3FB' },
  IN_PROGRESS: { fg: '#8A5300', bg: '#FBF2E2' },
  PENDING: { fg: '#5E45A3', bg: '#F3F0FA' },
  RESOLVED: { fg: '#22704A', bg: '#EAF4EE' },
  CLOSED: { fg: '#57524D', bg: '#F5F3F1' },
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

/** `4821` becomes `#4821`. */
export function formatNumber(n: number): string {
  return `#${n}`;
}

export type TicketAction =
  | 'take'
  | 'release'
  | 'pending'
  | 'resume'
  | 'resolve'
  | 'reopen'
  | 'assign'
  | 'changePriority';

/**
 * What this person may do with this ticket, mirroring the API rules (the API
 * still decides; this only keeps buttons that would fail off the screen).
 * Only a technician takes or releases; an admin never does.
 */
export function allowedActions(ticket: Ticket, user: User): TicketAction[] {
  const { status } = ticket;
  if (status === 'CLOSED') return [];

  if (user.role === 'TECHNICIAN') {
    if (ticket.technician === null) {
      return status === 'OPEN' ? ['take'] : [];
    }
    if (ticket.technician.id !== user.id) return [];
    return [
      ...(status === 'IN_PROGRESS' || status === 'PENDING'
        ? (['release'] as const)
        : []),
      ...statusActions(status),
      'changePriority',
    ];
  }

  if (user.role === 'ADMIN') {
    return [
      ...(status === 'OPEN' || status === 'IN_PROGRESS' || status === 'PENDING'
        ? (['assign'] as const)
        : []),
      ...statusActions(status),
      'changePriority',
    ];
  }

  return [];
}

function statusActions(status: TicketStatus): TicketAction[] {
  switch (status) {
    case 'IN_PROGRESS':
      return ['pending', 'resolve'];
    case 'PENDING':
      return ['resume'];
    case 'RESOLVED':
      return ['reopen'];
    default:
      return [];
  }
}
