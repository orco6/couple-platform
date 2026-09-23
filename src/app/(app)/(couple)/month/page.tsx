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
import { EmptyState } from '@/core/ui/components/States';
import { copy } from '@/domain/copy';
import { getMonthSummary, monthBounds, shiftMonth } from '@/domain/summaries/summaries';

import { FactRow, RangeStepper, ReflectionTabs, Story, TrendRow } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

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
      <h1 className="mb-4 px-1 text-title leading-tight font-semibold text-ink">{copy.month.pageTitle}</h1>
      <ReflectionTabs current="month" />

      <RangeStepper
        from={summary.from}
        to={lastDay}
        kind="month"
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
        <>
          <Story>
            {summary.respectTrend === 'up'
              ? copy.reflection.monthStory.up
              : summary.respectTrend === 'down'
                ? copy.reflection.monthStory.down
                : copy.reflection.monthStory.steady}
          </Story>

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

          <div className="panel panel-rows mb-6">
            <TrendRow
              title={copy.month.completionTrendTitle}
              values={completionValues}
              direction={summary.completionTrend}
              min={0}
              max={100}
            />
            <TrendRow title={copy.month.toneTrendTitle} values={respectValues} direction={summary.respectTrend} min={1} max={5} />
          </div>

          <section aria-labelledby="weeks-title">
            <h2 id="weeks-title" className="mb-2 px-1 text-meta font-semibold text-ink-subtle">
              {copy.month.weeklyAveragesTitle}
            </h2>
            <ul className="panel panel-rows">
              {summary.weeks.map((week) => (
                <li key={week.from} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-24 shrink-0">
                    <span className="block text-body font-medium text-ink">{copy.month.weekLabel(week.index)}</span>
                    {/* <bdi>: "שבוע 4" ends in a digit and the date starts with one. */}
                    <bdi className="block text-meta text-ink-subtle" dir="ltr">
                      {formatCalendarDate(week.from)}
                    </bdi>
                  </span>
                  <span className="h-1 min-w-0 flex-1" aria-hidden="true">
                    <span
                      className="block h-full origin-left rounded-full bg-accent rtl:origin-right"
                      style={{ transform: `scaleX(${(week.completionPercent ?? 0) / 100})` }}
                    />
                  </span>
                  <span className="flex w-20 shrink-0 items-baseline justify-end gap-2 text-meta tabular-nums" dir="ltr">
                    <span className="text-ink">{week.completionPercent === null ? '—' : `${week.completionPercent}%`}</span>
                    <span className="text-ink-subtle">{week.respectAverage === null ? '—' : week.respectAverage.toFixed(1)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Screen>
  );
}
