import { setAccessToken } from './token-store';

export type RefreshResult =
  | { status: 'ok'; accessToken: string }
  | { status: 'expired' }
  | { status: 'unavailable' };

const REFRESH_URL = '/api/v1/auth/refresh';
const LOCK_NAME = 'helpy-refresh';

let inFlight: Promise<RefreshResult> | null = null;

async function requestRefresh(): Promise<RefreshResult> {
  try {
    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      credentials: 'include',
      // The API rotates the refresh token on every call. If the page unloads
      // mid-request the new Set-Cookie can be lost and the next page sends a
      // revoked token, which ends all sessions. keepalive lets the browser
      // finish the request after unload. This narrows the window but does not
      // close it; a server-side grace window for the previous token does.
      keepalive: true,
    });
    if (response.status === 401) {
      setAccessToken(null);
      return { status: 'expired' };
    }
    if (!response.ok) return { status: 'unavailable' };
    const body = (await response.json()) as { accessToken: string };
    setAccessToken(body.accessToken);
    return { status: 'ok', accessToken: body.accessToken };
  } catch {
    return { status: 'unavailable' };
  }
}

async function withLock(locks: LockManager): Promise<RefreshResult> {
  return await locks.request(LOCK_NAME, requestRefresh);
}

// A refresh token works once: reusing it ends every session of the user.
// Calls in this tab share one promise, and the Web Lock serializes tabs so a
// second tab only sends the cookie after the first rotation has finished.
export function refreshSession(): Promise<RefreshResult> {
  if (inFlight) return inFlight;

  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  const run = locks ? withLock(locks) : requestRefresh();

  const shared = run.finally(() => {
    inFlight = null;
  });
  inFlight = shared;
  return shared;
}

// Runs a task that sends the refresh cookie (logout) so it cannot race a
// rotation. It waits for this tab's refresh first, outside the lock because
// refreshSession takes the lock itself, then holds the lock across tabs.
export async function runWithRefreshLock<T>(
  task: () => Promise<T>,
): Promise<T> {
  if (inFlight) await inFlight.catch(() => undefined);

  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? await locks.request(LOCK_NAME, task) : await task();
}
