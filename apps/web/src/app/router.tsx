import { useEffect } from 'react';
import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useNavigate,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { AppShell } from './app-shell';
import { HomePage } from './home-page';
import { LoginPage } from '../features/auth/login-page';
import { SignupPage } from '../features/auth/signup-page';
import { safeRedirect } from '../features/auth/safe-redirect';
import {
  LoadingScreen,
  UnavailableScreen,
} from '../features/auth/session-screens';
import { useAuth, type AuthContextValue } from '../features/auth/use-auth';

type RouterContext = { auth: AuthContextValue };

function LoginRoute() {
  const { redirect } = loginRoute.useSearch();
  const navigate = useNavigate();
  return (
    <LoginPage
      redirect={redirect}
      navigate={(to) => void navigate({ to, replace: true })}
    />
  );
}

function SignupRoute() {
  const { redirect } = signupRoute.useSearch();
  const navigate = useNavigate();
  return (
    <SignupPage
      redirect={redirect}
      navigate={(to) => void navigate({ to, replace: true })}
    />
  );
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
  component: LoginRoute,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: loginRoute.options.validateSearch,
  beforeLoad: loginRoute.options.beforeLoad,
  component: SignupRoute,
});

// Protected layout: later slices add their pages as children.
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
  component: AppShell,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: HomePage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
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
