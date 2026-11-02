const PALETTE = [
  '#F6DCC6',
  '#D8E3F3',
  '#D9EBDD',
  '#E8DCF3',
  '#F1E5C6',
  '#F3D6DA',
];

/** First letters of the first two words, uppercase. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** Stable background color for a name's avatar (same hash as the design). */
export function avatarColor(name: string): string {
  let hash = 7;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return PALETTE[hash % PALETTE.length]!;
}
