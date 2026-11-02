import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it.each([
    ['/chamados?status=OPEN', '/chamados?status=OPEN'],
    ['/chamados/42#topo', '/chamados/42#topo'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['/chamados\\..\\evil', '/'],
    ['/\t/evil.com', '/'],
    ['/\n/evil.com', '/'],
    ['/ /evil.com', '/'],
    [' //evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['chamados', '/'],
    ['', '/'],
    ['/login', '/'],
    ['/login?redirect=%2Fchamados', '/'],
    ['/login/', '/'],
    ['/login#x', '/'],
    ['/loginx', '/loginx'],
    [undefined, '/'],
    [null, '/'],
    [42, '/'],
    [{ toString: () => '/chamados' }, '/'],
  ])('safeRedirect(%s) is %s', (input, output) => {
    expect(safeRedirect(input)).toBe(output);
  });
});
