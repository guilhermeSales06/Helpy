import { formatDateTime } from '../../shared/lib/format-date';
import { PersonAvatar } from './person-avatar';
import type { Ticket } from './ticket-model';

const sectionTitle =
  'text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase';

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <dt className="flex-none text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

export function TicketProperties({ ticket }: { ticket: Ticket }) {
  const { client, technician, category } = ticket;
  return (
    <aside
      aria-label="Propriedades"
      className="flex w-full flex-none flex-col gap-6 border-t border-line bg-white p-5 lg:w-[280px] lg:border-t-0 lg:border-l min-[1100px]:lg:w-[320px]"
    >
      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Propriedades</h2>
        <dl className="m-0 flex flex-col gap-3">
          <Row label="Responsável">
            {technician ? (
              <span className="inline-flex items-center gap-2">
                <PersonAvatar
                  name={technician.name}
                  className="size-6 text-[10px]"
                />
                {technician.name}
              </span>
            ) : (
              <span className="text-muted">Não atribuído</span>
            )}
          </Row>
          <Row label="Categoria">
            {category.area.name} · {category.name}
          </Row>
        </dl>
      </section>

      <div className="h-px bg-line" />

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Solicitante</h2>
        <div className="flex items-center gap-3">
          <PersonAvatar name={client.name} className="size-[42px] text-sm" />
          <div className="min-w-0 leading-[1.35]">
            <div className="truncate text-[14.5px] font-semibold">
              {client.name}
            </div>
            <div className="truncate text-[13px] text-secondary">
              {client.email}
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-line" />

      <section className="flex flex-col gap-2">
        <h2 className={`${sectionTitle} mb-1`}>Detalhes</h2>
        <dl className="m-0 flex flex-col gap-2">
          <Row label="Criado em">{formatDateTime(ticket.createdAt)}</Row>
          <Row label="Última atualização">
            {formatDateTime(ticket.updatedAt)}
          </Row>
        </dl>
      </section>
    </aside>
  );
}
