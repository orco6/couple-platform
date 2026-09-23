import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { DayView } from '@/domain/day-entries/day-entries';

import { PartnerMark } from './PartnerMark';

/**
 * THE DAY, IN ONE LINE.
 *
 * The daily ritual used to be a permanent tab and a gradient card at the top
 * of Today. Most of the day there is nothing to do about it, so most of the
 * day it is now one quiet line: when it opens, or who is waiting for whom.
 * When it IS time — the day can be closed and this person has not — it becomes
 * the one surface on the screen with an action on it.
 *
 * The two marks carry the state without words as well: a person who has closed
 * the day is a solid mark, a person who has not is a ring in their colour. Revealed, the
 * two overlap — the product's motif.
 */
export function DayLine({ day }: { day: DayView }) {
  const partnerName = day.partner?.name ?? copy.common.partnerFallback;
  const actionable = day.canClose && !day.mine;
  const { text, hint, cta } = describe(day, partnerName);

  const body = (
    <>
      <Marks day={day} />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-row leading-snug', actionable ? 'font-semibold text-ink' : 'text-ink-muted')}>
          {text}
        </span>
        {hint && <span className="block text-meta text-ink-subtle">{hint}</span>}
      </span>
      {cta &&
        (actionable ? (
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-chip bg-accent px-4 text-body font-semibold text-on-accent">
            {cta}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-body font-medium text-accent-text">
            {cta}
            <ChevronLeft aria-hidden="true" size={16} />
          </span>
        ))}
    </>
  );

  if (!cta) {
    return <div className="flex min-h-14 items-center gap-3 px-1">{body}</div>;
  }

  return (
    <Link
      href="/review"
      className={cx(
        'tap-quiet press flex min-h-14 items-center gap-3 rounded-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        actionable ? 'panel px-3.5 py-3' : 'px-1',
      )}
    >
      {body}
    </Link>
  );
}

function describe(day: DayView, partnerName: string): { text: string; hint?: string; cta: string | null } {
  if (day.revealed) return { text: copy.today.day.revealed, cta: copy.today.day.see };
  if (day.mine) return { text: copy.today.day.waiting(partnerName), cta: copy.today.day.see };
  if (!day.canClose) return { text: copy.today.day.tooEarly(day.reviewTime), cta: null };
  if (day.partnerSubmitted) return { text: copy.today.day.partnerFirst(partnerName), cta: copy.today.day.go };
  return { text: copy.today.day.open, hint: copy.today.day.openHint, cta: copy.today.day.go };
}

/** Me and my partner: solid once closed, an outline until then; overlapping once revealed. */
function Marks({ day }: { day: DayView }) {
  const size = 22;
  const closed = (done: boolean) => (done ? '' : 'partner-mark--open');
  return (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center', day.revealed ? '-space-x-2' : 'gap-1')} dir="ltr">
      <PartnerMark partner={day.me} size={size} className={closed(Boolean(day.mine))} />
      {day.partner && <PartnerMark partner={day.partner} size={size} className={closed(day.partnerSubmitted)} />}
    </span>
  );
}
