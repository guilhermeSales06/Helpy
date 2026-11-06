import { useRef, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import type { User } from '../auth/use-auth';
import {
  PRIORITY_LABELS,
  allowedActions,
  type Ticket,
  type TicketAction,
  type TicketPriority,
  type TicketStatus,
} from './ticket-model';
import {
  techniciansQuery,
  useAssignTicket,
  useChangeTicketPriority,
  useChangeTicketStatus,
  useReleaseTicket,
  useTakeTicket,
  type TicketMutationResult,
} from './ticket-queries';

const MESSAGES: Record<Exclude<TicketMutationResult, 'ok'>, string> = {
  conflict: 'Este chamado foi alterado por outra pessoa. Atualizamos os dados.',
  forbidden: 'Você não tem permissão para fazer isso neste chamado.',
  'not-found': 'Este chamado não está mais disponível para você.',
  unavailable: 'Não foi possível concluir a ação. Tente de novo.',
};

// The status each button asks for; the API only allows these moves.
const STATUS_TARGET: Partial<Record<TicketAction, TicketStatus>> = {
  start: 'IN_PROGRESS',
  pending: 'PENDING',
  resume: 'IN_PROGRESS',
  resolve: 'RESOLVED',
  reopen: 'IN_PROGRESS',
};

const LABELS: Record<TicketAction, string> = {
  take: 'Assumir',
  release: 'Devolver à fila',
  start: 'Iniciar atendimento',
  pending: 'Marcar como pendente',
  resume: 'Retomar',
  resolve: 'Resolver',
  reopen: 'Reabrir',
  assign: 'Atribuir',
  changePriority: 'Alterar prioridade',
};

const PRIORITIES = Object.keys(PRIORITY_LABELS) as TicketPriority[];

const buttonBase =
  'inline-flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondary = `${buttonBase} border border-line-strong bg-white text-ink enabled:hover:border-[#CFC9C3] enabled:hover:bg-surface data-[state=open]:border-[#CFC9C3]`;
const primary = `${buttonBase} bg-brand text-white enabled:hover:bg-brand-hover`;

const menuContent =
  'z-40 max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-[210px] overflow-y-auto rounded-[18px] border border-line-strong bg-white p-1.5 shadow-[0_12px_32px_rgba(28,26,24,0.12)]';
const menuItem =
  'flex h-[34px] cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 text-[13.5px] font-medium outline-none data-[highlighted]:bg-[#F5F3F1]';

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
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

function RadioItem({ value, label }: { value: string; label: string }) {
  return (
    <DropdownMenu.RadioItem value={value} className={menuItem}>
      <span className="truncate">{label}</span>
      <DropdownMenu.ItemIndicator>
        <Check />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

function Menu({
  label,
  disabled,
  value,
  onValueChange,
  children,
}: {
  label: string;
  disabled: boolean;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={disabled} className={secondary}>
        {label}
        <Chevron />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={menuContent}
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
            {children}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-2 text-[13px] text-secondary">{children}</div>
  );
}

/** Mounted only for an admin, the only one who may list technicians. */
function AssignMenu({
  current,
  disabled,
  onPick,
}: {
  current: Ticket['technician'];
  disabled: boolean;
  onPick: (technicianId: string) => void;
}) {
  const technicians = useQuery(techniciansQuery());
  let items: React.ReactNode;
  if (technicians.isError) {
    items = <Note>Não foi possível carregar os técnicos.</Note>;
  } else if (!technicians.data) {
    items = <Note>Carregando técnicos…</Note>;
  } else if (technicians.data.length === 0) {
    items = <Note>Nenhum técnico ativo.</Note>;
  } else {
    items = technicians.data.map((technician) => (
      <RadioItem
        key={technician.id}
        value={technician.id}
        label={technician.name}
      />
    ));
  }
  return (
    <Menu
      label={LABELS.assign}
      disabled={disabled}
      value={current?.id ?? ''}
      onValueChange={(id) => {
        if (id !== current?.id) onPick(id);
      }}
    >
      {items}
    </Menu>
  );
}

function ReleaseButton({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger disabled={disabled} className={secondary}>
        {LABELS.release}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-line bg-white p-6 shadow-[0_12px_32px_rgba(28,26,24,0.18)]">
          <AlertDialog.Title className="m-0 font-display text-lg font-semibold">
            Devolver este chamado à fila?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 mb-5 text-sm text-secondary">
            Ele volta a ficar sem responsável e outro técnico poderá assumir.
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel className={secondary}>
              Cancelar
            </AlertDialog.Cancel>
            <AlertDialog.Action onClick={onConfirm} className={primary}>
              Devolver
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function TicketActions({
  ticket,
  user,
}: {
  ticket: Ticket;
  user: User;
}) {
  const take = useTakeTicket();
  const release = useReleaseTicket();
  const changeStatus = useChangeTicketStatus();
  const changePriority = useChangeTicketPriority();
  const assign = useAssignTicket();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // State updates after a click, so a second click can arrive before the
  // buttons are disabled; the ref closes that gap.
  const running = useRef(false);

  async function run(request: () => Promise<TicketMutationResult>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await request();
      if (result !== 'ok') setNotice(MESSAGES[result]);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const { id } = ticket;
  const actions = allowedActions(ticket, user);

  function renderAction(action: TicketAction) {
    switch (action) {
      case 'take':
        return (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => void run(() => take.mutateAsync({ id }))}
            className={primary}
          >
            {LABELS[action]}
          </button>
        );
      case 'release':
        return (
          <ReleaseButton
            key={action}
            disabled={busy}
            onConfirm={() => void run(() => release.mutateAsync({ id }))}
          />
        );
      case 'assign':
        return (
          <AssignMenu
            key={action}
            current={ticket.technician}
            disabled={busy}
            onPick={(technicianId) =>
              void run(() => assign.mutateAsync({ id, technicianId }))
            }
          />
        );
      case 'changePriority':
        return (
          <Menu
            key={action}
            label={LABELS[action]}
            disabled={busy}
            value={ticket.priority}
            onValueChange={(value) => {
              if (value === ticket.priority) return;
              void run(() =>
                changePriority.mutateAsync({
                  id,
                  priority: value as TicketPriority,
                }),
              );
            }}
          >
            {PRIORITIES.map((priority) => (
              <RadioItem
                key={priority}
                value={priority}
                label={PRIORITY_LABELS[priority]}
              />
            ))}
          </Menu>
        );
      default: {
        const status = STATUS_TARGET[action];
        if (!status) return null;
        return (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() => changeStatus.mutateAsync({ id, status }))
            }
            className={
              action === 'start' || action === 'resolve' ? primary : secondary
            }
          >
            {LABELS[action]}
          </button>
        );
      }
    }
  }

  if (actions.length === 0 && !notice) return null;
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
      {actions.length > 0 ? (
        <div
          role="group"
          aria-label="Ações do chamado"
          className="flex flex-wrap justify-start gap-2 sm:justify-end"
        >
          {actions.map(renderAction)}
        </div>
      ) : null}
      {notice ? (
        <p
          role="alert"
          className="m-0 max-w-[420px] rounded-xl bg-[#FDF0EE] px-3 py-2 text-[13px] text-[#9B2C19]"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
