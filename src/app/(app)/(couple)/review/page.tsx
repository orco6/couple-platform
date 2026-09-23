import { requireActorPage } from '@/core/auth/page-guards';
import {
  compareCalendarDates,
  isCalendarDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { businessLocale } from '@/brand/brand';
import { EmptyState } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';

import { listTasksForDay } from '@/domain/tasks/tasks';

import { ReviewForm } from '../_components/ReviewForm';
import { PartnerMark } from '../_components/PartnerMark';
import { RevealPanel, WaitingPanel } from '../_components/RevealPanel';
import { Screen } from '../_components/Screen';
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

  const heading = day.revealed || day.mine || isFuture || !day.canClose ? copy.day.pageTitle : copy.day.question;

  return (
    <Screen>
      <header className="mb-2 px-1">
        <p className="text-body text-ink-subtle">
          {date === today
            ? copy.common.today
            : new Intl.DateTimeFormat(businessLocale.language, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
                new Date(`${date}T12:00:00Z`),
              )}
        </p>
        <h1 className="mt-0.5 text-title leading-tight font-semibold text-balance text-ink">{heading}</h1>
        {heading === copy.day.question && <p className="mt-1 text-row text-ink-muted">{copy.day.respectQuestion}</p>}
      </header>

      {isFuture ? (
        <EmptyState title={copy.day.notOpenYetTitle} description={copy.day.notOpenYetWhy(day.reviewTime)} />
      ) : day.revealed && day.mine && day.theirs && day.partner ? (
        <div className="pt-6">
          <RevealPanel me={day.me} partner={day.partner} mine={day.mine} theirs={day.theirs} />
          <p className="mt-6 text-center text-meta text-ink-subtle">{copy.day.frozenNotice}</p>
        </div>
      ) : day.mine ? (
        <div className="pt-8">
          <WaitingPanel
            me={day.me}
            partner={day.partner}
            partnerName={partnerName}
            date={date}
            mine={day.mine}
            canAmend={day.permissions.amend}
          />
          {!day.permissions.amend && <p className="mt-6 text-center text-meta text-ink-subtle">{copy.day.frozenNotice}</p>}
        </div>
      ) : day.canClose ? (
        <>
          {day.partnerSubmitted && (
            <p className="mt-3 flex items-center gap-2 px-1 text-body text-ink-muted">
              <PartnerMark partner={day.partner ?? day.me} size={18} />
              {copy.day.partnerClosedAlready(partnerName)}
            </p>
          )}
          <ReviewForm date={date} mode="submit" />
        </>
      ) : (
        <TooEarlyPanel
          reviewTime={day.reviewTime}
          openTasks={openTasks.filter((task) => task.state === 'OPEN').length}
        />
      )}
    </Screen>
  );
}
