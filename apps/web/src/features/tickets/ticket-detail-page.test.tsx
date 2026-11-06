import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TECH_ID,
  json,
  makeTicket,
  makeUser,
  mockApi,
  renderApp,
  ticketId,
} from '../../test/ticket-test-utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const path = (n: number) => `/api/v1/tickets/${ticketId(n)}`;

describe('ticket detail page', () => {
  it('shows breadcrumb "Chamados / #número", the title, status badge, priority and category', async () => {
    mockApi({
      [path(7)]: () =>
        json(
          makeTicket(7, {
            title: 'VPN não conecta',
            status: 'IN_PROGRESS',
            priority: 'URGENT',
          }),
        ),
    });
    const { router } = await renderApp(
      `/chamados/${ticketId(7)}`,
      makeUser('ADMIN'),
    );

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'VPN não conecta',
    });
    expect(heading).toBeInTheDocument();

    const crumbs = screen.getByRole('navigation', { name: 'Migalhas' });
    const back = within(crumbs).getByRole('link', { name: 'Chamados' });
    expect(back).toHaveAttribute('href', '/chamados');
    expect(within(crumbs).getByText('#4807')).toHaveAttribute(
      'aria-current',
      'page',
    );

    const header = heading.closest('header')!;
    expect(within(header).getByText('Em andamento')).toBeInTheDocument();
    expect(within(header).getByText('Urgente')).toBeInTheDocument();
    expect(
      within(header).getByText('Suporte · Acesso e senhas'),
    ).toBeInTheDocument();

    await userEvent.click(back);
    expect(router.state.location.pathname).toBe('/chamados');
  });

  it('shows the description as the opening card, with the requester name and e-mail', async () => {
    mockApi({
      [path(7)]: () =>
        json(
          makeTicket(7, {
            description: 'Desde ontem a VPN\nnão conecta.',
          }),
        ),
    });
    await renderApp(`/chamados/${ticketId(7)}`, makeUser('ADMIN'));

    const card = await screen.findByRole('article', {
      name: 'Descrição do chamado',
    });
    expect(card).toHaveTextContent('Mariana Costa');
    expect(card).toHaveTextContent('Desde ontem a VPN');
    expect(card).toHaveTextContent('não conecta.');
  });

  it('shows the properties panel: Solicitante (name, e-mail), Responsável (or "Não atribuído"), Categoria (area), Criado em, Última atualização', async () => {
    mockApi({
      [path(7)]: () =>
        json(
          makeTicket(7, {
            createdAt: '2026-10-22T10:30:00.000Z',
          }),
        ),
    });
    await renderApp(`/chamados/${ticketId(7)}`, makeUser('ADMIN'));

    const panel = await screen.findByRole('complementary', {
      name: 'Propriedades',
    });
    const text = within(panel);
    expect(text.getByText('Solicitante')).toBeInTheDocument();
    expect(text.getByText('Mariana Costa')).toBeInTheDocument();
    expect(text.getByText('mariana@helpy.test')).toBeInTheDocument();
    expect(text.getByText('Responsável')).toBeInTheDocument();
    expect(text.getByText('Não atribuído')).toBeInTheDocument();
    expect(text.getByText('Categoria')).toBeInTheDocument();
    expect(text.getByText('Suporte · Acesso e senhas')).toBeInTheDocument();
    expect(text.getByText('Criado em')).toBeInTheDocument();
    expect(text.getByText('Última atualização')).toBeInTheDocument();
  });

  it('shows the assigned technician as Responsável', async () => {
    mockApi({
      [path(7)]: () =>
        json(
          makeTicket(7, {
            status: 'IN_PROGRESS',
            technician: { id: TECH_ID, name: 'Rafael Mendes' },
          }),
        ),
    });
    await renderApp(`/chamados/${ticketId(7)}`, makeUser('ADMIN'));

    const panel = await screen.findByRole('complementary', {
      name: 'Propriedades',
    });
    expect(within(panel).getByText('Rafael Mendes')).toBeInTheDocument();
    expect(within(panel).queryByText('Não atribuído')).not.toBeInTheDocument();
  });

  it('asks again when the ticket cannot be loaded', async () => {
    let calls = 0;
    mockApi({
      [path(7)]: () =>
        ++calls === 1 ? json({ message: 'boom' }, 500) : json(makeTicket(7)),
    });
    await renderApp(`/chamados/${ticketId(7)}`, makeUser('ADMIN'));

    expect(
      await screen.findByText('Não foi possível carregar o chamado.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Chamado número 7',
      }),
    ).toBeInTheDocument();
  });
});
