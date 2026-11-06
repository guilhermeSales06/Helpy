import { describe, expect, it } from 'vitest';
import { parseTicketSearch, toApiQuery } from './ticket-search';

const ME = '6f1c1c8e-0000-4000-8000-0000000000a1';
const TECH = '6f1c1c8e-0000-4000-8000-0000000000b2';
const CATEGORY = '6f1c1c8e-0000-4000-8000-0000000000c3';

describe('parseTicketSearch', () => {
  it('uses the defaults when the URL has no filters', () => {
    expect(parseTicketSearch({})).toEqual({ sort: 'newest', page: 1 });
  });

  it.each([['XYZ'], [''], [undefined], [42]])(
    'falls back for an invalid status %j',
    (status) => {
      expect(parseTicketSearch({ status }).status).toBeUndefined();
    },
  );

  it.each([['XYZ'], [''], [undefined], [3]])(
    'falls back for an invalid priority %j',
    (priority) => {
      expect(parseTicketSearch({ priority }).priority).toBeUndefined();
    },
  );

  it.each([['-3'], ['0'], ['abc'], ['1.5'], [''], [undefined]])(
    'falls back to page 1 for %j',
    (page) => {
      expect(parseTicketSearch({ page }).page).toBe(1);
    },
  );

  it.each([[-3], [0], [1.5], [Number.NaN], [Number.MAX_VALUE]])(
    'falls back to page 1 for the number %j',
    (page) => {
      expect(parseTicketSearch({ page }).page).toBe(1);
    },
  );

  it('accepts a page given as a string or as the number the router parses', () => {
    expect(parseTicketSearch({ page: '4' }).page).toBe(4);
    expect(parseTicketSearch({ page: 4 }).page).toBe(4);
  });

  it('falls back to newest for an unknown sort', () => {
    expect(parseTicketSearch({ sort: 'foo' }).sort).toBe('newest');
    expect(parseTicketSearch({ sort: 7 }).sort).toBe('newest');
    expect(parseTicketSearch({ sort: 'priority' }).sort).toBe('priority');
  });

  it.each([['x'], [''], [undefined], [7], ['not-a-uuid']])(
    'drops an invalid category %j',
    (category) => {
      expect(parseTicketSearch({ category }).category).toBeUndefined();
    },
  );

  it.each([['foo'], [''], [undefined], [7], ['ME']])(
    'drops an invalid assignee %j',
    (assignee) => {
      expect(parseTicketSearch({ assignee }).assignee).toBeUndefined();
    },
  );

  it('keeps me, none and a uuid as assignee', () => {
    expect(parseTicketSearch({ assignee: 'me' }).assignee).toBe('me');
    expect(parseTicketSearch({ assignee: 'none' }).assignee).toBe('none');
    expect(parseTicketSearch({ assignee: TECH }).assignee).toBe(TECH);
  });

  it('keeps a valid combination intact', () => {
    expect(
      parseTicketSearch({
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        category: CATEGORY,
        assignee: 'me',
        q: 'impressora',
        sort: 'updated',
        page: 3,
      }),
    ).toEqual({
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      category: CATEGORY,
      assignee: 'me',
      q: 'impressora',
      sort: 'updated',
      page: 3,
    });
  });

  it('survives the example from the plan', () => {
    expect(
      parseTicketSearch({
        status: 'XYZ',
        page: '-3',
        sort: 'foo',
        assignee: '',
      }),
    ).toEqual({ sort: 'newest', page: 1 });
  });

  it('overrides every raw key, so an invalid value cannot leak through the router merge', () => {
    const parsed = parseTicketSearch({
      status: 'XYZ',
      priority: 'x',
      category: 'x',
      assignee: '',
      q: ' ',
    });
    for (const key of ['status', 'priority', 'category', 'assignee', 'q']) {
      expect(key in parsed).toBe(true);
      expect(parsed[key as keyof typeof parsed]).toBeUndefined();
    }
  });

  it('trims q and drops an empty q; cuts q at 100 characters', () => {
    expect(parseTicketSearch({ q: '  rede  ' }).q).toBe('rede');
    expect(parseTicketSearch({ q: '   ' }).q).toBeUndefined();
    expect(parseTicketSearch({ q: '' }).q).toBeUndefined();
    expect(parseTicketSearch({ q: 'a'.repeat(150) }).q).toBe('a'.repeat(100));
  });

  it('reads a q the router parsed as a number', () => {
    expect(parseTicketSearch({ q: 4821 }).q).toBe('4821');
    expect(parseTicketSearch({ q: Number.NaN }).q).toBeUndefined();
    expect(parseTicketSearch({ q: { a: 1 } }).q).toBeUndefined();
  });
});

describe('toApiQuery', () => {
  const base = { sort: 'newest', page: 1 } as const;

  it('maps me, none and a uuid', () => {
    expect(toApiQuery({ ...base, assignee: 'me' }, ME)).toMatchObject({
      technicianId: ME,
    });
    const none = toApiQuery({ ...base, assignee: 'none' }, ME);
    expect(none.unassigned).toBe(true);
    expect(none).not.toHaveProperty('technicianId');
    expect(toApiQuery({ ...base, assignee: TECH }, ME)).toMatchObject({
      technicianId: TECH,
    });
  });

  it('renames category to categoryId and keeps the other filters', () => {
    expect(
      toApiQuery(
        {
          status: 'OPEN',
          priority: 'HIGH',
          category: CATEGORY,
          q: '#12',
          sort: 'oldest',
          page: 2,
        },
        ME,
      ),
    ).toEqual({
      status: 'OPEN',
      priority: 'HIGH',
      categoryId: CATEGORY,
      q: '#12',
      sort: 'oldest',
      page: 2,
    });
  });

  it('leaves out what is not set', () => {
    expect(toApiQuery(base, ME)).toEqual({ sort: 'newest', page: 1 });
  });
});
