import { StrictMode, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../shared/api/client';
import { getAccessToken, setAccessToken } from '../../shared/api/token-store';
import { AuthProvider } from './auth-provider';
import { useAuth, type User } from './use-auth';

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

const newAccount = {
  name: 'Ana',
  email: 'ana@helpy.test',
  password: 'secret-123',
};

type Handler = (request: Request) => Response | Promise<Response>;

let routes: Record<string, Handler>;
let calls: string[];
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function status(code: number) {
  return new Response(null, { status: code });
}

let queryClient: QueryClient;

function setup(strict = false) {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => {
  calls = [];
  routes = {};
  queryClient = new QueryClient();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), 'http://localhost'), init);
    const { pathname } = new URL(request.url, 'http://localhost');
    calls.push(pathname);
    const handler = routes[pathname];
    if (!handler) throw new Error(`unexpected request to ${pathname}`);
    return handler(request);
  });
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

function sessionOk() {
  routes['/api/v1/auth/refresh'] = () => json({ accessToken: 'token-1' });
  routes['/api/v1/auth/me'] = () => json(user);
}

describe('AuthProvider', () => {
  it('starts loading and becomes authenticated when refresh and /me succeed', async () => {
    sessionOk();

    const { result } = setup();
    expect(result.current.state).toEqual({ status: 'loading' });

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'authenticated', user }),
    );
    expect(getAccessToken()).toBe('token-1');
  });

  it('becomes anonymous when the refresh is expired', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);

    const { result } = setup();

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'anonymous' }),
    );
    expect(calls).not.toContain('/api/v1/auth/me');
  });

  it('becomes anonymous when /me answers 401 after a successful refresh', async () => {
    let refreshes = 0;
    routes['/api/v1/auth/refresh'] = () =>
      refreshes++ === 0 ? json({ accessToken: 'token-1' }) : status(401);
    routes['/api/v1/auth/me'] = () => status(401);

    const { result } = setup();

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'anonymous' }),
    );
  });

  it('becomes unavailable when /me fails with a server error', async () => {
    routes['/api/v1/auth/refresh'] = () => json({ accessToken: 'token-1' });
    routes['/api/v1/auth/me'] = () => status(500);

    const { result } = setup();

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'unavailable' }),
    );
  });

  it('becomes unavailable on a server error, and retry() tries again', async () => {
    let healthy = false;
    routes['/api/v1/auth/refresh'] = () =>
      healthy ? json({ accessToken: 'token-1' }) : status(500);
    routes['/api/v1/auth/me'] = () => json(user);

    const { result } = setup();
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'unavailable' }),
    );

    healthy = true;
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: 'loading' });

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'authenticated', user }),
    );
  });

  it('refreshes only once under StrictMode', async () => {
    sessionOk();

    const { result } = setup(true);

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'authenticated', user }),
    );
    expect(calls.filter((c) => c === '/api/v1/auth/refresh')).toHaveLength(1);
    expect(calls.filter((c) => c === '/api/v1/auth/me')).toHaveLength(1);
  });

  it('login returns invalid on 401 and stays anonymous', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/login'] = () => status(401);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.login('ana@helpy.test', 'wrong');
    });

    expect(outcome).toBe('invalid');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('login returns unavailable on a 500 or network error', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/login'] = () => status(500);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let first;
    await act(async () => {
      first = await result.current.login('ana@helpy.test', 'secret');
    });
    expect(first).toBe('unavailable');

    routes['/api/v1/auth/login'] = () => {
      throw new TypeError('Failed to fetch');
    };
    let second;
    await act(async () => {
      second = await result.current.login('ana@helpy.test', 'secret');
    });
    expect(second).toBe('unavailable');
    expect(result.current.state).toEqual({ status: 'anonymous' });
  });

  it('login stores the token and the user', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/login'] = () => json({ accessToken: 'token-2', user });
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.login('ana@helpy.test', 'secret');
    });

    expect(outcome).toBe('ok');
    expect(getAccessToken()).toBe('token-2');
    expect(result.current.state).toEqual({ status: 'authenticated', user });
  });

  it('login returns rate-limited on 429', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/login'] = () => status(429);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.login('ana@helpy.test', 'secret');
    });

    expect(outcome).toBe('rate-limited');
    expect(result.current.state).toEqual({ status: 'anonymous' });
  });

  it('register stores the token and the user, like login', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    let body: unknown;
    routes['/api/v1/auth/register'] = async (request) => {
      body = await request.json();
      return json({ accessToken: 'token-2', user }, 201);
    };
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('ok');
    expect(body).toEqual(newAccount);
    expect(getAccessToken()).toBe('token-2');
    expect(result.current.state).toEqual({ status: 'authenticated', user });
  });

  it('register returns email-taken on 409 and stays anonymous', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/register'] = () => status(409);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('email-taken');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('register returns rate-limited on 429', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/register'] = () => status(429);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('rate-limited');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('register returns invalid on 400', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/register'] = () => status(400);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('invalid');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('register returns unavailable on a 500', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/register'] = () => status(500);
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('unavailable');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('register returns unavailable on a network error', async () => {
    routes['/api/v1/auth/refresh'] = () => status(401);
    routes['/api/v1/auth/register'] = () => {
      throw new TypeError('Failed to fetch');
    };
    const { result } = setup();
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    let outcome;
    await act(async () => {
      outcome = await result.current.register(newAccount);
    });

    expect(outcome).toBe('unavailable');
    expect(result.current.state).toEqual({ status: 'anonymous' });
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears the token and becomes anonymous even if the request fails', async () => {
    sessionOk();
    routes['/api/v1/auth/logout'] = () => {
      throw new TypeError('Failed to fetch');
    };
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.state.status).toBe('authenticated'),
    );

    await act(async () => {
      await result.current.logout();
    });

    expect(calls).toContain('/api/v1/auth/logout');
    expect(getAccessToken()).toBeNull();
    expect(result.current.state).toEqual({ status: 'anonymous' });
  });

  it('becomes anonymous when the session expires mid-use', async () => {
    sessionOk();
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.state.status).toBe('authenticated'),
    );

    routes['/api/v1/users'] = () => status(401);
    routes['/api/v1/auth/refresh'] = () => status(401);
    await act(async () => {
      await api.GET('/api/v1/users');
    });

    expect(result.current.state).toEqual({ status: 'anonymous' });
  });

  it('clears cached queries on logout and on expiry', async () => {
    sessionOk();
    routes['/api/v1/auth/logout'] = () => status(204);
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.state.status).toBe('authenticated'),
    );

    queryClient.setQueryData(['tickets'], ['secret']);
    await act(async () => {
      await result.current.logout();
    });
    expect(queryClient.getQueryData(['tickets'])).toBeUndefined();

    routes['/api/v1/auth/refresh'] = () => json({ accessToken: 'token-3' });
    routes['/api/v1/auth/login'] = () => json({ accessToken: 'token-3', user });
    await act(async () => {
      await result.current.login('ana@helpy.test', 'secret');
    });
    queryClient.setQueryData(['tickets'], ['secret']);
    routes['/api/v1/users'] = () => status(401);
    routes['/api/v1/auth/refresh'] = () => status(401);
    await act(async () => {
      await api.GET('/api/v1/users');
    });
    expect(queryClient.getQueryData(['tickets'])).toBeUndefined();
    expect(result.current.state).toEqual({ status: 'anonymous' });
  });
});
