import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshSession, runWithRefreshLock } from './refresh';
import { getAccessToken, setAccessToken } from './token-store';

const fetchMock = vi.fn<typeof fetch>();
const lockRequest = vi.fn(
  async (_name: string, callback: () => Promise<unknown>) => callback(),
);

function defineLocks(value: unknown) {
  Object.defineProperty(navigator, 'locks', { value, configurable: true });
}

function ok(accessToken = 'new') {
  return new Response(JSON.stringify({ accessToken }), { status: 200 });
}

beforeEach(() => {
  fetchMock.mockReset();
  lockRequest.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  defineLocks({ request: lockRequest });
  setAccessToken('old');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('refreshSession', () => {
  it('shares one request between concurrent calls', async () => {
    fetchMock.mockResolvedValue(ok());

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ status: 'ok', accessToken: 'new' });
    expect(b).toEqual(a);
    expect(getAccessToken()).toBe('new');
  });

  it('posts to the refresh endpoint with the cookie', async () => {
    fetchMock.mockResolvedValue(ok());

    await refreshSession();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('keeps the refresh request alive across page unload', async () => {
    fetchMock.mockResolvedValue(ok());

    await refreshSession();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/refresh');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  });

  it('runs inside the cross-tab lock "helpy-refresh"', async () => {
    fetchMock.mockResolvedValue(ok());

    await refreshSession();

    expect(lockRequest).toHaveBeenCalledTimes(1);
    expect(lockRequest.mock.calls[0]![0]).toBe('helpy-refresh');
  });

  it('falls back to a plain request where Web Locks is missing', async () => {
    defineLocks(undefined);
    fetchMock.mockResolvedValue(ok());

    const result = await refreshSession();

    expect(lockRequest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ok', accessToken: 'new' });
  });

  it('returns expired on 401 and clears the token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    expect(await refreshSession()).toEqual({ status: 'expired' });
    expect(getAccessToken()).toBeNull();
  });

  it('returns unavailable on 500 and keeps the token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    expect(await refreshSession()).toEqual({ status: 'unavailable' });
    expect(getAccessToken()).toBe('old');
  });

  it('returns unavailable on a network error and keeps the token', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await refreshSession()).toEqual({ status: 'unavailable' });
    expect(getAccessToken()).toBe('old');
  });

  it('sends a new request after the previous one settled', async () => {
    fetchMock
      .mockResolvedValueOnce(ok('first'))
      .mockResolvedValueOnce(ok('second'));

    expect(await refreshSession()).toEqual({
      status: 'ok',
      accessToken: 'first',
    });
    expect(await refreshSession()).toEqual({
      status: 'ok',
      accessToken: 'second',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('runWithRefreshLock', () => {
  it('runs the task inside the lock "helpy-refresh"', async () => {
    const task = vi.fn(async () => 'done');

    expect(await runWithRefreshLock(task)).toBe('done');

    expect(lockRequest).toHaveBeenCalledTimes(1);
    expect(lockRequest.mock.calls[0]![0]).toBe('helpy-refresh');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('waits for a refresh in flight in this tab without deadlocking', async () => {
    let finishFetch!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishFetch = resolve;
      }),
    );
    const order: string[] = [];
    const refresh = refreshSession().then(() => order.push('refresh'));
    const task = vi.fn(async () => {
      order.push('task');
    });

    const run = runWithRefreshLock(task);
    await Promise.resolve();
    expect(task).not.toHaveBeenCalled();

    finishFetch(ok());
    await Promise.all([refresh, run]);

    expect(order).toEqual(['refresh', 'task']);
  });

  it('just calls the task when Web Locks is missing', async () => {
    defineLocks(undefined);
    const task = vi.fn(async () => 'plain');

    expect(await runWithRefreshLock(task)).toBe('plain');
    expect(lockRequest).not.toHaveBeenCalled();
  });
});
