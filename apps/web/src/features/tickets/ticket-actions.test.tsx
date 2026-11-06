import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ME,
  type Handler,
  TECH_ID,
  json,
  listBody,
  makeTicket,
  makeUser,
  mockApi,
  renderApp,
  ticketId,
} from '../../test/ticket-test-utils';
import type { User } from '../auth/use-auth';
import type { Ticket } from './ticket-model';

afterEach(() => {
  vi.unstubAllGlobals();
});

const ID = ticketId(7);
const path = `/api/v1/tickets/${ID}`;
const MINE = { id: ME, name: 'Junior Silva' };
const OTHER = { id: TECH_ID, name: 'Rafael Mendes' };

/**
 * A ticket the API keeps in memory: GET answers with it, and each PATCH in
 * `changes` replaces it with what the action would leave behind.
 */
function serve(
  initial: Ticket,
  changes: Record<string, (current: Ticket, body: unknown) => Ticket> = {},
  overrides: Record<string, Handler> = {},
) {
  let current = initial;
  const routes: Record<string, Handler> = {
    [path]: () => json(current),
    '/api/v1/users': () =>
      json(
        listBody([
          makeUser('TECHNICIAN', OTHER),
          makeUser('TECHNICIAN', { id: ME, name: 'Junior Silva' }),
        ]),
      ),
  };
  for (const [action, change] of Object.entries(changes)) {
    routes[`${path}/${action}`] = async (_url, request) => {
      current = change(
        current,
        await request
          .clone()
          .json()
          .catch(() => null),
      );
      return json(current);
    };
  }
  const api = mockApi({ ...routes, ...overrides });
  return {
    ...api,
    set: (next: Ticket) => {
      current = next;
    },
    patches: (action: string) => api.to(`${path}/${action}`),
  };
}

const open = (user: User) => renderApp(`/chamados/${ID}`, user);

const tech = makeUser('TECHNICIAN');
const admin = makeUser('ADMIN');
const client = makeUser('CLIENT');

function ticket(overrides: Partial<Ticket> = {}) {
  return makeTicket(7, overrides);
}

const actionCases: [string, User, Partial<Ticket>, string[]][] = [
  ['technician, ticket in the queue', tech, {}, ['Assumir']],
  [
    'technician, assigned and in progress',
    tech,
    { status: 'IN_PROGRESS', technician: MINE },
    [
      'Devolver à fila',
      'Marcar como pendente',
      'Resolver',
      'Alterar prioridade',
    ],
  ],
  [
    'technician, assigned and pending',
    tech,
    { status: 'PENDING', technician: MINE },
    ['Devolver à fila', 'Retomar', 'Alterar prioridade'],
  ],
  [
    'technician, assigned and resolved',
    tech,
    { status: 'RESOLVED', technician: MINE },
    ['Reabrir', 'Alterar prioridade'],
  ],
  [
    'technician, ticket of another technician',
    tech,
    { status: 'IN_PROGRESS', technician: OTHER },
    [],
  ],
  ['admin, open ticket', admin, {}, ['Atribuir', 'Alterar prioridade']],
  [
    'admin, ticket in progress',
    admin,
    { status: 'IN_PROGRESS', technician: OTHER },
    ['Atribuir', 'Marcar como pendente', 'Resolver', 'Alterar prioridade'],
  ],
  [
    'admin, ticket pending',
    admin,
    { status: 'PENDING', technician: OTHER },
    ['Atribuir', 'Retomar', 'Alterar prioridade'],
  ],
  [
    'admin, resolved ticket',
    admin,
    { status: 'RESOLVED', technician: OTHER },
    ['Reabrir', 'Alterar prioridade'],
  ],
  ['admin, closed ticket', admin, { status: 'CLOSED' }, []],
  [
    'technician, closed ticket',
    tech,
    { status: 'CLOSED', technician: MINE },
    [],
  ],
  ['client', client, {}, []],
];

