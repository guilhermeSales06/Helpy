import { useQuery } from '@tanstack/react-query';
import { Link, getRouteApi } from '@tanstack/react-router';
import { formatDateTime, formatRelative } from '../../shared/lib/format-date';
import { useAuth, type User } from '../auth/use-auth';
import { PersonAvatar } from './person-avatar';
import { PriorityIndicator } from './priority-indicator';
import { StatusBadge } from './status-badge';
import { formatNumber, type Ticket } from './ticket-model';
import { TicketActions } from './ticket-actions';
import { TicketProperties } from './ticket-properties';
import { ticketQuery } from './ticket-queries';

const route = getRouteApi('/_app/chamados/$ticketId');

function Header({ ticket, user }: { ticket: Ticket; user: User }) {
  const { client, category } = ticket;
  return (
    <header className="flex flex-col gap-2.5 border-b border-line bg-white px-4 pt-[18px] pb-4 sm:px-7">
      <nav
        aria-label="Migalhas"
        className="flex items-center gap-1.5 text-[13px] text-muted"
      >
        <Link
          to="/chamados"
          search={{ sort: 'newest', page: 1 }}
          className="rounded font-medium text-secondary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-focus"
        >
          Chamados
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-display">
          {formatNumber(ticket.number)}
        </span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 flex-[1_1_280px] break-words font-display text-[23px] leading-tight font-semibold tracking-[-0.015em] text-pretty">
          {ticket.title}
        </h1>
        <TicketActions ticket={ticket} user={user} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] text-secondary">
        <StatusBadge status={ticket.status} />
        <PriorityIndicator priority={ticket.priority} prefix="Prioridade" />
        <span className="inline-flex h-6 items-center rounded-md bg-[#F5F3F1] px-[9px] text-[12.5px] font-medium">
          {category.area.name} · {category.name}
        </span>
        <span className="min-w-0 break-words">
          Aberto por {client.name} · {formatRelative(ticket.createdAt)}
        </span>
      </div>
    </header>
  );
}

function Description({ ticket }: { ticket: Ticket }) {
  const { client } = ticket;
  return (
    <div className="flex max-w-[860px] gap-3">
      <PersonAvatar name={client.name} className="size-[34px] text-xs" />
      <article
        aria-label="Descrição do chamado"
        className="min-w-0 flex-1 rounded-[20px] border border-line bg-white px-4 pt-3 pb-3.5"
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <strong className="text-sm">{client.name}</strong>
          <span className="inline-flex h-5 items-center rounded-[5px] bg-[#F5F3F1] px-[7px] text-[11.5px] font-semibold text-secondary">
            Solicitante
          </span>
          <span className="text-[12.5px] text-muted">{client.email}</span>
          <time
            dateTime={ticket.createdAt}
            className="ml-auto text-[12.5px] text-muted"
          >
            {formatDateTime(ticket.createdAt)}
          </time>
        </div>
        <p className="m-0 text-[14.5px] leading-[1.6] break-words whitespace-pre-wrap text-[#2A2724]">
          {ticket.description}
        </p>
      </article>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando o chamado"
      className="flex flex-col gap-4 p-4 sm:p-7"
    >
      <div className="h-4 w-40 rounded bg-line" />
      <div className="h-7 w-2/3 rounded bg-line" />
      <div className="h-40 max-w-[860px] rounded-[20px] bg-line/60" />
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-14 text-center"
    >
      <strong className="text-[15.5px]">
        Não foi possível carregar o chamado.
      </strong>
      <button
        type="button"
        onClick={onRetry}
        className="h-9 rounded-full bg-brand px-4 text-[13.5px] font-semibold text-white outline-none hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-focus"
      >
        Tentar de novo
      </button>
    </div>
  );
}

function TicketDetail({ user }: { user: User }) {
  const { ticketId } = route.useParams();
  const query = useQuery(ticketQuery(ticketId));
  // After a failed reload the ticket on screen stays; only a ticket that was
  // never loaded is an error.
  const ticket = query.data;

  if (!ticket) {
    return query.isError ? (
      <LoadError onRetry={() => void query.refetch()} />
    ) : (
      <Skeleton />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header ticket={ticket} user={user} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-7">
          <Description ticket={ticket} />
        </div>
        <TicketProperties ticket={ticket} />
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const { state } = useAuth();
  return state.status === 'authenticated' ? (
    <TicketDetail user={state.user} />
  ) : null;
}
