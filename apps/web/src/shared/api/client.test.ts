import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, onSessionExpired } from './client';
import { getAccessToken, setAccessToken } from './token-store';

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// The client sends Request objects; refreshSession sends a URL string.
function isRefresh(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input);
  return new URL(url, 'http://localhost').pathname.endsWith('/auth/refresh');
}

/** Answers every call by path; `/me` is 401 unless it carries `validToken`. */
function serve(options: {
  validToken?: string;
  refresh?: () => Response | Promise<Response>;
}) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (isRefresh(input)) {
      return (await options.refresh?.()) ?? json({ accessToken: 'new' }, 200);
    }
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${options.validToken}`) return json({ id: '1' });
    return json({ message: 'Unauthorized' }, 401);
  });
}

function refreshCalls() {
  return fetchMock.mock.calls.filter(([input]) => isRefresh(input));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'locks', {
    value: undefined,
    configurable: true,
  });
  setAccessToken('old');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('api client', () => {
  it('sends the bearer token and the cookie', async () => {
    serve({ validToken: 'old' });

    const { response } = await api.GET('/api/v1/auth/me');

    expect(response.status).toBe(200);
    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.headers.get('authorization')).toBe('Bearer old');
    expect(request.credentials).toBe('include');
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    serve({ validToken: 'new' });

    const { response } = await api.GET('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retry = fetchMock.mock.calls[2]![0] as Request;
    expect(retry.headers.get('authorization')).toBe('Bearer new');
    expect(getAccessToken()).toBe('new');
  });

  it('makes concurrent 401s wait for the same refresh', async () => {
    serve({ validToken: 'new' });

    const responses = await Promise.all([
      api.GET('/api/v1/auth/me'),
      api.GET('/api/v1/auth/me'),
      api.GET('/api/v1/auth/me'),
    ]);

    expect(responses.map((r) => r.response.status)).toEqual([200, 200, 200]);
    expect(refreshCalls()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('does not retry a second time when the retry also returns 401', async () => {
    serve({ validToken: 'never' });

    const { response } = await api.GET('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(refreshCalls()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('notifies onSessionExpired when the refresh is expired', async () => {
    serve({ refresh: () => json({ message: 'no' }, 401) });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    const { response } = await api.GET('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();

    unsubscribe();
    setAccessToken('old');
    await api.GET('/api/v1/auth/me');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies once when concurrent requests share one expired refresh', async () => {
    serve({ refresh: () => json({ message: 'no' }, 401) });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    const results = await Promise.all([
      api.GET('/api/v1/auth/me'),
      api.GET('/api/v1/auth/me'),
      api.GET('/api/v1/auth/me'),
    ]);
    unsubscribe();

    expect(results.map((r) => r.response.status)).toEqual([401, 401, 401]);
    expect(refreshCalls()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify again for the same expiry, but can after a new session', async () => {
    serve({ refresh: () => json({ message: 'no' }, 401) });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await api.GET('/api/v1/auth/me');
    await api.GET('/api/v1/auth/me'); // token already cleared
    expect(listener).toHaveBeenCalledTimes(1);

    setAccessToken('fresh'); // a new login
    await api.GET('/api/v1/auth/me');
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the original 401 without expiring when the refresh is unavailable', async () => {
    serve({ refresh: () => json({ message: 'down' }, 500) });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    const { response } = await api.GET('/api/v1/auth/me');
    unsubscribe();

    expect(response.status).toBe(401);
    expect(listener).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('old');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never refreshes for /auth/login, /auth/refresh or /auth/logout', async () => {
    fetchMock.mockImplementation(async () => json({ message: 'no' }, 401));

    await api.POST('/api/v1/auth/login', {
      body: { email: 'a@b.co', password: 'x' },
    });
    await api.POST('/api/v1/auth/logout');
    await api.POST('/api/v1/auth/refresh');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const paths = fetchMock.mock.calls.map(
      ([input]) => new URL((input as Request).url, 'http://localhost').pathname,
    );
    expect(paths).toEqual([
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/auth/refresh',
    ]);
  });

  it('retries a POST with its original body', async () => {
    const bodies: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      if (isRefresh(input)) return json({ accessToken: 'new' });
      bodies.push(await request.text());
      return request.headers.get('authorization') === 'Bearer new'
        ? json({ id: '1' }, 201)
        : json({ message: 'Unauthorized' }, 401);
    });

    const { response } = await api.POST('/api/v1/users', {
      body: {
        name: 'Ana',
        email: 'ana@helpy.local',
        password: 'secret123',
        role: 'CLIENT',
      },
    });

    expect(response.status).toBe(201);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(JSON.parse(bodies[1]!)).toMatchObject({ name: 'Ana' });
  });
});
