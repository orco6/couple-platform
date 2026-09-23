import { requireActorPage } from '@/core/auth/page-guards';
import {
  addDays,
  compareCalendarDates,
  isCalendarDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { copy } from '@/domain/copy';
import { getMonthSummary, monthBounds, shiftMonth } from '@/domain/summaries/summaries';

import { MonthLights, RangeStepper, ReflectionTabs, Story } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.month.pageTitle };

/**
 * THE MONTH — one sentence and one picture.
 *
 * The month adds exactly one idea to the week: direction. It is carried by
 * the picture — every day a light in the colour of its answer, week under
 * week — and said once in words. No percentages, no trend lines, no figures
 * blocks: a couple looking back at a month wants to know whether it got
 * better, not to read a dashboard.
 */
export default async function MonthPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const actor = await requireActorPage();
  const params = await searchParams;

  const today = todayIn();
  const anchor: CalendarDate = params.m && isCalendarDate(params.m) ? params.m : today;
  const summary = await getMonthSummary(db, actor, anchor);

  const thisMonth = monthBounds(today);
  const isCurrent = compareCalendarDates(summary.from, thisMonth.from) >= 0;
  const lastDay = addDays(summary.toExclusive, -1);

  const together = summary.days.filter((day) => day.theirs).length;

  return (
    <Screen className="pb-24">
      <ReflectionTabs current="month" />
      <RangeStepper
        title={copy.month.pageTitle}
        from={summary.from}
        to={lastDay}
        kind="month"
        previousHref={`/month?m=${shiftMonth(anchor, -1)}`}
        nextHref={isCurrent ? null : `/month?m=${shiftMonth(anchor, 1)}`}
      />

      {summary.isEmpty ? (
        <div className="mt-16 text-center">
          <p className="text-section font-semibold text-balance text-ink">{copy.month.emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-xs text-body text-balance text-ink-subtle">{copy.month.emptyWhat}</p>
        </div>
      ) : (
        <>
          <Story>
            {summary.respectTrend === 'up'
              ? copy.reflection.monthStory.up
              : summary.respectTrend === 'down'
                ? copy.reflection.monthStory.down
                : copy.reflection.monthStory.steady}
          </Story>
          <MonthLights days={summary.days} today={today} />
          <p className="mt-8 text-center text-body text-ink-muted">{copy.month.facts(summary.completion.done, together)}</p>
        </>
      )}
    </Screen>
  );
}
