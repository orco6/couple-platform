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
 * SUMMARY — every week, whole, on one page (ninth edition: tasks only).
 *
 * Each week is one card, in plain words:
 *
 *   13 מתוך 20 משימות בוצעו            the one number
 *   [blue | pink]  אני 5 מתוך 10 · נטיה 8 מתוך 10     whose
 *   דירוג ממוצע של המשימות   4.1 מתוך 5
 *   א ב ג ד ה ו ש — each day's done/total
 *   one sentence for next week
 *
 * The respect figure and the day closings are off the summary for now (asked
 * for). Newest first; weeks before the couple had anything are left out; this
 * week is always there. A loading screen of the same shape (loading.tsx)
 * answers the tap at once — the data is a transatlantic round trip away.
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

  return (
    <article aria-labelledby={id} className="figure-card overflow-hidden px-5 pt-4 pb-5">
      <header className="flex items-baseline justify-between gap-3">
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

      {week.total === 0 ? (
        <p className="mt-3 text-body text-balance text-ink-muted">{week.isCurrent ? copy.week.emptyWhat : copy.week.noTasksThisWeek}</p>
      ) : (
        <>
          {/* The one number: how many of how many — and whose. */}
          <p className="mt-3 text-[1.75rem] leading-tight font-bold text-ink tabular-nums">
            {copy.week.completionDetail(week.done, week.total)}
            <span className="ms-2 text-body font-medium text-ink-muted">{copy.week.tasksDone}</span>
          </p>
          <div dir="ltr" aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--color-rule)]">
            {people.map((person) => (
              <span
                key={person.id}
                className={cx('h-full', person.side === 'a' ? 'bg-partner-a' : 'bg-partner-b')}
                style={{ width: `${(tallyOf(person).done / week.total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-body text-ink-muted" aria-label={copy.week.byPerson}>
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-2 tabular-nums">
                <PartnerAvatar person={person} size={person.photo ? 1.5 : 0.75} />
                {nameOf(person)} {copy.week.completionDetail(tallyOf(person).done, tallyOf(person).total)}
              </li>
            ))}
          </ul>

          {/* How they went: the ratings you gave each other's tasks. */}
          <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-rule-faint pt-3">
            <span className="text-body text-ink">{copy.week.ratingAverage}</span>
            {week.executionAverage === null ? (
              <span className="text-body text-ink-muted">{copy.week.notYet}</span>
            ) : (
              <span className="text-row font-bold text-ink tabular-nums">
                {week.executionAverage.toFixed(1)} <span className="text-meta font-normal text-ink-muted">{copy.common.outOfFive}</span>
              </span>
            )}
          </p>

          {/* Day by day: how many of each day's tasks got done. */}
          <ol className="mt-3 grid grid-cols-7 gap-1 border-t border-rule-faint pt-3" aria-label={copy.week.byDayTitle}>
            {week.days.map((day) => (
              <DayCell key={day.date} day={day} />
            ))}
          </ol>

          {/* One thing for next week. */}
          <p className="mt-4 rounded-[1rem] bg-[var(--color-rule-faint)] px-4 py-3 text-body text-balance text-ink">
            <span className="sr-only">{copy.week.insightTitle}: </span>
            {insightText(week.insight, partner ? nameOf(partner) : copy.common.partnerFallback)}
          </p>
        </>
      )}
    </article>
  );
}

const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'narrow', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function DayCell({ day }: { day: GlanceDay }) {
  const date = new Date(`${day.date}T12:00:00Z`);
  const share = day.total === 0 ? 0 : day.done / day.total;
  return (
    <li className="flex flex-col items-center gap-1.5">
      <span aria-hidden="true" className="text-meta font-semibold text-ink-muted">
        {weekday.format(date)}
      </span>
      <span aria-hidden="true" dir="ltr" className={cx('text-meta font-semibold tabular-nums', day.total === 0 ? 'text-ink-muted' : 'text-ink')}>
        {day.total === 0 ? '–' : `${day.done}/${day.total}`}
      </span>
      <span aria-hidden="true" dir="ltr" className="block h-1.5 w-full max-w-8 overflow-hidden rounded-full bg-[var(--color-rule)]">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="sr-only">
        {longDay.format(date)}: {day.total === 0 ? copy.week.noTasks : copy.week.tasksLine(day.done, day.total)}
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
