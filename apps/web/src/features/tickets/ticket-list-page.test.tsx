import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CATEGORY_ID,
  TECH_ID,
  json,
  listBody,
  makeTicket,
  makeUser,
  mockApi,
  renderApp,
  ticketId,
  ZERO_COUNTS,
} from '../../test/ticket-test-utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ticket list page', () => {
  it('renders a row per ticket: number, title, requester, priority, status, area/category, relative update', async () => {
    mockApi({
      '/api/v1/tickets': () =>
        json(
          listBody([
            makeTicket(1, {
              title: 'VPN não conecta',
              priority: 'URGENT',
              status: 'IN_PROGRESS',
              technician: { id: TECH_ID, name: 'Rafael Mendes' },
            }),
            makeTicket(2, { title: 'Trocar monitor', priority: 'LOW' }),
          ]),
        ),
    });
    await renderApp('/chamados', makeUser('ADMIN'));

    const rows = await screen.findAllByRole('row');
    // Header row plus one per ticket.
    expect(rows).toHaveLength(3);
    const first = within(rows[1]!);
    expect(first.getByText('#4801')).toBeInTheDocument();
    expect(first.getByText('VPN não conecta')).toBeInTheDocument();
    expect(first.getByText('Mariana Costa')).toBeInTheDocument();
    expect(first.getByText('mariana@helpy.test')).toBeInTheDocument();
    expect(first.getByText('Rafael Mendes')).toBeInTheDocument();
    expect(first.getByText('Urgente')).toBeInTheDocument();
    expect(first.getByText('Em andamento')).toBeInTheDocument();
    expect(first.getByText('Suporte · Acesso e senhas')).toBeInTheDocument();
    expect(first.getByText('há 3 h')).toBeInTheDocument();
    const second = within(rows[2]!);
    expect(second.getByText('Não atribuído')).toBeInTheDocument();
    expect(second.getByText('Baixa')).toBeInTheDocument();
    expect(second.getByText('Aberto')).toBeInTheDocument();
  });

  it('has a table with column headers', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    await renderApp('/chamados', makeUser('ADMIN'));
    await screen.findByRole('table');
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'ID',
      'Assunto',
      'Solicitante',
      'Responsável',
      'Prioridade',
      'Status',
      'Atualizado',
    ]);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('clicking a row opens /chamados/<id>', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(7)])),
    });
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const cell = await screen.findByText('Mariana Costa');
    await userEvent.click(cell);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/chamados/${ticketId(7)}`),
    );
  });

  it('the title is a link, so the row works from the keyboard', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(7)])),
    });
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const link = await screen.findByRole('link', { name: 'Chamado número 7' });
    expect(link).toHaveAttribute('href', `/chamados/${ticketId(7)}`);
    const before = router.history.length;
    link.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/chamados/${ticketId(7)}`),
    );
    // One navigation, not one from the link and another from the row.
    expect(router.history.length - before).toBe(1);
  });

  it('shows the empty state "Nenhum chamado encontrado" with "Limpar filtros e busca", which clears the filters and q', async () => {
    mockApi();
    const { router } = await renderApp(
      `/chamados?priority=HIGH&category=${CATEGORY_ID}&q=vpn&sort=oldest&page=2`,
      makeUser('ADMIN'),
    );
    expect(
      await screen.findByText('Nenhum chamado encontrado'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros e busca' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty('q'),
    );
    expect(router.state.location.search).toEqual({ sort: 'oldest' });
  });

  it('does not offer to clear anything when no filter is set', async () => {
    mockApi();
    await renderApp('/chamados', makeUser('ADMIN'));
    expect(
      await screen.findByText('Nenhum chamado encontrado'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Limpar filtros e busca' }),
    ).not.toBeInTheDocument();
  });

  it('paginates with Anterior/Próxima and a "x de y" label; Anterior is disabled on page 1', async () => {
    const api = mockApi({
      '/api/v1/tickets': (url) => {
        const page = Number(url.searchParams.get('page') ?? 1);
        const size = page === 3 ? 5 : 20;
        const tickets = Array.from({ length: size }, (_, i) =>
          makeTicket(page * 100 + i),
        );
        return json(listBody(tickets, { page, total: 45 }));
      },
    });
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    expect(
      await screen.findByText('Mostrando 1–20 de 45 chamados'),
    ).toBeInTheDocument();
    const previous = screen.getByRole('button', { name: 'Anterior' });
    const next = screen.getByRole('button', { name: 'Próxima' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    const before = router.history.length;
    await userEvent.click(next);
    expect(
      await screen.findByText('Mostrando 21–40 de 45 chamados'),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ page: 2 });
    expect(api.lastList()!.searchParams.get('page')).toBe('2');
    // Changing page is a navigation the Back button can undo.
    expect(router.history.length - before).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(
      await screen.findByText('Mostrando 41–45 de 45 chamados'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(
      await screen.findByText('Mostrando 21–40 de 45 chamados'),
    ).toBeInTheDocument();
  });

  it('goes back to the last page when the URL asks for one past the end', async () => {
    mockApi({
      '/api/v1/tickets': (url) => {
        const page = Number(url.searchParams.get('page') ?? 1);
        const tickets =
          page <= 2
            ? Array.from({ length: page === 2 ? 5 : 20 }, (_, i) =>
                makeTicket(page * 100 + i),
              )
            : [];
        return json(listBody(tickets, { page, total: 25 }));
      },
    });
    const { router } = await renderApp('/chamados?page=9', makeUser('ADMIN'));
    expect(
      await screen.findByText('Mostrando 21–25 de 25 chamados'),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ page: 2 });
  });

  it('shows a loading state and, on API failure, an error with "Tentar de novo" that refetches', async () => {
    let calls = 0;
    mockApi({
      '/api/v1/tickets': () => {
        calls += 1;
        return calls === 1
          ? json({ message: 'boom' }, 500)
          : json(listBody([makeTicket(1)]));
      },
    });
    await renderApp('/chamados', makeUser('ADMIN'));
    expect(
      await screen.findByText('Não foi possível carregar os chamados.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );
    expect(await screen.findByText('Chamado número 1')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('shows a loading status while the list is being fetched', async () => {
    mockApi({ '/api/v1/tickets': () => new Promise<Response>(() => {}) });
    await renderApp('/chamados', makeUser('ADMIN'));
    expect(
      await screen.findByRole('status', { name: 'Carregando chamados' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nenhum chamado encontrado')).toBeNull();
  });

  it('an invalid URL search falls back to defaults without crashing', async () => {
    const api = mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    await renderApp(
      '/chamados?status=XYZ&page=-3&sort=foo&assignee=&priority=9&category=x',
      makeUser('ADMIN'),
    );
    expect(await screen.findByText('Chamado número 1')).toBeInTheDocument();
    expect(Object.fromEntries(api.lastList()!.searchParams)).toEqual({
      sort: 'newest',
      page: '1',
    });
  });

  it('finds a numeric q as text', async () => {
    const api = mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    await renderApp('/chamados?q=4821', makeUser('ADMIN'));
    await screen.findByText('Chamado número 1');
    expect(api.lastList()!.searchParams.get('q')).toBe('4821');
    expect(screen.getByText('Busca: “4821”')).toBeInTheDocument();
  });

  it('clears q with the chip next to the title', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    const { router } = await renderApp(
      '/chamados?q=vpn&priority=HIGH',
      makeUser('ADMIN'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Limpar busca' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
    );
  });

  it.each([
    ['TECHNICIAN', '/chamados?assignee=me', 'Meus chamados'],
    ['TECHNICIAN', '/chamados?assignee=none', 'Não atribuídos'],
    ['ADMIN', '/chamados', 'Todos os chamados'],
    ['ADMIN', '/chamados?assignee=none', 'Não atribuídos'],
    ['TECHNICIAN', '/chamados', 'Chamados'],
    ['ADMIN', `/chamados?assignee=${TECH_ID}`, 'Chamados'],
  ] as const)(
    'the page title follows the preset: %s on %s is "%s"',
    async (role, path, title) => {
      mockApi();
      await renderApp(path, makeUser(role));
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeInTheDocument();
    },
  );

  it('shows the count of tickets under the title', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)], { total: 1 })),
    });
    await renderApp('/chamados', makeUser('ADMIN'));
    expect(await screen.findByText('1 chamado')).toBeInTheDocument();
  });

  it('ignores an assignee uuid for a technician and takes it out of the URL', async () => {
    const api = mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    const { router } = await renderApp(
      `/chamados?assignee=${TECH_ID}&priority=HIGH`,
      makeUser('TECHNICIAN'),
    );
    await screen.findByText('Chamado número 1');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
    );
    for (const url of api.to('/api/v1/tickets')) {
      expect(url.searchParams.has('technicianId')).toBe(false);
    }
  });

  it('keeps an assignee uuid for an admin', async () => {
    const api = mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    await renderApp(`/chamados?assignee=${TECH_ID}`, makeUser('ADMIN'));
    await screen.findByText('Chamado número 1');
    expect(api.lastList()!.searchParams.get('technicianId')).toBe(TECH_ID);
  });

  describe('status tabs', () => {
    const counts = {
      total: 30,
      byStatus: {
        OPEN: 12,
        IN_PROGRESS: 8,
        PENDING: 3,
        RESOLVED: 5,
        CLOSED: 2,
      },
    };

    it('shows the tabs Todos, Aberto, Em andamento, Pendente, Resolvido, Fechado with the counts from the API', async () => {
      mockApi({ '/api/v1/tickets/counts': () => json(counts) });
      await renderApp('/chamados', makeUser('ADMIN'));
      const tablist = await screen.findByRole('tablist');
      for (const name of [
        'Todos 30',
        'Aberto 12',
        'Em andamento 8',
        'Pendente 3',
        'Resolvido 5',
        'Fechado 2',
      ]) {
        expect(
          await within(tablist).findByRole('tab', { name }),
        ).toBeInTheDocument();
      }
      expect(within(tablist).getAllByRole('tab')).toHaveLength(6);
      expect(
        within(tablist).getByRole('tab', { name: 'Todos 30' }),
      ).toHaveAttribute('aria-selected', 'true');
    });

    it('still shows the tabs, without numbers, when the counts fail', async () => {
      mockApi({
        '/api/v1/tickets/counts': () => json({ message: 'boom' }, 500),
        '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
      });
      await renderApp('/chamados', makeUser('ADMIN'));
      expect(await screen.findByText('Chamado número 1')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Aberto' })).toBeInTheDocument();
    });

    it('clicking a tab sets status in the URL and resets page to 1', async () => {
      const api = mockApi({
        '/api/v1/tickets/counts': () =>
          json({ total: 30, byStatus: { ...ZERO_COUNTS, RESOLVED: 5 } }),
      });
      const { router } = await renderApp(
        '/chamados?priority=HIGH&page=3',
        makeUser('ADMIN'),
      );
      const before = router.history.length;
      await userEvent.click(
        await screen.findByRole('tab', { name: /^Resolvido/ }),
      );
      await waitFor(() =>
        expect(router.state.location.search).toEqual({
          priority: 'HIGH',
          status: 'RESOLVED',
        }),
      );
      expect(screen.getByRole('tab', { name: /^Resolvido/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await waitFor(() => {
        const list = api.lastList()!;
        expect(list.searchParams.get('status')).toBe('RESOLVED');
        expect(list.searchParams.get('page')).toBe('1');
      });
      expect(router.history.length).toBe(before);

      await userEvent.click(screen.getByRole('tab', { name: /^Todos/ }));
      await waitFor(() =>
        expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
      );
    });

    it('moves between the tabs with the arrow keys', async () => {
      const { router } = await renderApp('/chamados', makeUser('ADMIN'));
      const all = await screen.findByRole('tab', { name: /^Todos/ });
      expect(all).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: /^Aberto/ })).toHaveAttribute(
        'tabindex',
        '-1',
      );
      all.focus();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(router.state.location.search).toEqual({ status: 'OPEN' }),
      );
      expect(screen.getByRole('tab', { name: /^Aberto/ })).toHaveFocus();
      await userEvent.keyboard('{End}');
      await waitFor(() =>
        expect(router.state.location.search).toEqual({ status: 'CLOSED' }),
      );
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => expect(router.state.location.search).toEqual({}));
      expect(screen.getByRole('tab', { name: /^Todos/ })).toHaveFocus();
    });

    it('asks for the counts with the filters but without status, sort and page', async () => {
      const api = mockApi();
      await renderApp(
        '/chamados?status=OPEN&priority=HIGH&q=vpn&sort=oldest&page=2',
        makeUser('ADMIN'),
      );
      await screen.findByRole('tablist');
      await waitFor(() =>
        expect(api.to('/api/v1/tickets/counts')).toHaveLength(1),
      );
      expect(
        Object.fromEntries(api.to('/api/v1/tickets/counts')[0]!.searchParams),
      ).toEqual({ priority: 'HIGH', q: 'vpn' });
    });
  });
});
