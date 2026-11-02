const FALLBACK = '/';
const BASE = 'http://helpy.invalid';

function hasControlChar(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

/**
 * Only same-site absolute paths survive; anything else (other origins,
 * protocol-relative URLs, backslash or whitespace tricks) falls back to `/`.
 * `/login` is never a valid target, so a redirect can't loop.
 */
export function safeRedirect(target: unknown): string {
  if (typeof target !== 'string') return FALLBACK;
  if (!target.startsWith('/') || target.startsWith('//')) return FALLBACK;
  // Backslashes, whitespace and control characters are normalised by
  // browsers into slashes or stripped, which can turn `/x` into `//evil`.
  if (/[\\\s]/.test(target) || hasControlChar(target)) return FALLBACK;

  let url: URL;
  try {
    url = new URL(target, BASE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== BASE) return FALLBACK;
  if (url.pathname === '/login' || url.pathname === '/login/') return FALLBACK;
  return target;
}
