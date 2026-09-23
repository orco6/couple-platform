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
import type { Insight } from '@/domain/summaries/calculations';
import { getWeekSummary, shiftWeek, weekBounds } from '@/domain/summaries/summaries';

import { Card, DayBars, Figure, RangeStepper, ReflectionTabs, TasksDone } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.week.pageTitle };


/**
 * THE WEEK — exactly what happened, plainly (fifth edition).
 *
 * The Hebrew week runs Sunday → Saturday; until Saturday it is "this week so
 * far". Nothing is snapshotted: every figure is recomputed from the rows.
 *
 * Reading order: how many tasks got done (and whose); day by day; how it went
 * (task ratings, respect, days closed together); one thing for next week.
 * Every figure is written out as "done of total" or "x of 5".
 */
export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const actor = await requireActorPage();
  const params = await searchParams;

  const today = todayIn();
  const anchor: CalendarDate = params.w && isCalendarDate(params.w) ? params.w : today;
  const summary = await getWeekSummary(db, actor, anchor);

  const thisWeek = weekBounds(today);
  const isCurrent = compareCalendarDates(summary.from, thisWeek.from) >= 0;
  const lastDay = addDays(summary.toExclusive, -1);
  const partnerName = summary.partner?.name ?? copy.common.partnerFallback;

  const closedTogether = summary.days.filter((day) => day.theirs).length;
  const daysSoFar = summary.days.filter((day) => day.date <= today).length;

  return (
    <Screen className="pb-24">
      <ReflectionTabs current="week" />
      <RangeStepper
        title={copy.week.pageTitle}
        from={summary.from}
        to={lastDay}
        kind="week"
        previousHref={`/week?w=${shiftWeek(anchor, -1)}`}
        nextHref={isCurrent ? null : `/week?w=${shiftWeek(anchor, 1)}`}
      />

      {summary.isEmpty ? (
        <div className="mt-16 text-center">
          <p className="text-section font-semibold text-balance text-ink">{copy.week.emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-xs text-body text-balance text-ink-muted">{copy.week.emptyWhat}</p>
        </div>
      ) : (
        <>
          <Card title={copy.week.completionTitle}>
            <TasksDone total={summary.completion} byOwner={summary.byOwner} me={summary.me} partner={summary.partner} />
          </Card>

          <Card title={copy.week.byDayTitle}>
            <DayBars byDay={summary.byDay} today={today} />
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
              <Figure
                label={copy.week.closedTogetherTitle}
                value={copy.week.completionDetail(closedTogether, daysSoFar)}
              />
            </div>
          </Card>

          <Card title={copy.week.insightTitle}>
            <p className="mt-1 text-row text-balance text-ink">{insightText(summary.insight, partnerName)}</p>
          </Card>
        </>
      )}
    </Screen>
  );
}

function insightText(insight: Insight, partnerName: string): string {
  const lines = copy.week.insight;
  switch (insight.key) {
    case 'unratedTasks':
      return lines.unratedTasks(insight.count ?? 1);
    case 'lowCompletion':
      return lines.lowCompletion;
    case 'unbalancedTasks':
      return lines.unbalancedTasks(insight.heavierOwnerIsMe ? copy.common.me : partnerName);
    case 'fewClosedDays':
      return lines.fewClosedDays;
    case 'respectDip':
      return lines.respectDip;
    case 'allGood':
      return lines.allGood;
  }
}
