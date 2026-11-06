import { Link } from '@tanstack/react-router';

/** For an unknown ticket and for one the person may not see: the API answers both the same. */
export function TicketNotFound() {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-20 text-center">
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
      <h1 className="m-0 font-display text-[22px] font-semibold tracking-[-0.015em]">
        Chamado não encontrado
      </h1>
      <p className="m-0 max-w-sm text-sm text-secondary">
        Ele não existe ou você não tem acesso a ele.
      </p>
      <Link
        to="/chamados"
        search={{ sort: 'newest', page: 1 }}
        className="mt-1.5 inline-flex h-9 items-center rounded-full border border-line-strong bg-white px-3.5 text-[13.5px] font-semibold outline-none hover:border-[#cfc9c3] focus-visible:ring-4 focus-visible:ring-focus"
      >
        Voltar para a lista
      </Link>
    </div>
  );
}
