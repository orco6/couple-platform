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

import { Card, Figure, RangeStepper, ReflectionTabs, TasksDone, WeekRows } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.month.pageTitle };

/**
 * THE MONTH — the same figures as the week, over the month (fifth edition):
 * how many tasks got done and whose, week by week as rows (a bar, done of
 * total, and the respect average), and how it went. Plain numbers; the trend
 * is read down the rows.
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
  const daysSoFar = summary.days.filter((day) => day.date <= today).length;

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
          <p className="mx-auto mt-2 max-w-xs text-body text-balance text-ink-muted">{copy.month.emptyWhat}</p>
        </div>
      ) : (
        <>
          <Card title={copy.week.completionTitle}>
            <TasksDone total={summary.completion} byOwner={summary.byOwner} me={summary.me} partner={summary.partner} />
          </Card>

          <Card
            title={copy.month.weeklyAveragesTitle}
            aside={<span className="text-meta text-ink-muted">{copy.month.columns}</span>}
          >
            <WeekRows weeks={summary.weeks} />
          </Card>

          <Card title={copy.week.howItWentTitle}>
            <div className="mt-1 divide-y divide-rule-faint">
              <Figure
                label={copy.week.executionTitle}
                hint={copy.week.executionHint}
                value={summary.executionAverage === null ? null : summary.executionAverage.toFixed(1)}
                suffix={copy.common.outOfFive}
              />
              <Figure
                label={copy.week.respectTitle}
                hint={copy.week.respectHint}
                value={summary.respectAverage === null ? null : summary.respectAverage.toFixed(1)}
                suffix={copy.common.outOfFive}
              />
              <Figure label={copy.week.closedTogetherTitle} value={copy.week.completionDetail(together, daysSoFar)} />
            </div>
          </Card>
        </>
      )}
    </Screen>
  );
}
