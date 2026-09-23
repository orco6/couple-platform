import Link from 'next/link';

import { copy } from '@/domain/copy';

/**
 * Before the shared hour: the time, one line, and the way back. No card —
 * this is a pause, and the room behind it is enough.
 */
export function TooEarlyPanel({ reviewTime, openTasks }: { reviewTime: string; openTasks: number }) {
  return (
    <section className="text-center">
      <p className="text-body font-medium text-ink-muted">{copy.day.notOpenYetTitle}</p>
      <p className="mt-2 text-[3.25rem] leading-none font-semibold tabular-nums text-ink" dir="ltr">
        {reviewTime}
      </p>
      <p className="mt-4 text-row text-ink-muted">{copy.day.notOpenYetWhat}</p>
      <Link
        href="/"
        className="tap-quiet press mt-8 inline-flex min-h-11 items-center rounded-chip px-5 text-row font-medium text-ink shadow-[inset_0_0_0_1.5px_var(--color-rule-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {copy.day.backToList}
        <span className="sr-only"> ({openTasks === 0 ? copy.day.notOpenYetNothingOpen : copy.day.notOpenYetOpenTasks(openTasks)})</span>
      </Link>
    </section>
  );
}
