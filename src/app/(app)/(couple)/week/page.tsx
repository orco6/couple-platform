import { CalendarHeart, Flame, Sparkles, Star } from 'lucide-react';

import { requireActorPage } from '@/core/auth/page-guards';
import {
  addDays,
  compareCalendarDates,
  formatCalendarDate,
  isCalendarDate,
  todayIn,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';
import type { Insight } from '@/domain/summaries/calculations';
import { getWeekSummary, shiftWeek, weekBounds } from '@/domain/summaries/summaries';

import { AverageCard, CompletionHero, InsightCard, RangeStepper } from '../_components/SummaryParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.week.pageTitle };

/**
 * THE WEEK — the Saturday review.
 *
 * The Hebrew week runs Sunday → Saturday, so Saturday is the end of it and the
 * summary is simply "this week so far" until then. There is no "generate"
 * button and nothing is snapshotted: the figures are recomputed from the rows
 * every time, so a rating given late still lands in the right week.
 *
 * Reading order is the order a person cares: did we get through the list, how
 * did the things we asked of each other go, how were we with each other, what
 * worked, and one thing for next week. Five cards, each one figure with a word.
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

  return (
    <Screen>
      <PageHeader title={copy.week.pageTitle} description={copy.week.readyOn} />

      <RangeStepper
        label={copy.week.range(formatCalendarDate(summary.from), formatCalendarDate(lastDay))}
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
        <div className="flex flex-col gap-3">
          <CompletionHero
            title={copy.week.completionTitle}
            percent={summary.completion.percent}
            done={summary.completion.done}
            total={summary.completion.total}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <AverageCard
              title={copy.week.executionTitle}
              hint={copy.week.executionHint}
              value={summary.executionAverage}
              tone="warm"
            />
            <AverageCard
              title={copy.week.respectTitle}
              hint={copy.week.respectHint}
              value={summary.respectAverage}
              tone="accent"
            />
          </div>

          <Highlights summary={summary} />

          <InsightCard text={insightText(summary.insight, summary.partner?.name ?? copy.common.partnerFallback)} />
        </div>
      )}
    </Screen>
  );
}

/**
 * What worked. Only the items that are actually true this week get a row —
 * an empty "highlights" card with three greyed placeholders would be worse
 * than no card, so the whole section disappears when there is nothing to say.
 */
function Highlights({ summary }: { summary: Awaited<ReturnType<typeof getWeekSummary>> }) {
  const rows: Array<{ icon: React.ReactNode; text: string }> = [];

  if (summary.streak > 0) {
    rows.push({
      icon: <Flame aria-hidden="true" size={17} className="text-warning-text" />,
      text: `${copy.week.streakDays(summary.streak)} ${copy.week.streakHint}`,
    });
  }
  if (summary.bestDay) {
    rows.push({
      icon: <CalendarHeart aria-hidden="true" size={17} className="text-partner-a" />,
      text: copy.week.bestDay(formatCalendarDate(summary.bestDay.date as CalendarDate)),
    });
  }
  if (summary.completion.percent === 100 && summary.completion.total > 0) {
    rows.push({
      icon: <Sparkles aria-hidden="true" size={17} className="text-accent-text" />,
      text: copy.week.allTasksDone,
    });
  }
  if (summary.perfectTaskTitle) {
    rows.push({
      icon: <Star aria-hidden="true" size={17} className="fill-current text-warning-text" />,
      text: copy.week.perfectTask(summary.perfectTaskTitle),
    });
  }

  if (rows.length === 0) return null;

  return (
    <Section title={copy.week.highlightsTitle} className="mb-0">
      <ul className="card divide-y divide-rule-faint">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-sunken">{row.icon}</span>
            <span className="text-body text-balance text-ink">{row.text}</span>
          </li>
        ))}
      </ul>
    </Section>
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
