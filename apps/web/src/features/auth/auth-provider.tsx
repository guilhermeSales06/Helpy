import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionExpired } from '../../shared/api/client';
import { refreshSession, runWithRefreshLock } from '../../shared/api/refresh';
import { setAccessToken } from '../../shared/api/token-store';
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
  type LoginResult,
} from './use-auth';

type Settled = Exclude<AuthState, { status: 'loading' }>;

async function bootstrap(): Promise<Settled> {
  const refreshed = await refreshSession();
  if (refreshed.status === 'expired') return { status: 'anonymous' };
  if (refreshed.status === 'unavailable') return { status: 'unavailable' };

  try {
    const { data, response } = await api.GET('/api/v1/auth/me');
    if (data) return { status: 'authenticated', user: data };
    return response.status === 401
      ? { status: 'anonymous' }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // StrictMode mounts effects twice; refs survive that, so the bootstrap
  // sequence starts once.
  const started = useRef(false);

  const start = useCallback(() => {
    void bootstrap().then(setState);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.clear();
        setState({ status: 'anonymous' });
      }),
    [queryClient],
  );

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    start();
  }, [start]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const { data, response } = await api.POST('/api/v1/auth/login', {
          body: { email, password },
        });
        if (data) {
          setAccessToken(data.accessToken);
          setState({ status: 'authenticated', user: data.user });
          return 'ok';
        }
        return response.status === 401 ? 'invalid' : 'unavailable';
      } catch {
        return 'unavailable';
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // The logout request carries the refresh cookie, so it must not race a
      // rotation: reusing a refresh token ends every session.
      await runWithRefreshLock(() => api.POST('/api/v1/auth/logout'));
    } catch {
      // The local session ends even when the server cannot be reached.
    }
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'anonymous' });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, logout, retry }),
    [state, login, logout, retry],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
