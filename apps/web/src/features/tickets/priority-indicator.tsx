import { PRIORITY_LABELS, type TicketPriority } from './ticket-model';

const LEVEL: Record<TicketPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
};

const BAR_HEIGHTS = [4, 7, 10, 13];

/** Signal bars plus the label; the label carries the meaning for assistive tech. */
export function PriorityIndicator({
  priority,
  prefix,
}: {
  priority: TicketPriority;
  /** A word before the label, e.g. "Prioridade". */
  prefix?: string;
}) {
  const color = priority === 'URGENT' ? '#C8361F' : '#1C1A18';
  return (
    <span
      className="inline-flex items-center gap-[7px] text-[13px] font-medium whitespace-nowrap"
      style={{ color }}
    >
      <span aria-hidden="true" className="flex h-[13px] items-end gap-0.5">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className="w-[3px] rounded-[1px]"
            style={{
              height,
              backgroundColor: index < LEVEL[priority] ? color : '#DDD8D3',
            }}
          />
        ))}
      </span>
      {prefix ? <span>{prefix}</span> : null}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
