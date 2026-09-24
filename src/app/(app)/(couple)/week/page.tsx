import { requireActorPage } from '@/core/auth/page-guards';
import { addDays, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { cx } from '@/core/ui/cx';
import { copy } from '@/domain/copy';
import { partnersOf, type PartnerRef } from '@/domain/partners';
import type { Insight } from '@/domain/summaries/calculations';
import { getWeeksOverview, weekBounds, type GlanceDay, type WeekGlance } from '@/domain/summaries/summaries';

import { PageTransition } from '../_components/PageTransition';
import { PartnerAvatar } from '../_components/PartnerAvatar';
import { rangeLabel } from '../_components/ReflectionParts';
import { Screen } from '../_components/Screen';

export const metadata = { title: copy.week.overviewTitle };

/**
 * SUMMARY — every week, whole, on one page (eighth edition).
 *
 * The earlier summary was two levels (a front card, then a week page) and
 * people could not say what had happened in a given week. Now each week is
 * one card that answers, in order and in plain words:
 *
 *   how many tasks got done, and whose          12 מתוך 18 · אור 7/9 · מאיה 5/9
 *   how they went (the ratings you gave)        4.3 מתוך 5
 *   how it was between us (the day closings)    4.1 מתוך 5
 *   which days we closed together               א ב ג ד ה ו ש — each with its tasks
 *   one thing for next week
 *
 * Newest first. Weeks before the couple had anything are left out; this week
 * is always there. Nothing to open, nothing to decode, no percentages.
 */
export default async function WeekPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [weeks, { me, other }] = await Promise.all([getWeeksOverview(db, actor, today), partnersOf(db, actor)]);
  const lastWeekFrom = addDays(weekBounds(today).from, -7);

  return (
    <PageTransition>
      <Screen className="pb-24">
        <h1 className="large-title mt-2 px-1">{copy.week.overviewTitle}</h1>
        <p className="mt-1 px-1 text-body text-ink-muted">{copy.week.pageIntro}</p>

        <div className="mt-5 space-y-5">
          {weeks.map((week) => (
            <WeekCard
              key={week.from}
              week={week}
              me={me}
              partner={other}
              title={week.isCurrent ? copy.week.thisWeek : week.from === lastWeekFrom ? copy.week.lastWeek : null}
            />
          ))}
        </div>
      </Screen>
    </PageTransition>
  );
}

