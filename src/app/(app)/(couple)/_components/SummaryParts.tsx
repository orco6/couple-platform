import Link from 'next/link';
import { ChevronLeft, ChevronRight, Lightbulb, Star } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';

/**
 * The pieces both summaries are built from.
 *
 * The rule holding them together: **a summary of a relationship is read, not
 * analysed.** Every figure here is one number with a word next to it, and the
 * words are the business's own. No axis labels, no legends, no percentages
 * beside percentages, nothing that needs interpreting before it means
 * something.
 */

/** Previous at the start edge, next at the end — the reading direction. */
export function RangeStepper({
  label,
  previousHref,
  nextHref,
}: {
  label: string;
  previousHref: string;
  nextHref: string | null;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <Link
        href={previousHref}
        aria-label={copy.summariesNav.previous}
        className="grid size-11 place-items-center rounded-control text-ink-muted transition-colors duration-200 hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ChevronRight aria-hidden="true" size={20} />
      </Link>

      <p className="text-body font-medium tabular-nums text-ink" dir="ltr">
        {label}
      </p>

      {nextHref ? (
        <Link
          href={nextHref}
          aria-label={copy.summariesNav.next}
          className="grid size-11 place-items-center rounded-control text-ink-muted transition-colors duration-200 hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
      ) : (
        // Kept in the layout so the label stays centred at the newest range.
        <span className="size-11" aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * The one figure a summary leads with: the share of the list that got done,
 * on the product's gradient surface with a bar underneath it.
 */
export function CompletionHero({
  percent,
  done,
  total,
  title,
}: {
  percent: number | null;
  done: number;
  total: number;
  title: string;
}) {
  return (
    <section className="surface-aurora relative overflow-hidden p-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-16 size-44 rounded-full bg-white/20 blur-2xl"
      />
      <div className="relative">
        <p className="text-meta text-on-accent/80">{title}</p>

        {percent === null ? (
          <p className="mt-2 text-section font-semibold text-on-accent">{copy.month.noData}</p>
        ) : (
          <>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[2.25rem] leading-none font-semibold tabular-nums text-on-accent" dir="ltr">
                {percent}%
              </span>
              <span className="text-body text-on-accent/80">{copy.week.completionDetail(done, total)}</span>
            </p>

            <div className="mt-4 h-2 overflow-hidden rounded-chip bg-white/25">
              <div className="h-full rounded-chip bg-white/90" style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * A 1–5 average, shown as stars with the number beside it.
 *
 * Stars rather than a bar because the same control is how the rating was
 * *given* — the summary should look like the thing it is summarising. The
 * fractional part is shown as a number; a half-filled star is decoration
 * pretending to be precision.
 */
export function AverageCard({
  title,
  hint,
  value,
  tone,
}: {
  title: string;
  hint: string;
  value: number | null;
  tone: 'warm' | 'accent';
}) {
  return (
    <section className="card p-4">
      <p className="text-label font-semibold text-ink-muted">{title}</p>

      {value === null ? (
        <p className="mt-2 text-body text-ink-subtle">{copy.month.noData}</p>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1" dir="ltr" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((step) => (
              <Star
                key={step}
                size={16}
                strokeWidth={step <= Math.round(value) ? 0 : 1.75}
                className={cx(
                  step <= Math.round(value)
                    ? tone === 'warm'
                      ? 'fill-current text-partner-a'
                      : 'fill-current text-accent'
                    : 'text-rule-strong',
                )}
              />
            ))}
          </span>
          <span className="text-section font-semibold tabular-nums text-ink" dir="ltr">
            {value.toFixed(1)}
          </span>
        </div>
      )}

      <p className="mt-2 text-meta text-ink-subtle">{hint}</p>
    </section>
  );
}

/** The one gentle improvement. Warm, quiet, and never more than one. */
export function InsightCard({ text }: { text: string }) {
  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-warning-tint">
          <Lightbulb aria-hidden="true" size={17} className="text-warning-text" />
        </span>
        <div className="min-w-0">
          <p className="text-label font-semibold text-ink-muted">{copy.week.insightTitle}</p>
          <p className="mt-1 text-body leading-relaxed text-balance text-ink">{text}</p>
        </div>
      </div>
    </section>
  );
}
