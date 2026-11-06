import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import type { User } from '../auth/use-auth';
import { PRIORITY_LABELS, type TicketPriority } from './ticket-model';
import { categoriesQuery, techniciansQuery } from './ticket-queries';
import { SORTS, type Sort, type TicketSearch } from './ticket-search';

export const SORT_LABELS: Record<Sort, string> = {
  newest: 'Mais recentes',
  updated: 'Atualizados recentemente',
  oldest: 'Mais antigos',
  priority: 'Maior prioridade',
};

// Radix keeps an item's value non-empty; "no filter" is this one.
const ALL = '__all__';

type Option = { value: string; label: string; group?: string };

const contentClass =
  'z-40 max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-[210px] overflow-y-auto rounded-[18px] border border-line-strong bg-white p-1.5 shadow-[0_12px_32px_rgba(28,26,24,0.12)]';
const itemClass =
  'flex h-[34px] cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 text-[13.5px] font-medium outline-none data-[highlighted]:bg-[#F5F3F1]';

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8A847E"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FE6F00"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function Items({ options }: { options: Option[] }) {
  // Items that share a group sit under that group's heading.
  const groups = [...new Set(options.map((option) => option.group))];
  return groups.map((group) => (
    <DropdownMenu.Group key={group ?? ''}>
      {group ? (
        <DropdownMenu.Label className="px-2.5 pt-2 pb-1 text-[11.5px] font-semibold tracking-[0.03em] text-muted">
          {group}
        </DropdownMenu.Label>
      ) : null}
      {options
        .filter((option) => option.group === group)
        .map((option) => (
          <DropdownMenu.RadioItem
            key={option.value}
            value={option.value}
            className={itemClass}
          >
            {option.label}
            <DropdownMenu.ItemIndicator>
              <Check />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
    </DropdownMenu.Group>
  ));
}

type MenuProps = {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
};

function Menu({
  trigger,
  align,
  ...props
}: MenuProps & {
  trigger: React.ReactNode;
  align: 'start' | 'end';
}) {
  return (
    <DropdownMenu.Root>
      {trigger}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className={contentClass}
        >
          <DropdownMenu.RadioGroup
            value={props.value}
            onValueChange={props.onValueChange}
          >
            <Items options={props.options} />
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const triggerBase =
  'flex h-[34px] items-center gap-1.5 rounded-full border text-[13px] font-medium whitespace-nowrap outline-none hover:border-[#CFC9C3] focus-visible:ring-4 focus-visible:ring-focus data-[state=open]:border-[#CFC9C3]';

function FilterMenu({
  label,
  allLabel,
  options,
  value,
  fallbackLabel,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: Option[];
  /** `undefined` when the filter is off. */
  value: string | undefined;
  /** Shown when the value is not among the options (yet). */
  fallbackLabel: string;
  onChange: (value: string | undefined) => void;
}) {
  const all: Option = { value: ALL, label: allLabel };
  const valueLabel = value
    ? (options.find((option) => option.value === value)?.label ?? fallbackLabel)
    : allLabel;
  return (
    <Menu
      align="start"
      options={[all, ...options]}
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : next)}
      trigger={
        <DropdownMenu.Trigger
          className={`${triggerBase} pr-2 pl-3 ${
            value
              ? 'border-[#FFC79A] bg-[#FFF6EE]'
              : 'border-line-strong bg-white'
          }`}
        >
          <span className="text-muted">{label}:</span>{' '}
          <span className="font-semibold">{valueLabel}</span>
          <Chevron />
        </DropdownMenu.Trigger>
      }
    />
  );
}

const PRIORITY_OPTIONS: Option[] = (
  Object.keys(PRIORITY_LABELS) as TicketPriority[]
).map((value) => ({ value, label: PRIORITY_LABELS[value] }));

const SORT_OPTIONS: Option[] = SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

type Props = {
  search: TicketSearch;
  role: User['role'];
  /** Writes these keys to the URL; the page goes back to the first. */
  onChange: (patch: Partial<TicketSearch>) => void;
  onClear: () => void;
};

export function TicketFilters({ search, role, onChange, onClear }: Props) {
  const isAdmin = role === 'ADMIN';
  const categories = useQuery(categoriesQuery());
  // Only the admin may list technicians; for anyone else the call is a 403.
  const technicians = useQuery({ ...techniciansQuery(), enabled: isAdmin });

  const categoryOptions: Option[] = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.name,
    group: category.area.name,
  }));

  const assigneeOptions: Option[] = [
    ...(isAdmin ? [] : [{ value: 'me', label: 'Eu' }]),
    { value: 'none', label: 'Não atribuído' },
    ...(isAdmin
      ? (technicians.data ?? []).map((technician) => ({
          value: technician.id,
          label: technician.name,
        }))
      : []),
  ];

  const filtered = Boolean(
    search.status || search.priority || search.category || search.assignee,
  );

  return (
    <div className="relative flex items-center gap-2 overflow-x-auto border-b border-line px-4 py-3 sm:flex-wrap sm:overflow-visible [&>*]:flex-none">
      <FilterMenu
        label="Prioridade"
        allLabel="Todas"
        options={PRIORITY_OPTIONS}
        value={search.priority}
        fallbackLabel="Todas"
        onChange={(priority) =>
          onChange({ priority: priority as TicketPriority | undefined })
        }
      />
      {role === 'CLIENT' ? null : (
        <FilterMenu
          label="Responsável"
          allLabel="Todos"
          options={assigneeOptions}
          value={search.assignee}
          fallbackLabel="Técnico"
          onChange={(assignee) => onChange({ assignee })}
        />
      )}
      <FilterMenu
        label="Categoria"
        allLabel="Todas"
        options={categoryOptions}
        value={search.category}
        fallbackLabel="Selecionada"
        onChange={(category) => onChange({ category })}
      />
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="h-[34px] rounded-full px-2.5 text-[13px] font-semibold text-link outline-none focus-visible:ring-4 focus-visible:ring-focus"
        >
          Limpar filtros
        </button>
      ) : null}
      <div className="flex-1" />
      <Menu
        align="end"
        options={SORT_OPTIONS}
        value={search.sort}
        onValueChange={(sort) => onChange({ sort: sort as Sort })}
        trigger={
          <DropdownMenu.Trigger
            className={`${triggerBase} border-line-strong bg-white px-2.5`}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#57524D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16" />
            </svg>
            <span className="sr-only">Ordenar por:</span>{' '}
            {SORT_LABELS[search.sort]}
          </DropdownMenu.Trigger>
        }
      />
    </div>
  );
}
