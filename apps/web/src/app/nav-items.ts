import type { User } from '../features/auth/use-auth';

export type NavItem = { label: string; to: string; icon: string };

// SVG paths (24x24 viewBox) taken from the design.
const ICON = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  mine: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};

const overview: NavItem = {
  label: 'Visão geral',
  to: '/',
  icon: ICON.overview,
};
const mine: NavItem = { label: 'Meus chamados', to: '/', icon: ICON.mine };

/** Sidebar items for a role. Later slices add items and real routes. */
export function navItemsFor(role: User['role']): NavItem[] {
  return role === 'CLIENT' ? [mine] : [overview];
}
