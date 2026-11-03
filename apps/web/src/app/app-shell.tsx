import { useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useAuth } from '../features/auth/use-auth';
import { navItemsFor } from './nav-items';
import { ProfileMenu } from './profile-menu';

const STORAGE_KEY = 'helpy.sidebar';
const COLLAPSE_BELOW = 1180;

function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'collapsed') return true;
    if (saved === 'expanded') return false;
  } catch {
    // Storage can be blocked; fall back to the viewport rule.
  }
  return window.innerWidth < COLLAPSE_BELOW;
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Not persisting is fine.
  }
}

export function AppShell() {
  const { state } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  if (state.status !== 'authenticated') return null;
  const { user } = state;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(next);
  }

  const toggleLabel = collapsed ? 'Expandir menu' : 'Recolher menu';
  const rowBase =
    'flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm outline-none focus-visible:ring-4 focus-visible:ring-focus';
  const rowIdle = collapsed
    ? 'text-white hover:bg-black/8 focus-visible:ring-white/70'
    : 'text-secondary hover:bg-ink/5';

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className={`sticky flex flex-none flex-col gap-0.5 overflow-y-auto p-3 pt-4 transition-[width] duration-200 ${
          collapsed
            ? 'top-2 my-2 h-[calc(100vh-16px)] w-16 rounded-r-3xl border-r border-brand bg-brand'
            : 'top-0 h-screen w-60 border-r border-line bg-white'
        }`}
      >
        <div className="flex items-center gap-2.5 px-1 pb-5">
          <div
            aria-hidden="true"
            className={`flex size-[34px] flex-none items-center justify-center rounded-xl font-display text-[17px] font-bold tracking-[-0.04em] ${
              collapsed ? 'bg-white text-brand' : 'bg-brand text-white'
            }`}
          >
            h!
          </div>
          {collapsed ? null : (
            <span className="font-display text-[21px] font-bold tracking-[-0.02em]">
              Helpy
            </span>
          )}
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {navItemsFor(user.role).map((item) => (
            <Link
              key={item.label}
              to={item.to}
              activeOptions={{ exact: true }}
              title={item.label}
              aria-label={item.label}
              className={`group ${rowBase} ${rowIdle} [&.active]:font-semibold ${
                collapsed
                  ? '[&.active]:bg-white [&.active]:text-[#9a3e00]'
                  : '[&.active]:bg-[#fff1e6] [&.active]:text-[#9a3e00]'
              } font-medium`}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`flex-none group-[.active]:text-brand ${collapsed ? '' : 'text-[#6b655f]'}`}
              >
                <path d={item.icon} />
              </svg>
              {collapsed ? null : (
                <span className="flex-1 whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggle}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          className={`${rowBase} ${rowIdle}`}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            className="flex-none"
          >
            <path d="M3 5h18v14H3zM9 5v14" />
          </svg>
          {collapsed ? null : <span>Recolher menu</span>}
        </button>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-none items-center justify-end gap-3 border-b border-line bg-white px-4 sm:px-6">
          <ProfileMenu user={user} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
