import { requireActorPage } from '@/core/auth/page-guards';
import {
  addDays,
  compareCalendarDates,
  isCalendarDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { EmptyState } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';
import type { Insight } from '@/domain/summaries/calculations';
import { getWeekSummary, shiftWeek, weekBounds } from '@/domain/summaries/summaries';

import { FactRow, RangeStepper, ReflectionTabs, Rhythm, Story } from '../_components/ReflectionParts';
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
 * never invented); the shape of the days, two circles each; the three figures
 * as sentences; what went well; one thing for next week.
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
    <Screen>
      <h1 className="mb-4 px-1 text-title leading-tight font-semibold text-ink">{copy.week.pageTitle}</h1>
      <ReflectionTabs current="week" />

      <RangeStepper
        from={summary.from}
        to={lastDay}
        kind="week"
        previousHref={`/week?w=${shiftWeek(anchor, -1)}`}
        nextHref={isCurrent ? null : `/week?w=${shiftWeek(anchor, 1)}`}
      />

      {summary.isEmpty ? (
        <EmptyState
          title={copy.week.emptyTitle}
          description={
            <>
              {copy.week.emptyWhy} {copy.week.emptyWhat}
            </>
          }
        />
      ) : (
        <>
          <Story>{storyOf(summary)}</Story>

          <Rhythm days={summary.days} me={summary.me} partner={summary.partner} today={today} />

          <div className="panel panel-rows mb-4">
            <FactRow
              label={copy.week.completionTitle}
              detail={copy.week.completionDetail(summary.completion.done, summary.completion.total)}
              figure={summary.completion.percent === null ? null : `${summary.completion.percent}%`}
            />
            <FactRow
              label={copy.week.executionTitle}
              figure={summary.executionAverage === null ? null : summary.executionAverage.toFixed(1)}
              suffix={copy.common.outOfFive}
            />
            <FactRow
              label={copy.week.respectTitle}
              figure={summary.respectAverage === null ? null : summary.respectAverage.toFixed(1)}
              suffix={copy.common.outOfFive}
            />
          </div>

          <Highlights summary={summary} />

          <section className="px-1 pt-2">
            <h2 className="text-meta font-semibold text-ink-subtle">{copy.week.insightTitle}</h2>
            <p className="mt-1 text-row text-balance text-ink">{insightText(summary.insight, partnerName)}</p>
          </section>
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

/** What went well — only the things that are actually true this week. */
function Highlights({ summary }: { summary: Week }) {
  const rows: string[] = [];
  if (summary.streak > 0) rows.push(`${copy.week.streakDays(summary.streak)} ${copy.week.streakHint}`);
  if (summary.bestDay) {
    const weekday = new Date(`${summary.bestDay.date}T12:00:00Z`).getUTCDay();
    rows.push(copy.week.bestDay(copy.reflection.dayNames[weekday] ?? ''));
  }
  if (summary.completion.percent === 100 && summary.completion.total > 0) rows.push(copy.week.allTasksDone);
  if (summary.perfectTaskTitle) rows.push(copy.week.perfectTask(summary.perfectTaskTitle));
  if (rows.length === 0) return null;

  return (
    <section className="mb-5 px-1" aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="mb-1.5 text-meta font-semibold text-ink-subtle">
        {copy.week.highlightsTitle}
      </h2>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row} className="flex items-start gap-2.5 text-row text-ink">
            <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-rule-strong" />
            <span className="text-balance">{row}</span>
          </li>
        ))}
      </ul>
    </section>
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
