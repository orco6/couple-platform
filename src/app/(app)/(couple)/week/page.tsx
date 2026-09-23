import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { requireActorPage } from '@/core/auth/page-guards';
import type { Actor } from '@/core/auth/actor';
import { addDays, compareCalendarDates, isCalendarDate, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { copy } from '@/domain/copy';
import type { Insight } from '@/domain/summaries/calculations';
import { getWeekSummary, getWeeksOverview, weekBounds, type WeekGlance } from '@/domain/summaries/summaries';

import { Card, DayBars, Figure, rangeLabel, TasksDone } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.week.pageTitle };

/**
 * SUMMARY — two levels, like a Settings app (fifth edition).
 *
 *   /week          this week at the top, with the three figures that say how
 *                  it is going, then every earlier week as one row each;
 *   /week?w=DATE   one week in full: tasks done and whose, day by day, how it
 *                  went, and one thought for next week — with a way back.
 *
 * Every figure is written out ("12 מתוך 18", "4.3 מתוך 5"); nothing to decode.
 */
export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const actor = await requireActorPage();
  const params = await searchParams;
  const today = todayIn();

  if (params.w && isCalendarDate(params.w)) return <WeekDetail actor={actor} anchor={params.w} today={today} />;

  const weeks = await getWeeksOverview(db, actor, today);
  const [current, ...earlier] = weeks;

  return (
    <Screen className="pb-24">
      <h1 className="large-title mt-2 px-1">{copy.week.overviewTitle}</h1>

      {current && <CurrentWeek week={current} />}

      <section className="mt-7" aria-labelledby="earlier-weeks">
        <h2 id="earlier-weeks" className="mb-2 px-4 text-meta font-semibold text-ink-muted">
          {copy.week.earlierTitle}
        </h2>
        {earlier.length === 0 ? (
          <p className="figure-card px-4 py-4 text-body text-ink-muted">{copy.week.noEarlier}</p>
        ) : (
          <ul className="figure-card divide-y divide-rule-faint overflow-hidden" aria-label={copy.week.earlierTitle}>
            {earlier.map((week) => (
              <li key={week.from}>
                <Link
                  href={`/week?w=${week.from}`}
                  className="tap-quiet flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-[var(--color-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-row font-semibold text-ink">
                      <bdi>{rangeLabel(week.from, week.to, 'week')}</bdi>
                    </span>
                    <span className="mt-0.5 block text-meta text-ink-muted">
                      {week.total === 0 ? copy.week.noTasks : copy.week.tasksLine(week.done, week.total)}
                      {week.respectAverage !== null && ` · ${copy.week.respectShort} ${week.respectAverage.toFixed(1)}`}
                    </span>
                  </span>
                  <Bar done={week.done} total={week.total} className="w-16" />
                  <ChevronLeft aria-hidden="true" size={18} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

/** This week, as a card you can open: the headline figure and the three that matter. */
function CurrentWeek({ week }: { week: WeekGlance }) {
  return (
    <Link
      href={`/week?w=${week.from}`}
      className="figure-card tap-quiet press mt-4 block px-5 pt-4 pb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-row font-semibold text-ink">{copy.week.thisWeek}</span>
        <span className="text-meta text-ink-muted">
          <bdi>{rangeLabel(week.from, week.to, 'week')}</bdi>
        </span>
      </span>

      <span className="mt-3 block text-[2.25rem] leading-none font-bold text-ink tabular-nums">
        {week.total === 0 ? '—' : copy.week.completionDetail(week.done, week.total)}
      </span>
      <span className="mt-1 block text-body text-ink-muted">{copy.week.completionTitle}</span>
      <Bar done={week.done} total={week.total} className="mt-3 h-2.5 w-full" />

      <span className="mt-4 grid grid-cols-3 divide-x divide-rule-faint rtl:divide-x-reverse">
        <Stat label={copy.week.executionShort} value={week.executionAverage === null ? '—' : week.executionAverage.toFixed(1)} />
        <Stat label={copy.week.respectShort} value={week.respectAverage === null ? '—' : week.respectAverage.toFixed(1)} />
        <Stat label={copy.week.togetherShort} value={copy.week.completionDetail(week.closedTogether, week.daysSoFar)} />
      </span>

      <span className="mt-3 flex items-center justify-end gap-1 border-t border-rule-faint pt-3 text-body font-semibold text-accent-text">
        {copy.week.openWeek}
        <ChevronLeft aria-hidden="true" size={18} />
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col items-center px-1 text-center">
      <span className="text-section font-bold text-ink tabular-nums">{value}</span>
      <span className="mt-0.5 text-[0.75rem] leading-tight text-ink-muted">{label}</span>
    </span>
  );
}

/** Done out of total, filling left to right. */
function Bar({ done, total, className }: { done: number; total: number; className?: string }) {
  return (
    <span aria-hidden="true" dir="ltr" className={`block h-2 shrink-0 overflow-hidden rounded-full bg-[var(--color-rule)] ${className ?? ''}`}>
      <span className="block h-full rounded-full bg-accent" style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }} />
    </span>
  );
}

/** One week in full. */
async function WeekDetail({ actor, anchor, today }: { actor: Actor; anchor: CalendarDate; today: CalendarDate }) {
  const summary = await getWeekSummary(db, actor, anchor);
  const thisWeek = weekBounds(today);
  const isCurrent = compareCalendarDates(summary.from, thisWeek.from) >= 0;
  const lastDay = addDays(summary.toExclusive, -1);
  const partnerName = summary.partner?.name ?? copy.common.partnerFallback;
  const closedTogether = summary.days.filter((day) => day.theirs).length;
  const daysSoFar = summary.days.filter((day) => day.date <= today).length;

  return (
    <Screen className="page-push pb-24">
      <Link
        href="/week"
        className="tap-quiet press -ms-1 inline-flex min-h-11 items-center gap-0.5 rounded-chip pe-3 text-row font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ChevronRight aria-hidden="true" size={22} />
        {copy.week.overviewTitle}
      </Link>
      <h1 className="large-title mt-1 px-1">{isCurrent ? copy.week.thisWeek : copy.week.pageTitle}</h1>
      <p className="px-1 text-body text-ink-muted" data-range-from={summary.from} data-range-to={lastDay}>
        <bdi>{rangeLabel(summary.from, lastDay, 'week')}</bdi>
      </p>

      {summary.isEmpty ? (
        <div className="figure-card mt-6 px-5 py-6 text-center">
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
              <Figure label={copy.week.closedTogetherTitle} value={copy.week.completionDetail(closedTogether, daysSoFar)} />
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
