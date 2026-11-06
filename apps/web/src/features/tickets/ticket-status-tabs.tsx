import type { KeyboardEvent } from 'react';
import type { components } from '../../shared/api/schema';
import { STATUS_LABELS, type TicketStatus } from './ticket-model';

type Counts = components['schemas']['TicketCountsResponseDto'];

const TABS: { value: TicketStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  ...(Object.keys(STATUS_LABELS) as TicketStatus[]).map((value) => ({
    value,
    label: STATUS_LABELS[value],
  })),
];

export const tabId = (status: TicketStatus | undefined) =>
  `ticket-tab-${status ?? 'ALL'}`;
export const TAB_PANEL_ID = 'ticket-tab-panel';

function countOf(
  counts: Counts | undefined,
  status: TicketStatus | undefined,
): number | undefined {
  if (!counts) return undefined;
  return status ? counts.byStatus[status] : counts.total;
}

type Props = {
  status: TicketStatus | undefined;
  /** `undefined` while loading or when the counts failed. */
  counts: Counts | undefined;
  onSelect: (status: TicketStatus | undefined) => void;
};

export function TicketStatusTabs({ status, counts, onSelect }: Props) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.value === status);
    const last = TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (current + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (current - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next]!;
    onSelect(target.value);
    document.getElementById(tabId(target.value))?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Status"
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-line px-3"
    >
      {TABS.map(({ value, label }) => {
        const selected = value === status;
        const count = countOf(counts, value);
        return (
          <button
            key={label}
            id={tabId(value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={TAB_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(value)}
            className={`-mb-px flex h-[46px] flex-none items-center gap-2 border-b-2 px-2.5 text-[13.5px] font-semibold whitespace-nowrap outline-none focus-visible:rounded-lg focus-visible:ring-4 focus-visible:ring-focus ${
              selected
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}{' '}
            {count === undefined ? null : (
              <span
                className={`flex h-5 min-w-[22px] items-center justify-center rounded-full px-[7px] text-xs ${
                  selected
                    ? 'bg-focus text-[#9a3e00]'
                    : 'bg-[#F2EFEC] text-secondary'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
