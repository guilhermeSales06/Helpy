import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav-items';

describe('navItemsFor', () => {
  it.each([
    ['CLIENT', ['Meus chamados']],
    ['TECHNICIAN', ['Visão geral']],
    ['ADMIN', ['Visão geral']],
  ] as const)('%s sees %j', (role, labels) => {
    expect(navItemsFor(role).map((i) => i.label)).toEqual(labels);
  });

  it('gives every item a destination and an icon', () => {
    for (const item of navItemsFor('CLIENT')) {
      expect(item.to).toBe('/');
      expect(item.icon).not.toBe('');
    }
  });
});
