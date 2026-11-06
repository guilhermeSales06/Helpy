import type { MouseEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { avatarColor, initials } from '../../shared/lib/avatar';
import { formatRelative } from '../../shared/lib/format-date';
import { PriorityIndicator } from './priority-indicator';
import { StatusBadge } from './status-badge';
import { formatNumber, type Ticket } from './ticket-model';

const COLUMNS = [
  { label: 'ID', width: 'w-[76px]' },
  { label: 'Assunto', width: '' },
  { label: 'Solicitante', width: 'w-[210px]' },
  { label: 'Responsável', width: 'w-[180px]' },
  { label: 'Prioridade', width: 'w-[120px]' },
  { label: 'Status', width: 'w-[150px]' },
  { label: 'Atualizado', width: 'w-[110px]' },
];

function Avatar({ name, size }: { name: string; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${
        size === 'md' ? 'size-[26px] text-[10.5px]' : 'size-6 text-[10px]'
      }`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

function Row({ ticket }: { ticket: Ticket }) {
  const navigate = useNavigate();
  const { client, technician, category } = ticket;

  // The whole row opens the ticket; the title link covers keyboard and
  // middle-click, so a click on the link is left to the link.
  function open(event: MouseEvent<HTMLTableRowElement>) {
    if ((event.target as Element).closest('a')) return;
    void navigate({
      to: '/chamados/$ticketId',
      params: { ticketId: ticket.id },
    });
  }

  return (
    <tr
      onClick={open}
      className="cursor-pointer border-b border-[#F2EFEC] last:border-b-0 hover:bg-[#FAF7F4] focus-within:bg-[#FAF7F4]"
    >
      <td className="px-4 py-3 font-display text-[13px] font-medium text-secondary">
        {formatNumber(ticket.number)}
      </td>
      <td className="max-w-0 px-2 py-3">
        <Link
          to="/chamados/$ticketId"
          params={{ ticketId: ticket.id }}
          className="block truncate rounded text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-focus"
        >
          {ticket.title}
        </Link>
        <span className="block truncate text-[12.5px] text-muted">
          {category.area.name} · {category.name}
        </span>
      </td>
      <td className="max-w-0 px-2 py-3">
        <span className="flex items-center gap-2">
          <Avatar name={client.name} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px]">{client.name}</span>
            <span className="truncate text-xs text-muted">{client.email}</span>
          </span>
        </span>
      </td>
      <td className="max-w-0 px-2 py-3">
        {technician ? (
          <span className="flex items-center gap-2">
            <Avatar name={technician.name} size="sm" />
            <span className="truncate text-[13.5px]">{technician.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-6 flex-none rounded-full border-[1.5px] border-dashed border-[#CFC9C3]"
            />
            <span className="truncate text-[13.5px] text-muted">
              Não atribuído
            </span>
          </span>
        )}
      </td>
      <td className="px-2 py-3">
        <PriorityIndicator priority={ticket.priority} />
      </td>
      <td className="px-2 py-3">
        <StatusBadge status={ticket.status} />
      </td>
      <td className="px-2 py-3 pr-4 text-[12.5px] whitespace-nowrap text-muted">
        {formatRelative(ticket.updatedAt)}
      </td>
    </tr>
  );
}

/** The table scrolls inside its card, so the page itself never scrolls sideways. */
export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
        <caption className="sr-only">Chamados</caption>
        <thead>
          <tr className="border-b border-line bg-surface">
            {COLUMNS.map(({ label, width }, index) => (
              <th
                key={label}
                scope="col"
                className={`py-[9px] text-[11.5px] font-semibold tracking-[0.03em] text-muted ${width} ${
                  index === 0 ? 'px-4' : 'px-2'
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <Row key={ticket.id} ticket={ticket} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TicketTableSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando chamados"
      className="flex flex-col"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center gap-4 border-b border-[#F2EFEC] px-4 py-4 last:border-b-0"
        >
          <span className="h-3 w-12 animate-pulse rounded bg-[#F2EFEC]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-3/5 animate-pulse rounded bg-[#F2EFEC]" />
            <span className="h-3 w-2/5 animate-pulse rounded bg-[#F2EFEC]" />
          </span>
          <span className="hidden h-6 w-28 animate-pulse rounded-full bg-[#F2EFEC] sm:block" />
        </div>
      ))}
    </div>
  );
}
