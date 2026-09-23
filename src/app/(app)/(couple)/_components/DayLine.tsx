import Link from 'next/link';

import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import type { DayView } from '@/domain/day-entries/day-entries';

/**
 * THE DAY, AS AN INVITATION — or nothing at all.
 *
 * Before the shared hour there is nothing to do about the day, so there is
 * nothing on Today about it (the first editions printed "closing opens at
 * 21:30" all day long). When it is time, one line with a warm light asks the
 * question. While waiting for the other, two small lights — mine lit, theirs
 * a ring — and their name. Once both have closed, the two lights overlap.
 */
export function DayLine({ day }: { day: DayView }) {
  const partnerName = (day.partner?.name ?? copy.common.partnerFallback).split(' ')[0] ?? '';

  if (day.revealed && day.partner) {
    return (
      <Link href="/review" className="tap-quiet press inline-flex min-h-11 items-center gap-3 rounded-chip pe-2 text-row font-medium text-ink">
        <Pair day={day} overlap />
        {copy.today.ours}
      </Link>
    );
  }

  if (day.mine) {
    return (
      <Link href="/review" className="tap-quiet press inline-flex min-h-11 items-center gap-3 rounded-chip pe-2 text-row text-ink-muted">
        <Pair day={day} />
        {day.partner ? copy.today.waitingFor(partnerName) : copy.errors.noPartnerYet}
      </Link>
    );
  }

  if (!day.canClose) return null;

  return (
    <Link
      href="/review"
      className="tap-quiet press group inline-flex min-h-14 items-center gap-3.5 rounded-chip text-[1.25rem] font-semibold text-ink"
    >
      <span aria-hidden="true" className="invite-light size-11 shrink-0" />
      {copy.today.invite}
    </Link>
  );
}

function Pair({ day, overlap = false }: { day: DayView; overlap?: boolean }) {
  const light = (side: 'a' | 'b') => (side === 'a' ? 'light-a' : 'light-b');
  return (
    <span aria-hidden="true" dir="ltr" className={cx('flex items-center', overlap ? '-space-x-2' : 'gap-1')}>
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
