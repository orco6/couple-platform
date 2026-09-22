import type { ReactNode } from 'react';
import { copy } from '@/core/copy';
import { cx } from '@/core/ui/cx';

/**
 * Empty, error and loading states.
 *
 * Empty states are instructions, not decoration. Each one says three things:
 * what would be here (title), why it is empty or why it matters, and what the
 * person can do (description, plus the one action that creates it when the
 * viewer is allowed to). `description` is required so "אין נתונים" alone cannot
 * ship. No icon in a tinted circle, no dashed box — both are generated-UI
 * signatures, and a box makes the absence of content look like an object.
 * On a new installation the empty state IS the screen: write it for day one.
 *
 * Loading uses skeleton rows shaped like the content, so the page does not
 * jump when data arrives.
 */

export function EmptyState({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-5 py-10 text-center">
      <p className="text-row font-semibold text-balance text-ink">{title}</p>
      <p className="max-w-md text-body text-pretty text-ink-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = copy.errors.unexpected,
  description,
  action,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-surface bg-danger-tint px-5 py-6">
      <p className="text-row font-semibold text-danger-text">{title}</p>
      {description && <p className="text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('animate-skeleton block rounded-chip bg-rule-faint', className)} />;
}

export function LoadingState({ rows = 5, label = copy.common.loading }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="surface divide-y divide-rule-faint">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="ms-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
