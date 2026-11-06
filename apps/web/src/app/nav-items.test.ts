import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav-items';

describe('navItemsFor', () => {
  it.each([
    ['CLIENT', ['Meus chamados']],
    ['TECHNICIAN', ['Visão geral', 'Meus chamados', 'Não atribuídos']],
    ['ADMIN', ['Visão geral', 'Todos os chamados', 'Não atribuídos']],
  ] as const)('%s sees %j', (role, labels) => {
    expect(navItemsFor(role).map((i) => i.label)).toEqual(labels);
  });

  it('points each item at its route and filter', () => {
    const routes = (role: 'CLIENT' | 'TECHNICIAN' | 'ADMIN') =>
      navItemsFor(role).map((i) => [i.label, i.to, i.search]);
    expect(routes('TECHNICIAN')).toEqual([
      ['Visão geral', '/', undefined],
      ['Meus chamados', '/chamados', { assignee: 'me' }],
      ['Não atribuídos', '/chamados', { assignee: 'none' }],
    ]);
    expect(routes('ADMIN')).toEqual([
      ['Visão geral', '/', undefined],
      ['Todos os chamados', '/chamados', undefined],
      ['Não atribuídos', '/chamados', { assignee: 'none' }],
    ]);
  });

  it('keeps the client item as it was until the client slice', () => {
    expect(navItemsFor('CLIENT').map((i) => [i.to, i.search])).toEqual([
      ['/', undefined],
    ]);
  });

  it('gives every item a destination and an icon', () => {
    for (const role of ['CLIENT', 'TECHNICIAN', 'ADMIN'] as const) {
      for (const item of navItemsFor(role)) {
        expect(item.to).toMatch(/^\//);
        expect(item.icon).not.toBe('');
      }
    }
  });

  it('does not give the admin a "Meus chamados"', () => {
    expect(navItemsFor('ADMIN').map((i) => i.label)).not.toContain(
      'Meus chamados',
    );
  });
});
