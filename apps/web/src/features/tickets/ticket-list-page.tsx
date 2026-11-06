import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useAuth, type User } from '../auth/use-auth';
import { TicketFilters } from './ticket-filters';
import { ticketCountsQuery, ticketListQuery } from './ticket-queries';
import { restrictSearch, type TicketSearch } from './ticket-search';
import { TAB_PANEL_ID, TicketStatusTabs, tabId } from './ticket-status-tabs';
import { TicketTable, TicketTableSkeleton } from './ticket-table';

const route = getRouteApi('/_app/chamados');

function pageTitle(search: TicketSearch, role: User['role']): string {
  if (search.assignee === 'me') return 'Meus chamados';
  if (search.assignee === 'none') return 'Não atribuídos';
  return role === 'ADMIN' && !search.assignee
    ? 'Todos os chamados'
    : 'Chamados';
}

function hasFilters({ status, priority, category, assignee, q }: TicketSearch) {
  return Boolean(status || priority || category || assignee || q);
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const pillButton =
  'h-8 rounded-full border border-line bg-white px-3 text-[12.5px] font-semibold outline-none hover:border-line-strong focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-[#B5AFA9] disabled:hover:border-line';

function TicketList({ user }: { user: User }) {
  const rawSearch = route.useSearch();
  const search = restrictSearch(rawSearch, user.role);
  const navigate = route.useNavigate();

  // The filter by technician is the admin's; for anyone else it leaves the URL.
  const restricted = search !== rawSearch;
  useEffect(() => {
    if (!restricted) return;
    void navigate({
      search: (prev) => ({ ...prev, assignee: undefined }),
      replace: true,
    });
  }, [restricted, navigate]);

  const list = useQuery({
    ...ticketListQuery(search, user.id),
    // Keep the last page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    ...ticketCountsQuery(search, user.id),
    placeholderData: keepPreviousData,
  });
  const result = list.data;
  const settled = result !== undefined && !list.isPlaceholderData;

  // A page past the end (a stale link, or tickets that went away) goes back
  // to the last one.
  const pastTheEnd =
    settled && result.data.length === 0 && result.meta.page > 1;
  const lastPage = result ? Math.max(1, result.meta.totalPages) : 1;
  useEffect(() => {
    if (!pastTheEnd) return;
    void navigate({
      search: (prev) => ({ ...prev, page: lastPage }),
      replace: true,
    });
  }, [pastTheEnd, lastPage, navigate]);

  // Any change to the filters goes back to the first page and replaces the
  // entry, so Back does not walk through every filter.
  function update(patch: Partial<TicketSearch>) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: 1 }),
      replace: true,
    });
  }

  function clearFilters() {
    update({
      status: undefined,
      priority: undefined,
      category: undefined,
      assignee: undefined,
    });
  }

  function goToPage(page: number) {
    void navigate({ search: (prev) => ({ ...prev, page }) });
  }

  function clearAll() {
    void navigate({
      search: (prev) => ({ sort: prev.sort, page: 1 }),
      replace: true,
    });
  }

  const total = result?.meta.total;
  const filtered = hasFilters(search);

  let body;
  if (list.isError) {
    body = (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 px-6 py-14 text-center"
      >
        <strong className="text-[15.5px]">
          Não foi possível carregar os chamados.
        </strong>
        <button
          type="button"
          onClick={() => void list.refetch()}
          className="h-9 rounded-full bg-brand px-4 text-[13.5px] font-semibold text-white outline-none hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-focus"
        >
          Tentar de novo
        </button>
      </div>
    );
  } else if (!result) {
    body = <TicketTableSkeleton />;
  } else if (result.data.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-[22px] bg-[#FFF1E6] text-brand"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
          </svg>
        </div>
        <strong className="text-[15.5px]">Nenhum chamado encontrado</strong>
        <span className="text-sm text-secondary">
          {filtered
            ? 'Ajuste os filtros ou a busca para ver mais resultados.'
            : 'Quando houver chamados, eles aparecem aqui.'}
        </span>
        {filtered ? (
          <button
            type="button"
            onClick={clearAll}
            className="mt-1.5 h-9 rounded-full border border-line-strong bg-white px-3.5 text-[13.5px] font-semibold outline-none hover:border-[#cfc9c3] focus-visible:ring-4 focus-visible:ring-focus"
          >
            Limpar filtros e busca
          </button>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div
        aria-busy={list.isPlaceholderData}
        className={list.isPlaceholderData ? 'opacity-60' : undefined}
      >
        <TicketTable tickets={result.data} />
      </div>
    );
  }

  const pagination =
    result && result.data.length > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-secondary">
        <span>
          Mostrando {(result.meta.page - 1) * result.meta.limit + 1}–
          {(result.meta.page - 1) * result.meta.limit + result.data.length} de{' '}
          {result.meta.total} chamados
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={result.meta.page <= 1}
            onClick={() => goToPage(result.meta.page - 1)}
            className={pillButton}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={result.meta.page >= result.meta.totalPages}
            onClick={() => goToPage(result.meta.page + 1)}
            className={pillButton}
          >
            Próxima
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-6 pb-10 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h1 className="font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">
          {pageTitle(search, user.role)}
        </h1>
        {total === undefined ? null : (
          <span className="text-sm text-muted">
            {total} {total === 1 ? 'chamado' : 'chamados'}
          </span>
        )}
        {search.q ? (
          <span className="inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-full bg-[#F5F3F1] pr-1.5 pl-2.5 text-[13px]">
            <span className="truncate">Busca: “{search.q}”</span>
            <button
              type="button"
              onClick={() => update({ q: undefined })}
              aria-label="Limpar busca"
              className="flex size-[18px] flex-none items-center justify-center rounded-full bg-line-strong outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              <CloseIcon />
            </button>
          </span>
        ) : null}
      </div>

      <section
        aria-label="Lista de chamados"
        className="overflow-hidden rounded-[20px] border border-line bg-white"
      >
        <TicketStatusTabs
          status={search.status}
          counts={counts.data}
          onSelect={(status) => update({ status })}
        />
        <TicketFilters
          search={search}
          role={user.role}
          onChange={update}
          onClear={clearFilters}
        />
        <div
          role="tabpanel"
          id={TAB_PANEL_ID}
          aria-labelledby={tabId(search.status)}
        >
          {body}
          {pagination}
        </div>
      </section>
    </div>
  );
}

export function TicketListPage() {
  const { state } = useAuth();
  return state.status === 'authenticated' ? (
    <TicketList user={state.user} />
  ) : null;
}
