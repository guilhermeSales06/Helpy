import { useEffect } from 'react';
import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { safeRedirect } from '../features/auth/safe-redirect';
import {
  LoadingScreen,
  UnavailableScreen,
} from '../features/auth/session-screens';
import { useAuth, type AuthContextValue } from '../features/auth/use-auth';

type RouterContext = { auth: AuthContextValue };

// PLACEHOLDER: Task 5 replaces this with the real login page.
function LoginPlaceholder() {
  return <h1>Entrar</h1>;
}

// PLACEHOLDER: Task 6 replaces this with the real home page inside the shell.
function HomePlaceholder() {
  return <h1>Início</h1>;
}

function RootGate() {
  const { state, retry } = useAuth();
  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'unavailable') {
    return <UnavailableScreen onRetry={retry} />;
  }
  return <Outlet />;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootGate,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  beforeLoad: ({ context, search }) => {
    if (context.auth.state.status === 'authenticated') {
      throw redirect({ to: safeRedirect(search.redirect), replace: true });
    }
  },
  component: LoginPlaceholder,
});

// Protected layout: later slices add their pages as children.
// PLACEHOLDER: Task 6 swaps the bare Outlet for the app shell.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: ({ context, location }) => {
    if (context.auth.state.status === 'anonymous') {
      throw redirect({
        to: '/login',
        search: { redirect: safeRedirect(location.href) },
        replace: true,
      });
    }
  },
  component: Outlet,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: HomePlaceholder,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([homeRoute]),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { auth: undefined! },
  });
}

export type AppRouterInstance = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouterInstance;
  }
}

/** Feeds the session into the router and re-runs the guards when it changes. */
export function AppRouter({ router }: { router: AppRouterInstance }) {
  const auth = useAuth();
  const status = auth.state.status;

  useEffect(() => {
    void router.invalidate();
  }, [router, status]);

  return <RouterProvider router={router} context={{ auth }} />;
}
