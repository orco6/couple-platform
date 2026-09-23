import { requireActorPage } from '@/core/auth/page-guards';
import { todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { businessLocale } from '@/brand/brand';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';
import { partnersOf } from '@/domain/partners';
import { listTasksForDay } from '@/domain/tasks/tasks';

import { DayLine } from './(couple)/_components/DayLine';
import { Screen } from './(couple)/_components/Screen';
import { TodayTasks } from './(couple)/_components/TodayTasks';

export const metadata = { title: copy.nav.today };

/**
 * TODAY — the heart of the product, and the simplest screen in it.
 *
 * It answers one question — "what is ours today?" — in reading order:
 *
 *   1. when and who: the date and a greeting that knows the hour;
 *   2. the day, as one line (DayLine) that only becomes an action when it is
 *      time to close it;
 *   3. the list, with adding a task as its first row.
 *
 * What left, and why (second edition, after a real-iPhone review): the
 * gradient day card (a hero on a screen that needs none), the three list
 * sections (a task teleported between them on every tap), the separate "add"
 * button under the list (the obvious action sat below the fold), and the
 * card-per-task wall. Nothing here is a figure; figures live in the summary.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [{ me, other }, tasks, day] = await Promise.all([
    partnersOf(db, actor),
    listTasksForDay(db, actor, today),
    getDay(db, actor, today),
  ]);

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: businessLocale.timeZone }).format(now),
  );
  const greeting =
    hour < 5 ? copy.today.greeting.night : hour < 12 ? copy.today.greeting.morning : hour < 17 ? copy.today.greeting.noon : hour < 22 ? copy.today.greeting.evening : copy.today.greeting.night;
  const dateLabel = new Intl.DateTimeFormat(businessLocale.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: businessLocale.timeZone,
  }).format(now);

  return (
    <Screen>
      <header className="mb-4 px-1">
        <p className="text-body text-ink-subtle">{dateLabel}</p>
        <h1 className="mt-0.5 text-title leading-tight font-semibold text-ink">
          {copy.today.greet(greeting, me.name.split(' ')[0] ?? me.name)}
        </h1>
      </header>

      <div className="mb-5">
        <DayLine day={day} />
      </div>

      <TodayTasks tasks={tasks} me={me} partner={other} today={today} />
    </Screen>
  );
}
