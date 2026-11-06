import type { User } from '../features/auth/use-auth';

export type NavItem = {
  label: string;
  to: '/' | '/chamados';
  /** Filters of `/chamados`. */
  search?: { assignee: 'me' | 'none' };
  icon: string;
};

// SVG paths (24x24 viewBox) taken from the design.
const ICON = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  mine: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  all: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  queue:
    'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
};

const overview: NavItem = {
  label: 'Visão geral',
  to: '/',
  icon: ICON.overview,
};
const clientMine: NavItem = {
  label: 'Meus chamados',
  to: '/',
  icon: ICON.mine,
};
const mine: NavItem = {
  label: 'Meus chamados',
  to: '/chamados',
  search: { assignee: 'me' },
  icon: ICON.mine,
};
const all: NavItem = {
  label: 'Todos os chamados',
  to: '/chamados',
  icon: ICON.all,
};
const unassigned: NavItem = {
  label: 'Não atribuídos',
  to: '/chamados',
  search: { assignee: 'none' },
  icon: ICON.queue,
};

/** Sidebar items for a role. The client's own screen is a later slice. */
export function navItemsFor(role: User['role']): NavItem[] {
  switch (role) {
    case 'CLIENT':
      return [clientMine];
    case 'TECHNICIAN':
      return [overview, mine, unassigned];
    case 'ADMIN':
      return [overview, all, unassigned];
  }
}
