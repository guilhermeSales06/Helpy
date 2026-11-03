import { parseTrustProxy } from './trust-proxy.js';

describe('parseTrustProxy', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['10', 10],
  ])('accepts %j', (value, expected) => {
    expect(parseTrustProxy(value)).toBe(expected);
  });

  it.each(['0', '', 'true', '1e3', '0x2', ' 2 ', '-1', '1.5', '02', undefined])(
    'rejects %j',
    (value) => {
      expect(parseTrustProxy(value)).toBeUndefined();
    },
  );
});
