'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { copy } from '@/core/copy';
import { cx } from '@/core/ui/cx';
import { Spinner } from './Button';
import { SearchIcon } from './Icons';

/**
 * On phones the search takes its own row and the selects share the next one
 * (three stacked full-width controls pushed the first record ~200px down).
 *
 * Filters live in the URL: a filtered list can be reloaded, bookmarked and
 * shared, and the server does the filtering (never "fetch everything, filter
 * in React"). Search updates after a short pause in typing; selects update
 * immediately. Changing a filter resets the cursor. While the list refreshes
 * the search field shows a spinner (after 150ms, so fast results never flash).
 * Controls follow the URL: a "clear filters" link or the browser's back button
 * updates what the search field shows, not only the list.
 */

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('cursor');
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return { update, pending, searchParams };
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="search" className={cx('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

export function SearchFilter({ name = 'q', label = copy.common.search, placeholder }: { name?: string; label?: string; placeholder?: string }) {
  const { update, pending, searchParams } = useQueryUpdater();
  const [value, setValue] = useState(searchParams.get(name) ?? '');

  // The URL changed from outside (clear filters, back button): show what the list is filtered by.
  const fromUrl = searchParams.get(name) ?? '';
  const [lastUrlValue, setLastUrlValue] = useState(fromUrl);
  if (fromUrl !== lastUrlValue) {
    setLastUrlValue(fromUrl);
    if (fromUrl !== value.trim()) setValue(fromUrl);
  }

  useEffect(() => {
    // Only typing that differs from the URL updates it (not mount, not an external URL change).
    if (value.trim() === (searchParams.get(name) ?? '')) return;
    const timer = window.setTimeout(() => update(name, value.trim()), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on value only
  }, [value]);

  return (
    <div className="relative w-full sm:w-72">
      <label className="sr-only" htmlFor={`filter-${name}`}>
        {label}
      </label>
      {pending ? (
        <Spinner className="spinner-delayed pointer-events-none absolute inset-y-0 start-3 my-auto size-4.5 text-ink-subtle" />
      ) : (
        <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4.5 text-ink-subtle" />
      )}
      <input
        id={`filter-${name}`}
        type="search"
        enterKeyHint="search"
        value={value}
        placeholder={placeholder ?? label}
        onChange={(event) => setValue(event.target.value)}
        aria-busy={pending || undefined}
        className="block min-h-11 w-full rounded-control border border-rule-strong bg-surface py-2 pe-3 ps-9 text-control placeholder:text-ink-subtle focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-focus)_24%,transparent)] focus:outline-none"
      />
    </div>
  );
}

export function SelectFilter({
  name,
  label,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  const { update, searchParams } = useQueryUpdater();
  return (
    <div className="relative min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none">
      <label className="sr-only" htmlFor={`filter-${name}`}>
        {label}
      </label>
      <select
        id={`filter-${name}`}
        value={searchParams.get(name) ?? ''}
        onChange={(event) => update(name, event.target.value)}
        className="block min-h-11 w-full appearance-none rounded-control border border-rule-strong bg-surface py-2 pe-9 ps-3 text-control focus:border-accent focus:outline-none sm:w-auto"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/**
 * Sort control for phones, where table headers are not shown. Each option is a
 * complete sort state ("key:dir"); the server validates it with parseSort.
 */
export function SortFilter({
  label,
  options,
  className = 'md:hidden',
}: {
  label: string;
  options: Array<{ key: string; dir: 'asc' | 'desc'; label: string }>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const current = `${searchParams.get('sort') ?? ''}:${searchParams.get('dir') ?? ''}`;
  const known = options.some((option) => `${option.key}:${option.dir}` === current);

  return (
    <div className={cx('relative min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0 sm:flex-none', className)}>
      <label className="sr-only" htmlFor="filter-sort">
        {label}
      </label>
      <select
        id="filter-sort"
        value={known ? current : `${options[0]?.key}:${options[0]?.dir}`}
        onChange={(event) => {
          const [key = '', dir = ''] = event.target.value.split(':');
          const params = new URLSearchParams(searchParams.toString());
          params.set('sort', key);
          params.set('dir', dir);
          params.delete('cursor');
          startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
        }}
        className="block min-h-11 w-full appearance-none rounded-control border border-rule-strong bg-surface py-2 pe-9 ps-3 text-control focus:border-accent focus:outline-none sm:w-auto"
      >
        {options.map((option) => (
          <option key={`${option.key}:${option.dir}`} value={`${option.key}:${option.dir}`}>
            {option.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-ink-subtle" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
