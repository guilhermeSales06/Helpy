import { Role, TicketStatus } from '../generated/prisma/enums.js';

const { OPEN, IN_PROGRESS, RESOLVED, CLOSED } = TicketStatus;
const { ADMIN, TECHNICIAN, CLIENT } = Role;

// Closing is the client's confirmation that the problem is solved. Admins can
// also close, so that a ticket doesn't stay resolved forever if the client
// never answers.
const TRANSITIONS: { from: TicketStatus; to: TicketStatus; roles: Role[] }[] = [
  { from: OPEN, to: IN_PROGRESS, roles: [TECHNICIAN, ADMIN] },
  { from: IN_PROGRESS, to: RESOLVED, roles: [TECHNICIAN, ADMIN] },
  { from: RESOLVED, to: CLOSED, roles: [CLIENT, ADMIN] },
  { from: RESOLVED, to: IN_PROGRESS, roles: [CLIENT, TECHNICIAN, ADMIN] },
];

export type TransitionCheck = 'allowed' | 'invalid' | 'forbidden';

export function checkTransition(
  from: TicketStatus,
  to: TicketStatus,
  role: Role,
): TransitionCheck {
  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) return 'invalid';
  return transition.roles.includes(role) ? 'allowed' : 'forbidden';
}
