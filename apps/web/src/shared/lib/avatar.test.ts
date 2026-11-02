import { describe, expect, it } from 'vitest';
import { avatarColor, initials } from './avatar';

const palette = [
  '#F6DCC6',
  '#D8E3F3',
  '#D9EBDD',
  '#E8DCF3',
  '#F1E5C6',
  '#F3D6DA',
];

describe('initials', () => {
  it('uses the first letters of the first two words, uppercase', () => {
    expect(initials('mariana costa')).toBe('MC');
    expect(initials('Ana Maria de Souza')).toBe('AM');
  });

  it('handles one word, extra spaces and empty names', () => {
    expect(initials('Ana')).toBe('A');
    expect(initials('  Ana   Lima  ')).toBe('AL');
    expect(initials('   ')).toBe('');
    expect(initials('')).toBe('');
  });
});

describe('avatarColor', () => {
  it('is deterministic and comes from the palette', () => {
    expect(avatarColor('Mariana Costa')).toBe(avatarColor('Mariana Costa'));
    expect(palette).toContain(avatarColor('Mariana Costa'));
  });

  it('matches the design hash', () => {
    // h = 7; h = (h * 31 + code) % 9973 for each char; palette[h % 6]
    expect(avatarColor('A')).toBe(palette[((7 * 31 + 65) % 9973) % 6]);
  });

  it('works with an empty name', () => {
    expect(avatarColor('')).toBe(palette[7 % 6]);
  });
});
