import Link from 'next/link';
import { ChevronLeft, Clock } from 'lucide-react';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { DayView } from '@/domain/day-entries/day-entries';

/**
 * CLOSING THE DAY, FROM TODAY — always visible, always saying where it stands.
 *
 * The fourth edition hid it until the hour came, and the owner asked "how do
 * we close a day at all?". So it is one row on Today, in four states:
 *
 *   before the hour   🕒 אפשר לסגור את היום מ־21:30        (quiet, no action)
 *   time to close     [ סגירת היום ]  + one line: how it works
 *   I closed          ● ○ סגרת · מחכים לנטיה              ›
 *   both closed       ●● שניכם סגרתם · לראות              ›
 */
export function DayLine({ day }: { day: DayView }) {
  const partnerName = (day.partner?.name ?? copy.common.partnerFallback).split(' ')[0] ?? '';
  const row =
    'tap-quiet press glass flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] px-4 text-row focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

  if (day.revealed && day.partner) {
    return (
      <Link href="/review" className={cx(row, 'font-medium text-ink')}>
        <Pair day={day} overlap />
        <span className="flex-1">{copy.today.bothClosed}</span>
        <ChevronLeft aria-hidden="true" size={18} className="text-ink-muted" />
      </Link>
    );
  }

  if (day.mine) {
    return (
      <Link href="/review" className={cx(row, 'text-ink')}>
        <Pair day={day} />
        <span className="flex-1">{day.partner ? copy.today.youClosed(partnerName) : copy.errors.noPartnerYet}</span>
        <ChevronLeft aria-hidden="true" size={18} className="text-ink-muted" />
      </Link>
    );
  }

  if (!day.canClose) {
    return (
      <p className="flex min-h-11 items-center gap-2.5 px-1 text-body text-ink-muted">
        <Clock aria-hidden="true" size={18} />
        {copy.today.closeOpensAt(day.reviewTime)}
      </p>
    );
  }

  return (
    <div>
      <Link
        href="/review"
        className="tap-quiet press flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] bg-accent px-4 text-row font-semibold text-on-accent shadow-[var(--brand-shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden="true" className="invite-light size-8 shrink-0" />
        <span className="flex-1">{copy.today.closeDay}</span>
        <ChevronLeft aria-hidden="true" size={20} />
      </Link>
      <p className="mt-2 px-1 text-meta text-ink-muted">{copy.today.closeHow}</p>
    </div>
  );
}

function Pair({ day, overlap = false }: { day: DayView; overlap?: boolean }) {
  const light = (side: 'a' | 'b') => (side === 'a' ? 'light-a' : 'light-b');
  return (
    <span aria-hidden="true" dir="ltr" className={cx('flex shrink-0 items-center', overlap ? '-space-x-2' : 'gap-1')}>
      <span className={cx(light(day.me.side), 'size-5')} />
      {day.partner &&
        (day.partnerSubmitted || overlap ? (
          <span className={cx(light(day.partner.side), 'size-5')} />
        ) : (
          <span
            className={cx(
              'size-5 rounded-full shadow-[inset_0_0_0_1.5px_currentColor]',
              day.partner.side === 'a' ? 'text-partner-a' : 'text-partner-b',
            )}
          />
        ))}
    </span>
  );
}
