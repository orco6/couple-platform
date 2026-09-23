import Link from 'next/link';
import { X } from 'lucide-react';

import { requireActorPage } from '@/core/auth/page-guards';
import {
  compareCalendarDates,
  isCalendarDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { businessLocale } from '@/brand/brand';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';

import { listTasksForDay } from '@/domain/tasks/tasks';

import { ReviewForm } from '../_components/ReviewForm';
import { RevealPanel, WaitingPanel } from '../_components/RevealPanel';
import { TooEarlyPanel } from '../_components/TooEarlyPanel';

export const metadata = { title: copy.day.pageTitle };

/**
 * CLOSING THE DAY — SCREEN_BUILDING_PLAYBOOK.
 *
 *  1 Primary task: "לסגור את היום".
 *  2 What matters most: before submitting, the one question; after both have
 *    submitted, the two answers side by side.
 *  3 Secondary: which day, and whether the partner has closed it.
 *  4 Actions: one primary.
 *  5 Shape: a full page. It is the screen people open on purpose at night, and
 *    it is linkable from the attention list for a past day.
 *  6 Phone: one column, the scale at 56px stops, the primary button at the end of the
 *    flow rather than pinned — there is nothing above it to scroll past.
 *  7/8/9 States: too early (the time it opens), nothing written (the form),
 *    written and waiting (mine, plus amend while it is still allowed),
 *    revealed (both sides, frozen), a future date.
 * 10 Unauthorized: the reveal is enforced in the service; this page renders
 *    whatever the view contains, and the view cannot contain the partner's
 *    values early (R-DAY-05).
 * 11/12 RTL, with the scale LTR like every magnitude axis here.
 * 13 Audit: the date only, never the rating or the note (R-DAY-30).
 * 14 Confirmation: none. Closing a day is not destructive, and it can be
 *    amended until the partner closes theirs.
 * 15 Avoided tells: no score out of 100, no emoji faces, no streak banner.
 * 16 Specific to this product: the withheld half of the screen. Waiting is
 *    shown as waiting, never as an empty chart.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const actor = await requireActorPage();
  const params = await searchParams;

  const today = todayIn();
  const requested = params.date && isCalendarDate(params.date) ? params.date : null;
  const date: CalendarDate = requested ?? today;
  const isFuture = compareCalendarDates(date, today) > 0;

  const day = await getDay(db, actor, date);
  const partnerName = day.partner?.name ?? copy.common.partnerFallback;

  // Only needed for the "too early" state, which answers "so what do I do
  // now?" with the list rather than with an empty screen.
  const openTasks = day.canClose || day.mine ? [] : await listTasksForDay(db, actor, date);

  const dateLabel =
    date === today
      ? copy.common.today
      : new Intl.DateTimeFormat(businessLocale.language, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
          new Date(`${date}T12:00:00Z`),
        );
  const asking = !isFuture && day.canClose && !day.mine && !day.revealed;
  const partnerFirst = partnerName.split(' ')[0] ?? partnerName;

  return (
    // The day is a moment, not a tab: the bar steps aside (data-immersive) and
    // the screen is one centred column in a frame sized to the SMALL viewport,
    // so Safari's toolbar coming and going never moves it.
    <div data-immersive className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-md flex-col px-2">
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/"
          aria-label={copy.day.close}
          className="tap-quiet press grid size-11 place-items-center rounded-full text-ink-muted focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X aria-hidden="true" size={22} />
        </Link>
        <p className="text-body text-ink-subtle">{dateLabel}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center pb-10">
        <h1 className="mb-10 text-center text-[1.875rem] leading-tight font-semibold text-balance text-ink">
          {asking ? copy.day.question : day.revealed ? copy.day.revealedTitle : copy.day.pageTitle}
        </h1>

        {isFuture ? (
          <p className="text-center text-row text-ink-muted">{copy.day.notOpenYetWhy(day.reviewTime)}</p>
        ) : day.revealed && day.mine && day.theirs && day.partner ? (
          <>
            <RevealPanel me={day.me} partner={day.partner} mine={day.mine} theirs={day.theirs} />
            <p className="mt-8 text-center text-meta text-ink-subtle">{copy.day.frozenNotice}</p>
          </>
        ) : day.mine ? (
          <WaitingPanel
            partner={day.partner}
            partnerName={partnerName}
            date={date}
            mine={day.mine}
            canAmend={day.permissions.amend}
          />
        ) : day.canClose ? (
          <>
            {day.partnerSubmitted && day.partner && (
              <p className="-mt-6 mb-8 flex items-center justify-center gap-2 text-body text-ink-muted">
                <span aria-hidden="true" className={`${day.partner.side === 'a' ? 'light-a' : 'light-b'} size-3.5`} />
                {copy.day.partnerClosedAlready(partnerFirst)}
              </p>
            )}
            <ReviewForm date={date} mode="submit" />
          </>
        ) : (
          <TooEarlyPanel reviewTime={day.reviewTime} openTasks={openTasks.filter((task) => task.state === 'OPEN').length} />
        )}
      </div>
    </div>
  );
}
