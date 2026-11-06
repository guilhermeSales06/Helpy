import type { CSSProperties } from 'react';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type TicketStatus,
} from './ticket-model';

// The dot differs by shape as well as color, so the status is not told by
// color alone: empty, half, dotted, full.
function dotStyle(status: TicketStatus, color: string): CSSProperties {
  const border = `2px ${status === 'PENDING' ? 'dotted' : 'solid'} ${color}`;
  switch (status) {
    case 'IN_PROGRESS':
      return {
        border,
        background: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
      };
    case 'RESOLVED':
    case 'CLOSED':
      return { border, background: color };
    default:
      return { border, background: 'transparent' };
  }
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { fg, bg } = STATUS_COLORS[status];
  return (
    <span
      data-status={status}
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-[9px] text-xs font-semibold whitespace-nowrap"
      style={{ color: fg, backgroundColor: bg }}
    >
      <span
        aria-hidden="true"
        className="size-[9px] rounded-full"
        style={dotStyle(status, fg)}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
