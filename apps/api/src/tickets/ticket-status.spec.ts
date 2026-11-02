import { Role, TicketStatus } from '../generated/prisma/enums.js';
import { checkTransition, TransitionCheck } from './ticket-status.js';

const { OPEN, IN_PROGRESS, RESOLVED, CLOSED } = TicketStatus;
const { ADMIN, TECHNICIAN, CLIENT } = Role;

describe('checkTransition', () => {
  const statuses = Object.values(TicketStatus);
  const roles = Object.values(Role);

  // Everything not listed here must be rejected.
  const allowed: [TicketStatus, TicketStatus, Role][] = [
    [OPEN, IN_PROGRESS, TECHNICIAN],
    [OPEN, IN_PROGRESS, ADMIN],
    [IN_PROGRESS, RESOLVED, TECHNICIAN],
    [IN_PROGRESS, RESOLVED, ADMIN],
    [RESOLVED, CLOSED, CLIENT],
    [RESOLVED, CLOSED, ADMIN],
    [RESOLVED, IN_PROGRESS, CLIENT],
    [RESOLVED, IN_PROGRESS, TECHNICIAN],
    [RESOLVED, IN_PROGRESS, ADMIN],
  ];
  const validEdges = new Set(allowed.map(([from, to]) => `${from}>${to}`));

  const everyCombination = statuses.flatMap((from) =>
    statuses.flatMap((to) =>
      roles.map(
        (role) => [from, to, role] as [TicketStatus, TicketStatus, Role],
      ),
    ),
  );

  it.each(everyCombination)('%s -> %s as %s', (from, to, role) => {
    let expected: TransitionCheck = 'invalid';
    if (validEdges.has(`${from}>${to}`)) {
      const isAllowed = allowed.some(
        ([f, t, r]) => f === from && t === to && r === role,
      );
      expected = isAllowed ? 'allowed' : 'forbidden';
    }

    expect(checkTransition(from, to, role)).toBe(expected);
  });

  it('never reopens a closed ticket', () => {
    for (const to of statuses) {
      for (const role of roles) {
        expect(checkTransition(CLOSED, to, role)).toBe('invalid');
      }
    }
  });
});
