import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  json,
  listBody,
  makeTicket,
  makeUser,
  mockApi,
  renderApp,
} from '../test/ticket-test-utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

const field = () =>
  screen.findByRole('searchbox', { name: 'Pesquisar chamados' });

describe('header search', () => {
  it.each(['TECHNICIAN', 'ADMIN'] as const)(
    'is there for a %s',
    async (role) => {
      mockApi();
      await renderApp('/', makeUser(role));
      expect(await field()).toBeInTheDocument();
    },
  );

  it('is not there for a client', async () => {
    mockApi();
    await renderApp('/', makeUser('CLIENT'));
    await screen.findByRole('navigation', { name: 'Principal' });
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('submits q to /chamados and keeps the other filters out', async () => {
    const api = mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    const { router } = await renderApp(
      '/chamados?priority=HIGH&status=OPEN&sort=oldest&page=2&assignee=me',
      makeUser('TECHNICIAN'),
    );
    await userEvent.type(await field(), '  vpn caiu {Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: 'vpn caiu' }),
    );
    expect(router.state.location.pathname).toBe('/chamados');
    await waitFor(() =>
      expect(Object.fromEntries(api.lastList()!.searchParams)).toEqual({
        q: 'vpn caiu',
        sort: 'newest',
        page: '1',
      }),
    );
  });

  it('takes the search to /chamados from another page', async () => {
    mockApi();
    const { router } = await renderApp('/', makeUser('ADMIN'));
    await userEvent.type(await field(), '#4821{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/chamados'),
    );
    expect(router.state.location.search).toEqual({ q: '#4821' });
  });

  it('searches by a number', async () => {
    const api = mockApi();
    const { router } = await renderApp('/', makeUser('ADMIN'));
    await userEvent.type(await field(), '4821{Enter}');
    await waitFor(() =>
      expect(api.lastList()?.searchParams.get('q')).toBe('4821'),
    );
    // The router reads a number-looking q back as a number.
    expect(router.state.location.pathname).toBe('/chamados');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Todos os chamados',
      }),
    ).toBeInTheDocument();
  });

  it('an empty search takes the search off but also the other filters', async () => {
    mockApi();
    const { router } = await renderApp(
      '/chamados?q=vpn&priority=HIGH',
      makeUser('ADMIN'),
    );
    const input = await field();
    await userEvent.clear(input);
    await userEvent.type(input, '   {Enter}');
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('shows the current q and clears it with the clear button', async () => {
    mockApi();
    const { router } = await renderApp(
      '/chamados?q=vpn&priority=HIGH',
      makeUser('ADMIN'),
    );
    const input = await field();
    expect(input).toHaveValue('vpn');
    await userEvent.click(
      screen.getByRole('button', { name: 'Limpar pesquisa' }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ priority: 'HIGH' }),
    );
    expect(input).toHaveValue('');
    expect(
      screen.queryByRole('button', { name: 'Limpar pesquisa' }),
    ).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('follows q when the list changes it (the chip next to the title)', async () => {
    mockApi({
      '/api/v1/tickets': () => json(listBody([makeTicket(1)])),
    });
    await renderApp('/chamados?q=vpn', makeUser('ADMIN'));
    expect(await field()).toHaveValue('vpn');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Limpar busca' }),
    );
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue(''));
  });

  it('keeps what was typed, without searching, until Enter', async () => {
    const api = mockApi();
    await renderApp('/chamados', makeUser('ADMIN'));
    const input = await field();
    await screen.findByText('Nenhum chamado encontrado');
    const requests = api.to('/api/v1/tickets').length;
    await userEvent.type(input, 'impressora');
    expect(input).toHaveValue('impressora');
    expect(api.to('/api/v1/tickets')).toHaveLength(requests);
  });

  it('has no Ctrl K hint, since there is no shortcut', async () => {
    mockApi();
    await renderApp('/', makeUser('ADMIN'));
    await field();
    expect(screen.queryByText(/ctrl/i)).not.toBeInTheDocument();
  });
});
