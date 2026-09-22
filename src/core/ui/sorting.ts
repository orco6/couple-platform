/**
 * List sorting as URL state (?sort=name&dir=asc).
 *
 * Sorting happens in the database query, never in React: a sorted page must be
 * the same rows a person would get by paging, and scoped queries stay scoped.
 * The URL is untrusted input, so only keys the page allows are honoured —
 * anything else falls back to the default. Map the key to a Prisma orderBy in
 * the domain service and always end with a unique tie-breaker (id) so cursor
 * pagination stays stable.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState<Key extends string = string> {
  key: Key;
  dir: SortDirection;
}

export function parseSort<Key extends string>(
  raw: { sort?: string | null; dir?: string | null },
  allowed: readonly Key[],
  fallback: SortState<Key>,
): SortState<Key> {
  const key = allowed.find((candidate) => candidate === raw.sort);
  if (!key) return fallback;
  return { key, dir: raw.dir === 'desc' ? 'desc' : raw.dir === 'asc' ? 'asc' : key === fallback.key ? fallback.dir : 'asc' };
}

/** The state a click on a column header leads to: toggles the active column, otherwise starts at `first`. */
export function nextSort<Key extends string>(current: SortState<Key>, key: Key, first: SortDirection = 'asc'): SortState<Key> {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: first };
}

/** Query string for a sort state on top of the page's other params (resets the cursor: a new order is a new list). */
export function sortSearchParams(base: URLSearchParams | Record<string, string | undefined>, state: SortState): URLSearchParams {
  const entries = base instanceof URLSearchParams ? [...base.entries()] : Object.entries(base).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const params = new URLSearchParams(entries.filter(([name]) => name !== 'sort' && name !== 'dir' && name !== 'cursor'));
  params.set('sort', state.key);
  params.set('dir', state.dir);
  return params;
}