function WeekCard({
  week,
  me,
  partner,
  title,
}: {
  week: WeekGlance;
  me: PartnerRef;
  partner: PartnerRef | null;
  /** "השבוע" / "שבוע שעבר"; older weeks are named by their dates. */
  title: string | null;
}) {
  const id = `week-${week.from}`;
  const range = rangeLabel(week.from, week.to, 'week');
  const people = partner ? [me, partner] : [me];
  const nameOf = (person: PartnerRef) => (person.id === me.id ? copy.common.me : (person.name.split(' ')[0] ?? person.name));
  const tallyOf = (person: PartnerRef) => week.byOwner.find((tally) => tally.ownerId === person.id) ?? { done: 0, total: 0 };
  const empty = week.total === 0 && week.days.every((day) => day.closed === 'none');

  return (
    <article aria-labelledby={id} className="figure-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
        {/* Named weeks (this one, last one) say their dates beside the name;
            older ones are named by their dates, once. */}
        <h2 id={id} className="text-section font-bold text-ink" {...(title ? {} : { 'data-range-from': week.from, 'data-range-to': week.to })}>
          {title ?? <bdi>{range}</bdi>}
        </h2>
        {title && (
          <p className="shrink-0 text-meta text-ink-muted" data-range-from={week.from} data-range-to={week.to}>
            <bdi>{range}</bdi>
          </p>
        )}
      </header>

      {empty ? (
        <p className="px-5 pt-3 pb-5 text-body text-balance text-ink-muted">{copy.week.emptyWhat}</p>
      ) : (
        <>
          {/* Tasks: how many of how many, and whose. */}
          <section className="px-5 pt-4" aria-label={copy.week.completionTitle}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-body font-semibold text-ink">{copy.week.completionTitle}</h3>
              <p className="text-row font-bold text-ink tabular-nums">
                {week.total === 0 ? copy.week.noTasks : copy.week.completionDetail(week.done, week.total)}
              </p>
            </div>
            {week.total > 0 && (
              <>
                <div dir="ltr" aria-hidden="true" className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-rule)]">
                  {people.map((person) => (
                    <span
                      key={person.id}
                      className={cx('h-full', person.side === 'a' ? 'bg-partner-a' : 'bg-partner-b')}
                      style={{ width: `${(tallyOf(person).done / week.total) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-meta text-ink-muted">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center gap-1.5 tabular-nums">
                      <PartnerAvatar person={person} size={person.photo ? 1.25 : 0.625} />
                      {nameOf(person)} {copy.week.completionDetail(tallyOf(person).done, tallyOf(person).total)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* The two averages, each out of five, each said in words. */}
          <dl className="mx-5 mt-4 divide-y divide-rule-faint border-y border-rule-faint">
            <Figure label={copy.week.executionTitle} hint={copy.week.executionHint} value={week.executionAverage} />
            <Figure label={copy.week.respectTitle} hint={copy.week.respectHint} value={week.respectAverage} />
          </dl>

          {/* Day by day. */}
          <section className="px-5 pt-4" aria-label={copy.week.byDayTitle}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-body font-semibold text-ink">{copy.week.closedTogetherTitle}</h3>
              <p className="text-row font-bold text-ink tabular-nums">{copy.week.completionDetail(week.closedTogether, week.daysSoFar)}</p>
            </div>
            <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={copy.week.byDayTitle}>
              {week.days.map((day) => (
                <DayCell key={day.date} day={day} />
              ))}
            </ol>
            <p aria-hidden="true" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.75rem] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="day-mark day-mark--both" />
                {copy.week.legendBoth}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="day-mark day-mark--one" />
                {copy.week.legendOne}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="day-mark day-mark--none" />
                {copy.week.legendNone}
              </span>
            </p>
          </section>

          {/* One thing for next week. */}
          <section className="mx-5 mt-4 mb-5 rounded-[1rem] bg-[var(--color-rule-faint)] px-4 py-3" aria-label={copy.week.insightTitle}>
            <h3 className="text-meta font-semibold text-ink-muted">{copy.week.insightTitle}</h3>
            <p className="mt-0.5 text-body text-balance text-ink">
              {insightText(week.insight, partner ? nameOf(partner) : copy.common.partnerFallback)}
            </p>
          </section>
        </>
      )}
    </article>
  );
}

function Figure({ label, hint, value }: { label: string; hint: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt>
        <span className="block text-body font-semibold text-ink">{label}</span>
        <span className="block text-meta text-ink-muted">{hint}</span>
      </dt>
      <dd className="shrink-0 text-end">
        {value === null ? (
          <span className="text-body text-ink-muted">{copy.week.notYet}</span>
        ) : (
          <span className="text-row font-bold text-ink tabular-nums">
            {value.toFixed(1)} <span className="text-meta font-normal text-ink-muted">{copy.common.outOfFive}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'narrow', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function DayCell({ day }: { day: GlanceDay }) {
  const date = new Date(`${day.date}T12:00:00Z`);
  const closedText = day.future ? copy.week.dayAhead : day.closed === 'both' ? copy.week.legendBoth : day.closed === 'one' ? copy.week.legendOne : copy.week.legendNone;
  return (
    <li className={cx('flex flex-col items-center gap-1 rounded-[0.75rem] py-2', day.future ? 'shadow-[inset_0_0_0_1px_var(--color-rule-faint)]' : 'bg-[var(--color-rule-faint)]')}>
      <span aria-hidden="true" className="text-meta font-semibold text-ink-muted">
        {weekday.format(date)}
      </span>
      <span aria-hidden="true" className={cx('day-mark', day.future ? 'day-mark--ahead' : `day-mark--${day.closed}`)} />
      <span aria-hidden="true" dir="ltr" className="text-[0.75rem] font-semibold text-ink tabular-nums">
        {day.total === 0 ? '–' : `${day.done}/${day.total}`}
      </span>
      <span className="sr-only">
        {longDay.format(date)}: {day.total === 0 ? copy.week.noTasks : copy.week.tasksLine(day.done, day.total)}, {closedText}
      </span>
    </li>
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
