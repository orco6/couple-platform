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
import { getMonthSummary, monthBounds, shiftMonth } from '@/domain/summaries/summaries';

import { AverageCard, CompletionHero, RangeStepper } from '../_components/SummaryParts';
import { Screen } from '../_components/Screen';
import { TrendLine } from '../_components/TrendLine';

export const metadata = { title: copy.month.pageTitle };

/**
 * THE MONTH — the same figures, as a shape.
 *
 * The month adds exactly one idea to the week: direction. So it shows the
 * month's totals once, then two small unlabelled lines — the list and the tone
 * — each with a word saying which way it went, and a row of weekly averages
 * underneath.
 *
 * What it deliberately does not do: axes, gridlines, tooltips, a second
 * percentage next to the first, or any chart that would need a legend. A couple
 * looking back at a month wants to know whether it got better, not to read a
 * dashboard.
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

  const completionValues = summary.weeks.map((week) => week.completionPercent);
  const respectValues = summary.weeks.map((week) => week.respectAverage);

  return (
    <Screen>
      <PageHeader title={copy.month.pageTitle} />

      <RangeStepper
        label={copy.week.range(formatCalendarDate(summary.from), formatCalendarDate(lastDay))}
        previousHref={`/month?m=${shiftMonth(anchor, -1)}`}
        nextHref={isCurrent ? null : `/month?m=${shiftMonth(anchor, 1)}`}
      />

      {summary.isEmpty ? (
        <EmptyState
          title={copy.month.emptyTitle}
          description={
            <>
              {copy.month.emptyWhy} {copy.month.emptyWhat}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <TrendLine
              title={copy.month.completionTrendTitle}
              values={completionValues}
              direction={summary.completionTrend}
              min={0}
              max={100}
              tone="warm"
              caption={copy.month.weeklyAveragesTitle}
            />
            <TrendLine
              title={copy.month.toneTrendTitle}
              values={respectValues}
              direction={summary.respectTrend}
              min={1}
              max={5}
              tone="accent"
              caption={copy.month.weeklyAveragesTitle}
            />
          </div>

          <Section title={copy.month.weeklyAveragesTitle} className="mb-0">
            <ul className="card divide-y divide-rule-faint">
              {summary.weeks.map((week) => (
                <li key={week.from} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="text-body font-medium text-ink">{copy.month.weekLabel(week.index)}</span>
                    {/* <bdi>, not a span: "שבוע 4" ends in a digit and the date
                        starts with one, so without isolation the two run
                        together into "4 20.09.2026" as one number. */}
                    <bdi className="ms-3 text-meta text-ink-subtle" dir="ltr">
                      {formatCalendarDate(week.from)}
                    </bdi>
                  </span>

                  <span className="flex shrink-0 items-center gap-3 tabular-nums" dir="ltr">
                    <span className="text-meta text-partner-a">
                      {week.completionPercent === null ? '—' : `${week.completionPercent}%`}
                    </span>
                    <span className="text-meta text-accent-text">
                      {week.respectAverage === null ? '—' : week.respectAverage.toFixed(1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </Screen>
  );
}
