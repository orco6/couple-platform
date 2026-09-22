import type { ReactNode } from 'react';
import { cx } from '@/core/ui/cx';

/**
 * Page structure.
 *
 * A page is a header (title, one line of context, actions) followed by
 * sections. Sections are separated by space and rules, not wrapped in cards:
 * use `Panel` only when content genuinely forms a separate document-like unit
 * (a form, a table, a record's details).
 */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small context above the title, e.g. a breadcrumb link back. */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-label text-ink-subtle">{eyebrow}</div>}
        <h1 className="heading-title text-title text-balance text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="print-hide flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('mb-8', className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="heading-section text-section text-balance text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-body text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="print-hide flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A document-like surface with an edge (not a floating card). */
export function Panel({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx('surface', padded && 'p-4 sm:p-5', className)}>{children}</div>;
}

/** A row of controls above content: filters on the start side, actions on the end. */
export function Toolbar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="print-hide mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">{start}</div>
      {end && <div className="flex shrink-0 flex-wrap items-center gap-2">{end}</div>}
    </div>
  );
}

/** Groups related fields under a heading inside a form. */
export function FormSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0 [&+&]:mt-6 [&+&]:border-t [&+&]:border-rule-faint [&+&]:pt-6">
      {title && <legend className="mb-1 text-row font-semibold text-ink">{title}</legend>}
      {description && <p className="mb-4 text-body text-ink-muted">{description}</p>}
      <div className="grid gap-4">{children}</div>
    </fieldset>
  );
}

/** A form-level message (not tied to one field). Announced to screen readers. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-field-message rounded-control bg-danger-tint px-3 py-2.5 text-body font-medium text-danger-text">
      {message}
    </p>
  );
}

/** Label/value pairs for a record's details. Stacks on phones. */
export function DescriptionList({ items, columns = 2 }: { items: Array<{ label: string; value: ReactNode }>; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cx(
        'grid gap-x-8 gap-y-3',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-label text-ink-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-row text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A calm, persistent explanation that belongs to the record being shown: why
 * actions are missing or read-only (archived, closed period, waiting for
 * approval). Not an alert and not a toast — the reason stays on screen for as
 * long as it is true. `warning` only for states that need someone to act.
 * No coloured side stripe (a generated-UI tell on callouts); tone is carried by
 * a tint and the words.
 */
export function Notice({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'warning'; className?: string }) {
  return (
    <p
      data-testid="notice"
      className={cx(
        'rounded-control px-3 py-2.5 text-body',
        tone === 'warning' ? 'bg-warning-tint text-warning-text' : 'bg-sunken text-ink-muted',
        className,
      )}
    >
      {children}
    </p>
  );
}
