import { useRef, useState, type FormEvent } from 'react';
import { getRouteApi, useNavigate, useSearch } from '@tanstack/react-router';
import { MAX_QUERY_LENGTH } from '../features/tickets/ticket-search';

const ticketsRoute = getRouteApi('/_app/chamados');

function SearchField({ current }: { current: string }) {
  const [text, setText] = useState(current);
  // The field follows the URL's q when something else changes it (the chip
  // on the list, "Limpar filtros e busca", Back), so it never shows a stale one.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setText(current);
  }
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const clearFromList = ticketsRoute.useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.trim();
    // A new search starts from the whole list: the other filters stay out.
    void navigate({
      to: '/chamados',
      search: { ...(q && { q }), sort: 'newest', page: 1 },
    });
  }

  function clear() {
    setText('');
    input.current?.focus();
    // Only the search goes; the filters of the list stay as they are.
    if (current) {
      void clearFromList({
        search: (prev) => ({ ...prev, q: undefined, page: 1 }),
        replace: true,
      });
    }
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative max-w-[460px] min-w-0 flex-1"
    >
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8A847E"
        strokeWidth="2"
        strokeLinecap="round"
        className="pointer-events-none absolute top-[11.5px] left-3"
      >
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />
      </svg>
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_QUERY_LENGTH}
        aria-label="Pesquisar chamados"
        placeholder="Pesquisar chamados ou #ID"
        className="h-10 w-full rounded-full border border-line bg-[#F5F3F1] pr-10 pl-[38px] text-sm text-ink outline-none placeholder:text-muted focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-focus [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpar pesquisa"
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-secondary outline-none hover:bg-line focus-visible:ring-4 focus-visible:ring-focus"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </form>
  );
}

/** Search box of the header, for whoever works the tickets. Opens the list. */
export function HeaderSearch() {
  // Only the list has a `q`. The router reads a number-looking one as a number.
  const { q } = useSearch({ strict: false }) as { q?: string | number };
  const current = q === undefined ? '' : String(q);
  return <SearchField current={current} />;
}
