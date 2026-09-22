import Link from 'next/link';
import { ArrowLeft, Clock, ListTodo } from 'lucide-react';

import { copy } from '@/domain/copy';

/**
 * Before the review time.
 *
 * The obvious build is an empty state saying "come back at 21:30", and on a
 * phone that is most of a screen of nothing. This says the same thing as a
 * *moment* — the time set large on the gradient surface the product uses for
 * the day — and then answers the question that actually follows ("so what do I
 * do now?") by naming what is still open and linking to it.
 */
export function TooEarlyPanel({ reviewTime, openTasks }: { reviewTime: string; openTasks: number }) {
  return (
    <section className="card overflow-hidden">
      <div className="surface-accent relative px-5 py-8 text-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-8 -top-12 size-40 rounded-full bg-white/20 blur-2xl"
        />
        <div className="relative">
          <Clock aria-hidden="true" size={22} className="mx-auto mb-3 text-on-accent/80" />
          <p className="text-meta text-on-accent/80">{copy.day.notOpenYetTitle}</p>
          {/* The one large number on this screen, and it is a time, not a
              score — the product has no figure worth setting at 40px. */}
          <p className="mt-1 text-[2rem] leading-none font-semibold tabular-nums text-on-accent" dir="ltr">
            {reviewTime}
          </p>
          <p className="mt-3 text-body text-on-accent/85">{copy.day.notOpenYetWhat}</p>
        </div>
      </div>

      <Link
        href="/"
        className="flex min-h-14 items-center justify-between gap-3 px-5 text-row font-medium text-ink transition-colors duration-200 hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex items-center gap-2">
          <ListTodo aria-hidden="true" size={18} className="text-ink-subtle" />
          {openTasks === 0 ? copy.day.notOpenYetNothingOpen : copy.day.notOpenYetOpenTasks(openTasks)}
        </span>
        <span className="flex items-center gap-1 text-meta text-accent-text">
          {copy.day.backToList}
          <ArrowLeft aria-hidden="true" size={14} />
        </span>
      </Link>
    </section>
  );
}
