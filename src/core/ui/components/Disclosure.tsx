'use client';

import { useId, useState, type ReactNode } from 'react';
import { cx } from '@/core/ui/cx';
import { ChevronDownIcon } from './Icons';

/**
 * Show/hide a section: a real button with aria-expanded/aria-controls, and a
 * region that animates its height (260ms in, 200ms out). Collapsed content is
 * `inert`, so it is not reachable by Tab or read by screen readers.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-start text-row font-medium text-ink hover:text-accent-text"
      >
        <span>{summary}</span>
        <ChevronDownIcon className={cx('disclosure-chevron size-5 shrink-0 text-ink-subtle')} />
      </button>
      <div id={regionId} className="disclosure-region" data-open={open} inert={!open}>
        <div>
          <div className="pb-3 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
