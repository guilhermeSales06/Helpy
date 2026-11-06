import { describe, expect, it } from 'vitest';
import { formatDateTime, formatRelative } from './format-date';

// Local time, so the tests do not depend on the machine's time zone.
const NOW = new Date(2026, 9, 22, 10, 30);
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('formatRelative', () => {
  it.each([
    [0, 'agora'],
    [0.5, 'agora'],
    [1, 'há 1 min'],
    [5, 'há 5 min'],
    [59, 'há 59 min'],
    [60, 'há 1 h'],
    [185, 'há 3 h'],
    [1439, 'há 23 h'],
    [1440, 'ontem'],
    [2879, 'ontem'],
    [2880, 'há 2 dias'],
    [4 * 1440 + 30, 'há 4 dias'],
    [40 * 1440, 'há 40 dias'],
  ])('%s minutes ago is %s', (minutes, expected) => {
    expect(formatRelative(minutesAgo(minutes), NOW)).toBe(expected);
  });

  it('shows a date in the future (clock ahead) as agora', () => {
    expect(formatRelative(minutesAgo(-10), NOW)).toBe('agora');
    expect(formatRelative(minutesAgo(-3 * 1440), NOW)).toBe('agora');
  });

  it('accepts an ISO string', () => {
    expect(formatRelative(minutesAgo(5).toISOString(), NOW)).toBe('há 5 min');
  });

  it('uses the current time when none is given', () => {
    expect(formatRelative(new Date())).toBe('agora');
  });

  it('shows an invalid date as an empty string', () => {
    expect(formatRelative('not a date', NOW)).toBe('');
  });
});

describe('formatDateTime', () => {
  it('formats the date and time like the design', () => {
    expect(formatDateTime(new Date(2026, 9, 22, 10, 30))).toBe('22 out, 10:30');
    expect(formatDateTime(new Date(2026, 0, 5, 9, 5))).toBe('5 jan, 09:05');
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59))).toBe(
      '31 dez, 23:59',
    );
  });

  it('accepts an ISO string', () => {
    expect(formatDateTime(new Date(2026, 9, 22, 10, 30).toISOString())).toBe(
      '22 out, 10:30',
    );
  });

  it('shows an invalid date as an empty string', () => {
    expect(formatDateTime('nope')).toBe('');
  });
});
