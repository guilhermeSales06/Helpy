import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthContext,
  type AuthContextValue,
  type User,
} from '../features/auth/use-auth';
import { AppRouter, createAppRouter } from './router';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '6f1c1c8e-0000-4000-8000-000000000001',
    name: 'Mariana Costa',
    email: 'mariana@helpy.test',
    role: 'CLIENT',
    phone: null,
    specialty: null,
    areas: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function renderShell(
  user: User = makeUser(),
  logout = vi.fn(),
  path = '/',
) {
  const value: AuthContextValue = {
    state: { status: 'authenticated', user },
    login: vi.fn(),
    register: vi.fn(),
    logout,
    retry: vi.fn(),
  };
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  const tree = (
    <AuthContext value={value}>
      <AppRouter router={router} />
    </AuthContext>
  );
  const view = await act(async () => render(tree));
  await screen.findByRole('navigation', { name: 'Principal' });
  return { ...view, tree };
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  setWidth(1280);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app shell', () => {
  it.each([
    ['CLIENT', ['Meus chamados'], ['/']],
    [
      'TECHNICIAN',
      ['Visão geral', 'Meus chamados', 'Não atribuídos'],
      ['/', '/chamados?assignee=me', '/chamados?assignee=none'],
    ],
    [
      'ADMIN',
      ['Visão geral', 'Todos os chamados', 'Não atribuídos'],
      ['/', '/chamados', '/chamados?assignee=none'],
    ],
  ] as const)('shows the %s navigation', async (role, labels, hrefs) => {
    await renderShell(makeUser({ role }));
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(labels);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(hrefs);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(
      links.slice(1).filter((a) => a.hasAttribute('aria-current')),
    ).toEqual([]);
  });

  it.each([
    ['/chamados?assignee=me', 'Meus chamados'],
    ['/chamados?assignee=none', 'Não atribuídos'],
  ])('marks only the item of %s as current', async (path, current) => {
    await renderShell(makeUser({ role: 'TECHNICIAN' }), vi.fn(), path);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const active = within(nav)
      .getAllByRole('link')
      .filter((a) => a.hasAttribute('aria-current'));
    expect(active.map((a) => a.textContent)).toEqual([current]);
  });

  it('marks "Todos os chamados" as current for the admin on /chamados', async () => {
    await renderShell(makeUser({ role: 'ADMIN' }), vi.fn(), '/chamados');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const active = within(nav)
      .getAllByRole('link')
      .filter((a) => a.hasAttribute('aria-current'));
    expect(active.map((a) => a.textContent)).toEqual(['Todos os chamados']);
  });

  it('shows the user name and initials in the profile menu', async () => {
    await renderShell();
    const trigger = screen.getByRole('button', { name: /Mariana Costa/ });
    expect(trigger).toHaveTextContent('MC');
    await userEvent.click(trigger);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Mariana Costa')).toBeInTheDocument();
    expect(within(menu).getByText('Cliente')).toBeInTheDocument();
  });

  it('logs out from the profile menu', async () => {
    const logout = vi.fn(async () => {});
    await renderShell(makeUser(), logout);
    await userEvent.click(
      screen.getByRole('button', { name: /Mariana Costa/ }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );
    expect(logout).toHaveBeenCalledOnce();
  });

  it('collapses the sidebar and remembers it after reload', async () => {
    const first = await renderShell();
    const toggle = screen.getByRole('button', { name: 'Recolher menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    const expand = screen.getByRole('button', { name: 'Expandir menu' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    // collapsed items keep their accessible names
    expect(screen.getByRole('link', { name: 'Meus chamados' })).toHaveAttribute(
      'title',
      'Meus chamados',
    );
    first.unmount();

    await renderShell();
    expect(
      screen.getByRole('button', { name: 'Expandir menu' }),
    ).toBeInTheDocument();
  });

  it('still renders when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await renderShell();
    await userEvent.click(
      screen.getByRole('button', { name: 'Recolher menu' }),
    );
    expect(
      screen.getByRole('button', { name: 'Expandir menu' }),
    ).toBeInTheDocument();
  });

  it('starts collapsed below 1180px when nothing is saved', async () => {
    setWidth(1000);
    await renderShell();
    expect(
      screen.getByRole('button', { name: 'Expandir menu' }),
    ).toBeInTheDocument();
  });

  it('prefers the saved choice over the viewport width', async () => {
    setWidth(1000);
    localStorage.setItem('helpy.sidebar', 'expanded');
    await renderShell();
    expect(
      screen.getByRole('button', { name: 'Recolher menu' }),
    ).toBeInTheDocument();
  });

  it('home greets the user by first name', async () => {
    await renderShell();
    expect(
      screen.getByRole('heading', { name: 'Olá, Mariana.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Seus chamados vão aparecer aqui.'),
    ).toBeInTheDocument();
  });
});
