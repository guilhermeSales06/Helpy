import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { refreshSession } from './refresh';
import { getAccessToken } from './token-store';

const AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
];

const expiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

// One expiry notifies once, however many requests saw it. Re-armed as soon as
// a request goes out with a token again (new login or successful refresh).
let expiryNotified = false;

function isAuthRequest(request: Request): boolean {
  const { pathname } = new URL(request.url, 'http://localhost');
  return AUTH_PATHS.includes(pathname);
}

// Unsent copies of in-flight requests, so a 401 can resend the body.
const pending = new Map<string, Request>();

const authMiddleware: Middleware = {
  onRequest({ request, id }) {
    const token = getAccessToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
      expiryNotified = false;
    }
    if (!isAuthRequest(request)) pending.set(id, request.clone());
    return request;
  },

  async onResponse({ response, id }) {
    const original = pending.get(id);
    pending.delete(id);
    if (response.status !== 401 || !original) return undefined;

    const result = await refreshSession();
    if (result.status === 'expired') {
      if (!expiryNotified) {
        expiryNotified = true;
        expiredListeners.forEach((listener) => listener());
      }
      return undefined;
    }
    if (result.status === 'unavailable') return undefined;

    // One retry only: whatever it returns is final.
    original.headers.set('Authorization', `Bearer ${result.accessToken}`);
    return globalThis.fetch(original);
  },

  onError({ id }) {
    pending.delete(id);
  },
};

export const api = createClient<paths>({
  // The generated paths already start with /api/v1, so the base is only the
  // origin (Request needs an absolute URL outside a real browser).
  baseUrl: globalThis.location.origin,
  credentials: 'include',
  fetch: (request) => globalThis.fetch(request),
});

api.use(authMiddleware);
