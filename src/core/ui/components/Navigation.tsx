import Link from 'next/link';
import { copy } from '@/core/copy';
import { cx } from '@/core/ui/cx';
import { ChevronBackIcon, ChevronForwardIcon } from './Icons';

/**
 * Link tabs (each tab is a URL, so state survives reload and can be shared) and
 * cursor pagination. Both server-rendered.
 */

export function LinkTabs({
  tabs,
  label,
}: {
  tabs: Array<{ href: string; label: string; current: boolean; count?: number }>;
  label: string;
}) {
  return (
    <nav aria-label={label} className="print-hide scroll-x -mx-4 mb-4 px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-rule">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={cx(
                '-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-body transition-colors duration-[var(--motion-feedback)]',
                tab.current
                  ? 'border-accent font-semibold text-ink'
                  : 'border-transparent text-ink-muted hover:border-rule-strong hover:text-ink',
              )}
            >
              {tab.label}
              {tab.count !== undefined && <span className="tnum text-meta text-ink-subtle">{tab.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Cursor pagination: "previous" is the browser's back button's job in most
 * flows; this renders "next page" and a way back to the first page. Cursor
 * paging stays correct while rows are added, unlike page numbers.
 */
export function CursorPagination({ firstHref, nextHref }: { firstHref?: string | null; nextHref?: string | null }) {
  if (!firstHref && !nextHref) return null;
  return (
    <nav aria-label="דפדוף" className="print-hide mt-4 flex items-center justify-between gap-2">
      {firstHref ? (
        <Link href={firstHref} className="inline-flex min-h-11 items-center gap-1 px-2 text-body text-ink-muted hover:text-ink">
          <ChevronBackIcon className="size-4" />
          להתחלה
        </Link>
      ) : (
        <span />
      )}
      {nextHref && (
        <Link href={nextHref} className="inline-flex min-h-11 items-center gap-1 px-2 text-body font-medium text-accent-text hover:underline">
          {copy.common.next}
          <ChevronForwardIcon className="size-4" />
        </Link>
      )}
    </nav>
  );
}
