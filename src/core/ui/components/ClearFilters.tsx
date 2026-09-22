import { ButtonLink } from './ButtonLink';

/**
 * "Clear filters", rendered by the page (server-safe) because the page knows
 * which query parameters are filters and which are not (a status tab, a sort).
 * Shown only when a filter is active: next to the filters, and as the action of
 * a filtered-empty state, so "widen the search" is one tap instead of an
 * instruction.
 *
 *   <ClearFilters pathname="/customers" params={raw} filters={['q', 'owner']} />
 */

export function clearFiltersHref(pathname: string, params: Record<string, string | undefined>, filters: readonly string[]): string {
  const kept = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]) && !filters.includes(entry[0]) && entry[0] !== 'cursor'),
  ).toString();
  return kept ? `${pathname}?${kept}` : pathname;
}

export function hasActiveFilters(params: Record<string, string | undefined>, filters: readonly string[]): boolean {
  return filters.some((name) => Boolean(params[name]));
}

export function ClearFilters({
  pathname,
  params,
  filters,
  label = 'ניקוי הסינון',
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  filters: readonly string[];
  label?: string;
}) {
  if (!hasActiveFilters(params, filters)) return null;
  return (
    <ButtonLink href={clearFiltersHref(pathname, params, filters)} variant="quiet" size="sm" data-testid="clear-filters">
      {label}
    </ButtonLink>
  );
}
