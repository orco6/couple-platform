import { describe, expect, it } from 'vitest';
import { nextSort, parseSort, sortSearchParams } from '@/core/ui/sorting';

const KEYS = ['name', 'createdAt'] as const;
const DEFAULT = { key: 'name', dir: 'asc' } as const;

describe('parseSort (URL is untrusted)', () => {
  it('honours allowed keys and directions', () => {
    expect(parseSort({ sort: 'createdAt', dir: 'desc' }, KEYS, DEFAULT)).toEqual({ key: 'createdAt', dir: 'desc' });
    expect(parseSort({ sort: 'createdAt' }, KEYS, DEFAULT)).toEqual({ key: 'createdAt', dir: 'asc' });
  });

  it('falls back for unknown keys, prototype names, injection attempts and bad directions', () => {
    for (const sort of [undefined, null, '', 'passwordHash', 'constructor', '__proto__', 'name;drop', 'NAME']) {
      expect(parseSort({ sort, dir: 'desc' }, KEYS, DEFAULT)).toEqual(DEFAULT);
    }
    expect(parseSort({ sort: 'name', dir: 'sideways' }, KEYS, DEFAULT)).toEqual(DEFAULT);
  });
});

describe('nextSort and sortSearchParams', () => {
  it('toggles the active column and starts others at their first direction', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
    expect(nextSort({ key: 'name', dir: 'asc' }, 'createdAt', 'desc')).toEqual({ key: 'createdAt', dir: 'desc' });
  });

  it('keeps filters, replaces sort, and drops the cursor', () => {
    const params = sortSearchParams(new URLSearchParams('q=כהן&cursor=abc&sort=name&dir=asc'), { key: 'createdAt', dir: 'desc' });
    expect(Object.fromEntries(params)).toEqual({ q: 'כהן', sort: 'createdAt', dir: 'desc' });
    expect(Object.fromEntries(sortSearchParams({ q: undefined, owner: 'mine' }, { key: 'name', dir: 'asc' }))).toEqual({ owner: 'mine', sort: 'name', dir: 'asc' });
  });
});