describe('ticket actions', () => {
  it.each(actionCases)(
    'renders exactly the buttons allowed for %s',
    async (_name, user, overrides, expected) => {
      serve(ticket(overrides));
      await open(user);
      await screen.findByRole('heading', { level: 1 });

      const bar = screen.queryByRole('group', { name: 'Ações do chamado' });
      if (expected.length === 0) {
        expect(bar).not.toBeInTheDocument();
        return;
      }
      const buttons = within(bar!).getAllByRole('button');
      expect(
        buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent),
      ).toEqual(expected);
      for (const button of buttons) {
        expect(button.tagName).toBe('BUTTON');
      }
    },
  );

  it('Assumir sends one request even on a double click and then shows the ticket as IN_PROGRESS and mine', async () => {
    const api: ReturnType<typeof serve> = serve(
      ticket(),
      {},
      {
        // Slow enough for the second click to arrive while the first runs.
        [`${path}/take`]: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          const taken: Ticket = {
            ...ticket(),
            status: 'IN_PROGRESS',
            technician: MINE,
          };
          api.set(taken);
          return json(taken);
        },
      },
    );
    await open(tech);
    await userEvent.dblClick(
      await screen.findByRole('button', { name: 'Assumir' }),
    );

    const panel = await screen.findByRole('complementary', {
      name: 'Propriedades',
    });
    // The answer was applied only once the ticket was read again.
    await waitFor(() =>
      expect(within(panel).getByText('Junior Silva')).toBeInTheDocument(),
    );
    expect(api.patches('take')).toHaveLength(1);
  });

  it('shows the ticket as taken after Assumir: in progress, mine, and no Assumir', async () => {
    serve(ticket(), {
      take: (current) => ({
        ...current,
        status: 'IN_PROGRESS',
        technician: MINE,
      }),
    });
    await open(tech);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assumir' }),
    );

    const heading = await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(
        within(heading.closest('header')!).getByText('Em andamento'),
      ).toBeInTheDocument(),
    );
    const panel = screen.getByRole('complementary', { name: 'Propriedades' });
    expect(within(panel).getByText('Junior Silva')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assumir' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Devolver à fila' }),
    ).toBeInTheDocument();
  });

  it('Devolver à fila asks for confirmation, then releases and the ticket shows as OPEN, unassigned', async () => {
    const api = serve(ticket({ status: 'IN_PROGRESS', technician: MINE }), {
      release: (current) => ({ ...current, status: 'OPEN', technician: null }),
    });
    await open(tech);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Devolver à fila' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('Devolver este chamado à fila?'),
    ).toBeInTheDocument();
    // Nothing is sent before the person confirms.
    expect(api.patches('release')).toHaveLength(0);

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Devolver' }),
    );

    const panel = screen.getByRole('complementary', { name: 'Propriedades' });
    await waitFor(() =>
      expect(within(panel).getByText('Não atribuído')).toBeInTheDocument(),
    );
    expect(api.patches('release')).toHaveLength(1);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(
      within(heading.closest('header')!).getByText('Aberto'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assumir' })).toBeInTheDocument();
  });

  it('cancelling or pressing Esc on the confirmation sends nothing and returns the focus', async () => {
    const api = serve(ticket({ status: 'IN_PROGRESS', technician: MINE }), {
      release: (current) => ({ ...current, status: 'OPEN', technician: null }),
    });
    await open(tech);
    const trigger = await screen.findByRole('button', {
      name: 'Devolver à fila',
    });

    await userEvent.click(trigger);
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );

    await userEvent.click(trigger);
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(api.patches('release')).toHaveLength(0);
  });

  it.each([
    ['Marcar como pendente', 'IN_PROGRESS', 'PENDING', 'Pendente'],
    ['Retomar', 'PENDING', 'IN_PROGRESS', 'Em andamento'],
    ['Resolver', 'IN_PROGRESS', 'RESOLVED', 'Resolvido'],
    ['Reabrir', 'RESOLVED', 'IN_PROGRESS', 'Em andamento'],
  ] as const)(
    '%s sends status %s -> %s and the badge follows',
    async (label, from, to, badge) => {
      const api = serve(ticket({ status: from, technician: MINE }), {
        status: (current, body) => ({
          ...current,
          status: (body as { status: Ticket['status'] }).status,
        }),
      });
      await open(tech);
      await userEvent.click(await screen.findByRole('button', { name: label }));

      const heading = await screen.findByRole('heading', { level: 1 });
      await waitFor(() =>
        expect(
          within(heading.closest('header')!).getByText(badge),
        ).toBeInTheDocument(),
      );
      const [request] = api.patches('status');
      expect(request).toBeDefined();
      expect(api.patches('status')).toHaveLength(1);
      expect(
        await screen.findByRole('button', {
          name: {
            IN_PROGRESS: 'Marcar como pendente',
            PENDING: 'Retomar',
            RESOLVED: 'Reabrir',
          }[to],
        }),
      ).toBeInTheDocument();
    },
  );

  it('changing priority uses the menu and updates the badge', async () => {
    const sent: unknown[] = [];
    serve(ticket({ status: 'IN_PROGRESS', technician: MINE }), {
      priority: (current, body) => {
        sent.push(body);
        return {
          ...current,
          priority: (body as { priority: Ticket['priority'] }).priority,
        };
      },
    });
    await open(tech);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Alterar prioridade' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Alta' }),
    );

    const heading = await screen.findByRole('heading', { level: 1 });
    await waitFor(() =>
      expect(
        within(heading.closest('header')!).getByText('Alta'),
      ).toBeInTheDocument(),
    );
    expect(sent).toEqual([{ priority: 'HIGH' }]);
  });

  it('admin picks a technician in "Atribuir" and the ticket shows him as Responsável', async () => {
    const sent: unknown[] = [];
    const api = serve(ticket(), {
      assign: (current, body) => {
        sent.push(body);
        return { ...current, status: 'IN_PROGRESS', technician: OTHER };
      },
    });
    await open(admin);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Atribuir' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Rafael Mendes' }),
    );

    const panel = screen.getByRole('complementary', { name: 'Propriedades' });
    await waitFor(() =>
      expect(within(panel).getByText('Rafael Mendes')).toBeInTheDocument(),
    );
    expect(sent).toEqual([{ technicianId: TECH_ID }]);
    // The technicians are the ones the list page already asks for.
    expect(api.to('/api/v1/users')).toHaveLength(1);
    expect(api.to('/api/v1/users')[0]!.searchParams.get('role')).toBe(
      'TECHNICIAN',
    );
  });

  it('a technician never asks for the list of technicians', async () => {
    const api = serve(ticket());
    await open(tech);
    await screen.findByRole('button', { name: 'Assumir' });
    expect(api.to('/api/v1/users')).toHaveLength(0);
  });

  it('on 409 shows "Este chamado foi alterado por outra pessoa. Atualizamos os dados." and refreshes the ticket', async () => {
    let taken = false;
    const server = serve(
      ticket(),
      {},
      {
        [path]: () =>
          json(
            taken
              ? ticket({ status: 'IN_PROGRESS', technician: OTHER })
              : ticket(),
          ),
        [`${path}/take`]: () => {
          taken = true;
          return json({ message: 'conflict' }, 409);
        },
      },
    );
    await open(tech);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assumir' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este chamado foi alterado por outra pessoa. Atualizamos os dados.',
    );
    const panel = screen.getByRole('complementary', { name: 'Propriedades' });
    await waitFor(() =>
      expect(within(panel).getByText('Rafael Mendes')).toBeInTheDocument(),
    );
    // Read once on arrival and once more after the 409.
    expect(server.to(path).length).toBe(2);
    // The message stays, even though nothing is left for this person to do.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assumir' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    [403, 'Você não tem permissão para fazer isso neste chamado.'],
    [404, 'Este chamado não está mais disponível para você.'],
  ])(
    'on %s after an action shows a clear message without breaking the page',
    async (status, message) => {
      let gone = false;
      serve(
        ticket(),
        {},
        {
          // After a 404 the ticket can no longer be read either.
          [path]: () =>
            gone ? json({ message: 'not found' }, 404) : json(ticket()),
          [`${path}/take`]: () => {
            gone = status === 404;
            return json({ message: 'no' }, status);
          },
        },
      );
      await open(tech);
      await userEvent.click(
        await screen.findByRole('button', { name: 'Assumir' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(
        screen.getByRole('heading', { level: 1, name: 'Chamado número 7' }),
      ).toBeInTheDocument();
    },
  );

  it('on network error shows "Não foi possível concluir a ação. Tente de novo." and keeps the buttons usable', async () => {
    let attempts = 0;
    const api = serve(
      ticket(),
      {},
      {
        [`${path}/take`]: () => {
          attempts += 1;
          throw new TypeError('Failed to fetch');
        },
      },
    );
    await open(tech);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Assumir' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a ação. Tente de novo.',
    );
    const again = screen.getByRole('button', { name: 'Assumir' });
    await waitFor(() => expect(again).toBeEnabled());
    await userEvent.click(again);
    await waitFor(() => expect(attempts).toBe(2));
    expect(api.patches('take')).toHaveLength(2);
  });

  it('buttons are disabled while an action is running and are real <button>s with accessible names', async () => {
    let release: () => void = () => {};
    const api: ReturnType<typeof serve> = serve(
      ticket({ status: 'IN_PROGRESS', technician: MINE }),
      {},
      {
        [`${path}/status`]: async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          const resolved = ticket({ status: 'RESOLVED', technician: MINE });
          api.set(resolved);
          return json(resolved);
        },
      },
    );
    await open(tech);
    const bar = await screen.findByRole('group', { name: 'Ações do chamado' });
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      expect(button).toBeEnabled();
      expect(button).toHaveAccessibleName();
    }

    await userEvent.click(
      within(bar).getByRole('button', { name: 'Resolver' }),
    );
    await waitFor(() => {
      for (const button of within(bar).getAllByRole('button')) {
        expect(button).toBeDisabled();
      }
    });

    release();
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('group', { name: 'Ações do chamado' }),
        ).getByRole('button', { name: 'Reabrir' }),
      ).toBeEnabled(),
    );
  });
});
