import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AREA_ID,
  CATEGORY_ID,
  ME,
  TECH_ID,
  json,
  listBody,
  makeTicket,
  makeUser,
  mockApi,
  renderApp,
} from '../../test/ticket-test-utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const OTHER_CATEGORY_ID = '6f1c1c8e-0000-4000-8000-0000000000c4';

const categories = [
  {
    id: CATEGORY_ID,
    name: 'Acesso e senhas',
    area: { id: AREA_ID, name: 'Suporte' },
  },
  {
    id: OTHER_CATEGORY_ID,
    name: 'Impressoras',
    area: { id: AREA_ID, name: 'Suporte' },
  },
];

const technicians = [
  makeUser('TECHNICIAN', { id: TECH_ID, name: 'Rafael Mendes' }),
  makeUser('TECHNICIAN', {
    id: '6f1c1c8e-0000-4000-8000-0000000000b3',
    name: 'Paula Dias',
  }),
];

function setup(routes: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    '/api/v1/categories': () => json(categories),
    '/api/v1/users': () => json(listBody(technicians)),
    ...routes,
  });
}

async function openMenu(name: string | RegExp) {
  await userEvent.click(await screen.findByRole('button', { name }));
  return screen.findByRole('menu');
}

function optionNames(menu: HTMLElement) {
  return within(menu)
    .getAllByRole('menuitemradio')
    .map((item) => item.textContent);
}

describe('ticket filters', () => {
  it('shows the filters Prioridade, Responsável, Categoria and the sort menu', async () => {
    setup();
    await renderApp('/chamados', makeUser('ADMIN'));
    expect(
      await screen.findByRole('button', { name: 'Prioridade: Todas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Responsável: Todos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Categoria: Todas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ordenar por: Mais recentes' }),
    ).toBeInTheDocument();
  });

  it('a priority writes to the URL, to the request, and resets the page', async () => {
    const api = setup();
    const { router } = await renderApp('/chamados?page=3', makeUser('ADMIN'));
    const before = router.history.length;

    const menu = await openMenu('Prioridade: Todas');
    expect(optionNames(menu)).toEqual([
      'Todas',
      'Baixa',
      'Média',
      'Alta',
      'Urgente',
    ]);
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Alta' }),
    );

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Prioridade: Alta' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('priority')).toBe('HIGH'),
    );
    expect(api.lastList()!.searchParams.get('page')).toBe('1');
    // A filter replaces the entry; it does not stack history.
    expect(router.history.length).toBe(before);
  });

  it('"Todas" takes the priority back out', async () => {
    setup();
    const { router } = await renderApp(
      '/chamados?priority=URGENT',
      makeUser('ADMIN'),
    );
    const menu = await openMenu('Prioridade: Urgente');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Urgente' }),
    ).toBeChecked();
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Todas' }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('lists the categories from the API and writes the chosen one', async () => {
    const api = setup();
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const menu = await openMenu('Categoria: Todas');
    await waitFor(() =>
      expect(optionNames(menu)).toEqual([
        'Todas',
        'Acesso e senhas',
        'Impressoras',
      ]),
    );
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Impressoras' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        category: OTHER_CATEGORY_ID,
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Categoria: Impressoras' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('categoryId')).toBe(
        OTHER_CATEGORY_ID,
      ),
    );
  });

  it('the sort menu writes sort to the URL; the default stays out of it', async () => {
    const api = setup();
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const menu = await openMenu('Ordenar por: Mais recentes');
    expect(optionNames(menu)).toEqual([
      'Mais recentes',
      'Atualizados recentemente',
      'Mais antigos',
      'Maior prioridade',
    ]);
    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Maior prioridade' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ sort: 'priority' }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Ordenar por: Maior prioridade',
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('sort')).toBe('priority'),
    );

    const again = await openMenu('Ordenar por: Maior prioridade');
    await userEvent.click(
      within(again).getByRole('menuitemradio', { name: 'Mais recentes' }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('a technician sees only "Eu" and "Não atribuído" in Responsável, and no list of technicians is fetched', async () => {
    const api = setup();
    const { router } = await renderApp('/chamados', makeUser('TECHNICIAN'));
    const menu = await openMenu('Responsável: Todos');
    expect(optionNames(menu)).toEqual(['Todos', 'Eu', 'Não atribuído']);
    expect(api.to('/api/v1/users')).toHaveLength(0);

    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Eu' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ assignee: 'me' }),
    );
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('technicianId')).toBe(ME),
    );
    expect(
      await screen.findByRole('button', { name: 'Responsável: Eu' }),
    ).toBeInTheDocument();

    const again = await openMenu('Responsável: Eu');
    await userEvent.click(
      within(again).getByRole('menuitemradio', { name: 'Não atribuído' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ assignee: 'none' }),
    );
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('unassigned')).toBe('true'),
    );
    expect(api.lastList()!.searchParams.has('technicianId')).toBe(false);
  });

  it('an admin also sees the technicians in Responsável', async () => {
    const api = setup();
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const menu = await openMenu('Responsável: Todos');
    await waitFor(() =>
      expect(optionNames(menu)).toEqual([
        'Todos',
        'Não atribuído',
        'Rafael Mendes',
        'Paula Dias',
      ]),
    );
    const users = api.to('/api/v1/users')[0]!;
    expect(Object.fromEntries(users.searchParams)).toEqual({
      role: 'TECHNICIAN',
      active: 'true',
      limit: '100',
    });

    await userEvent.click(
      within(menu).getByRole('menuitemradio', { name: 'Rafael Mendes' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ assignee: TECH_ID }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Responsável: Rafael Mendes',
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.lastList()!.searchParams.get('technicianId')).toBe(TECH_ID),
    );
  });

  it('works from the keyboard: open with Enter, move with the arrows, choose with Enter', async () => {
    setup();
    const { router } = await renderApp('/chamados', makeUser('ADMIN'));
    const trigger = await screen.findByRole('button', {
      name: 'Prioridade: Todas',
    });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
    );
  });

  it('shows "Limpar filtros" only with a filter set, and it clears them but not the sort or the search', async () => {
    setup();
    const { router } = await renderApp(
      `/chamados?priority=HIGH&status=OPEN&category=${CATEGORY_ID}&sort=oldest&q=vpn`,
      makeUser('ADMIN'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Limpar filtros' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        sort: 'oldest',
        q: 'vpn',
      }),
    );
    expect(
      screen.queryByRole('button', { name: 'Limpar filtros' }),
    ).not.toBeInTheDocument();
  });
});
