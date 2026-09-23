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

import { Fact, Facts, RangeStepper, ReflectionTabs, Story, Thought, WeekLights } from '../_components/ReflectionParts';
import { RoomTone } from '../_components/RoomTone';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.week.pageTitle };

type Week = Awaited<ReturnType<typeof getWeekSummary>>;

/**
 * THE WEEK — a reflection, not a report.
 *
 * The Hebrew week runs Sunday → Saturday; until Saturday it is "this week so
 * far". Nothing is snapshotted: every figure is recomputed from the rows, so a
 * late rating still lands in the right week.
 *
 * Reading order: one sentence about the week (chosen from the real averages,
 * never invented); the days as lights; three facts; one thought for next week.
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

  return (
    <Screen className="pb-24">
      <RoomTone average={summary.respectAverage} strength={0.75} />
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
          <p className="mx-auto mt-2 max-w-xs text-body text-balance text-ink-subtle">{copy.week.emptyWhat}</p>
        </div>
      ) : (
        <>
          <Story>{storyOf(summary)}</Story>
          <WeekLights days={summary.days} partner={summary.partner} today={today} />
          <Facts>
            <Fact
              label={copy.week.completionTitle}
              figure={summary.completion.total === 0 ? null : copy.week.completionDetail(summary.completion.done, summary.completion.total)}
            />
            <Fact
              label={copy.week.executionTitle}
              figure={summary.executionAverage === null ? null : summary.executionAverage.toFixed(1)}
              suffix={copy.common.outOfFive}
            />
            <Fact
              label={copy.week.respectTitle}
              figure={summary.respectAverage === null ? null : summary.respectAverage.toFixed(1)}
              suffix={copy.common.outOfFive}
            />
          </Facts>
          <Thought title={copy.week.insightTitle}>{insightText(summary.insight, partnerName)}</Thought>
        </>
      )}
    </Screen>
  );
}

/** One sentence for the week, from the real averages. Never a figure it does not have. */
function storyOf(summary: Week): string {
  const story = copy.reflection.story;
  const respect = summary.respectAverage;
  if (respect !== null) {
    if (respect >= 4.5) return story.warm;
    if (respect >= 3.5) return story.good;
    if (respect >= 2.5) return story.mixed;
    return story.hard;
  }
  return summary.completion.done > 0 ? story.busy : story.quiet;
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
