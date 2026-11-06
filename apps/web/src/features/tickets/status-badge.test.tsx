import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityIndicator } from './priority-indicator';
import { StatusBadge } from './status-badge';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type TicketStatus,
} from './ticket-model';

describe('StatusBadge', () => {
  it.each(Object.entries(STATUS_LABELS) as [TicketStatus, string][])(
    'shows the label and exposes the status to assistive tech: %s',
    (status, label) => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(label).closest('[data-status]')).toHaveAttribute(
        'data-status',
        status,
      );
    },
  );

  it('uses the status colors', () => {
    render(<StatusBadge status="PENDING" />);
    const badge = screen.getByText('Pendente').closest('[data-status]');
    expect(badge).toHaveStyle({
      color: STATUS_COLORS.PENDING.fg,
      backgroundColor: STATUS_COLORS.PENDING.bg,
    });
  });

  it('hides the decorative dot from assistive tech', () => {
    const { container } = render(<StatusBadge status="OPEN" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('PriorityIndicator', () => {
  it.each([
    ['LOW', 'Baixa'],
    ['NORMAL', 'Média'],
    ['HIGH', 'Alta'],
    ['URGENT', 'Urgente'],
  ] as const)('shows the label for %s', (priority, label) => {
    render(<PriorityIndicator priority={priority} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('is not conveyed by the bars alone', () => {
    const { container } = render(<PriorityIndicator priority="HIGH" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('Alta')).toBeVisible();
  });
});
