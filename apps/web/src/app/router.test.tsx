import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory, createRoute } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
  type User,
} from '../features/auth/use-auth';
import { AppRouter, createAppRouter } from './router';

const user: User = {
  id: '6f1c1c8e-0000-4000-8000-000000000001',
  name: 'Ana',
  email: 'ana@helpy.test',
  role: 'CLIENT',
  phone: null,
  specialty: null,
  areas: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function auth(
  state: AuthState,
  retry = vi.fn(),
  login = vi.fn(),
): AuthContextValue {
  return {
    state,
    login,
    register: vi.fn(),
    logout: vi.fn(),
    retry,
  };
}

// Adds a protected page that exists only in tests, under the real `_app`
// guard. The route tree is shared, so this runs once, before any router
// used by a test is created.
(function addExtraPage() {
  const appRoute = createAppRouter().routesById['/_app' as never] as never as {
    addChildren: (c: unknown[]) => unknown;
    children: unknown[];
  };
  const extra = createRoute({
    getParentRoute: () => appRoute as never,
    path: '/x',
    component: () => <h1>Página X</h1>,
  });
  appRoute.addChildren([...appRoute.children, extra]);
})();

function setup(
  initial: string,
  state: AuthState,
  retry = vi.fn(),
  login = vi.fn(),
) {
  const history = createMemoryHistory({ initialEntries: [initial] });
  const router = createAppRouter(history);
  const tree = (value: AuthContextValue) => (
    <AuthContext value={value}>
      <AppRouter router={router} />
    </AuthContext>
  );
  const view = render(tree(auth(state, retry, login)));
  return {
    router,
    change: (next: AuthState) =>
      act(async () => view.rerender(tree(auth(next, retry, login)))),
  };
}

const authenticated: AuthState = { status: 'authenticated', user };

/** The search the list screen receives, after validation. */
function listSearch(router: ReturnType<typeof createAppRouter>) {
  return router.state.matches.find((m) => m.routeId === '/_app/chamados')
    ?.search;
}

const TICKET_ID = '6f1c1c8e-0000-4000-8000-0000000000c3';

describe('router', () => {
  it('sends anonymous visitors to /login with the page they wanted', async () => {
    const { router } = setup('/', { status: 'anonymous' });
    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo de volta' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/' });
  });

  it('keeps the wanted page, with its query, in the redirect', async () => {
    const { router } = setup('/login?redirect=%2Fx', { status: 'anonymous' });
    await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
    expect(router.state.location.search).toEqual({ redirect: '/x' });
  });

  it('shows a loading screen while the session is unknown', async () => {
    const { router } = setup('/', { status: 'loading' });
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando');
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows the error screen with "Tentar de novo" when unavailable', async () => {
    const retry = vi.fn();
    setup('/', { status: 'unavailable' }, retry);
    expect(
      await screen.findByText('Não foi possível conectar ao Helpy.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );
    expect(retry).toHaveBeenCalledOnce();
  });

  it('sends authenticated visitors away from /login', async () => {
    const { router } = setup('/login', authenticated);
    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('returns to the original page after login', async () => {
    const { router, change } = setup('/', { status: 'loading' });
    await change({ status: 'anonymous' });
    await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
    await change(authenticated);
    expect(
      await screen.findByRole('heading', { name: 'Olá, Ana.' }),
    ).toBeInTheDocument();
    expect(router.state.location.href).toBe('/');
  });

  it('goes to / when redirect points to another site', async () => {
    const { router } = setup(
      `/login?redirect=${encodeURIComponent('https://evil.com')}`,
      authenticated,
    );
    await screen.findByRole('heading', { name: 'Olá, Ana.' });
    expect(router.state.location.href).toBe('/');
  });

  it('does not add history entries when the session expires', async () => {
    const { router, change } = setup('/', authenticated);
    await screen.findByRole('heading', { name: 'Olá, Ana.' });
    const before = router.history.length;
    await change({ status: 'anonymous' });
    await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/' });
    // Router behavior (beforeLoad redirects replace), not proof of our flag.
    expect(router.history.length - before).toBe(0);
    await change(authenticated);
    await screen.findByRole('heading', { name: 'Olá, Ana.' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('keeps query and hash through login and back', async () => {
    const login = vi.fn(async () => 'ok' as const);
    const { router, change } = setup(
      '/x?a=1#h',
      { status: 'anonymous' },
      vi.fn(),
      login,
    );
    await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
    expect(router.state.location.search).toEqual({ redirect: '/x?a=1#h' });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail'), 'ana@helpy.test');
    await u.type(screen.getByLabelText('Senha'), 'secret');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(login).toHaveBeenCalled();
    await change(authenticated);
    await screen.findByRole('heading', { name: 'Página X' });
    expect(router.state.location.pathname).toBe('/x');
    expect(router.state.location.search).toEqual({ a: 1 });
    expect(router.state.location.hash).toBe('h');
  });

  it('lands on a redirect target with a query when already signed in', async () => {
    const { router } = setup('/login?redirect=%2Fx%3Fa%3D1', authenticated);
    await screen.findByRole('heading', { name: 'Página X' });
    expect(router.state.location.pathname).toBe('/x');
    expect(router.state.location.search).toEqual({ a: 1 });
  });

  it('an authenticated visitor on /cadastro is sent away', async () => {
    const { router } = setup('/cadastro', authenticated);
    await screen.findByRole('heading', { name: 'Olá, Ana.' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('sends an authenticated visitor on /cadastro to the safe redirect', async () => {
    const { router } = setup('/cadastro?redirect=%2Fx', authenticated);
    await screen.findByRole('heading', { name: 'Página X' });
    expect(router.state.location.pathname).toBe('/x');
  });

  it('keeps /cadastro?redirect=https://site-externo.com inside Helpy', async () => {
    const { router } = setup(
      `/cadastro?redirect=${encodeURIComponent('https://site-externo.com')}`,
      authenticated,
    );
    await screen.findByRole('heading', { name: 'Olá, Ana.' });
    expect(router.state.location.href).toBe('/');
  });

  it('an anonymous visitor can open /cadastro and /login links to it', async () => {
    const { router } = setup('/login?redirect=%2Fx', { status: 'anonymous' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('link', { name: 'Criar conta' }));
    await screen.findByRole('heading', { name: 'Crie sua conta' });
    expect(router.state.location.pathname).toBe('/cadastro');
    expect(router.state.location.search).toEqual({ redirect: '/x' });
    await u.click(screen.getByRole('link', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
    expect(router.state.location.search).toEqual({ redirect: '/x' });
  });

  it('opens /cadastro directly for an anonymous visitor', async () => {
    const { router } = setup('/cadastro', { status: 'anonymous' });
    await screen.findByRole('heading', { name: 'Crie sua conta' });
    expect(router.state.location.pathname).toBe('/cadastro');
  });

  describe('tickets', () => {
    it('/chamados asks for login and keeps the filters in the redirect', async () => {
      const { router } = setup('/chamados?status=OPEN&q=rede', {
        status: 'anonymous',
      });
      await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.search).toEqual({
        redirect: '/chamados?status=OPEN&q=rede',
      });
    });

    it('/chamados/<id> asks for login and comes back to the ticket', async () => {
      const login = vi.fn(async () => 'ok' as const);
      const { router, change } = setup(
        `/chamados/${TICKET_ID}`,
        { status: 'anonymous' },
        vi.fn(),
        login,
      );
      await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
      expect(router.state.location.search).toEqual({
        redirect: `/chamados/${TICKET_ID}`,
      });
      await change(authenticated);
      await screen.findByRole('heading', { name: 'Chamado' });
      expect(router.state.location.pathname).toBe(`/chamados/${TICKET_ID}`);
    });

    it('opens the list with the filters from the URL', async () => {
      const { router } = setup(
        '/chamados?status=IN_PROGRESS&assignee=me&q=rede&sort=priority&page=2',
        authenticated,
      );
      await screen.findByRole('heading', { name: 'Chamados' });
      expect(router.state.location.search).toEqual({
        status: 'IN_PROGRESS',
        assignee: 'me',
        q: 'rede',
        sort: 'priority',
        page: 2,
      });
    });

    it('keeps the filters after login', async () => {
      const { router, change } = setup('/chamados?status=OPEN&q=rede', {
        status: 'loading',
      });
      await change({ status: 'anonymous' });
      await screen.findByRole('heading', { name: 'Bem-vindo de volta' });
      await change(authenticated);
      await screen.findByRole('heading', { name: 'Chamados' });
      expect(router.state.location.search).toEqual({
        status: 'OPEN',
        q: 'rede',
      });
    });

    it('does not break on an invalid URL, and falls back to the defaults', async () => {
      const { router } = setup(
        '/chamados?status=XYZ&page=-3&sort=foo&assignee=',
        authenticated,
      );
      await screen.findByRole('heading', { name: 'Chamados' });
      expect(listSearch(router)).toEqual({ sort: 'newest', page: 1 });
    });

    it('reads a q that looks like a number', async () => {
      const { router } = setup('/chamados?q=4821', authenticated);
      await screen.findByRole('heading', { name: 'Chamados' });
      expect(listSearch(router)).toEqual({
        q: '4821',
        sort: 'newest',
        page: 1,
      });
    });

    it('opens a ticket by its id', async () => {
      setup(`/chamados/${TICKET_ID}`, authenticated);
      expect(
        await screen.findByRole('heading', { name: 'Chamado' }),
      ).toBeInTheDocument();
    });
  });
});
