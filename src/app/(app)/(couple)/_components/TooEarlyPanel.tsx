import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { copy } from '@/domain/copy';

/**
 * Before the review time.
 *
 * Said as a moment rather than an empty state: the time, set large — the one
 * large figure on this screen, and it is a time, not a score — then the
 * question that actually follows ("so what now?") answered with a way back to
 * what is still open. No gradient card: the first edition's violet surface
 * here was a hero on a screen that is, by design, a pause.
 */
export function TooEarlyPanel({ reviewTime, openTasks }: { reviewTime: string; openTasks: number }) {
  return (
    <section className="pt-6 text-center">
      <p className="text-body font-medium text-ink-subtle">{copy.day.notOpenYetTitle}</p>
      <p className="mt-2 text-[2.75rem] leading-none font-semibold tabular-nums text-ink" dir="ltr">
        {reviewTime}
      </p>
      <p className="mx-auto mt-4 max-w-xs text-row text-balance text-ink-muted">{copy.day.notOpenYetWhat}</p>

      <Link
        href="/"
        className="tap-quiet press panel mx-auto mt-8 flex min-h-14 max-w-sm items-center justify-between gap-3 px-4 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="text-row text-ink">
          {openTasks === 0 ? copy.day.notOpenYetNothingOpen : copy.day.notOpenYetOpenTasks(openTasks)}
        </span>
        <span className="flex items-center gap-0.5 text-body font-medium text-accent-text">
          {copy.day.backToList}
          <ChevronLeft aria-hidden="true" size={16} />
        </span>
      </Link>
    </section>
  );
}
