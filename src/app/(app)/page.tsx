import { requireActorPage } from '@/core/auth/page-guards';
import { todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';
import { partnersOf } from '@/domain/partners';
import { listTasksForDay } from '@/domain/tasks/tasks';

import { DayLine } from './(couple)/_components/DayLine';
import { Screen } from './(couple)/_components/Screen';
import { TodayTasks } from './(couple)/_components/TodayTasks';

export const metadata = { title: copy.nav.today };

/**
 * TODAY — a shared space for two people, not a task manager.
 *
 * The whole screen is: whose space this is (their two names, their two
 * lights), the day's question when it is time to ask it, and today's list on
 * one frosted surface. One action floats above the tab bar. No date, no
 * counts, no section titles, no explanations — the third edition removed
 * roughly two thirds of the words the second one printed.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [{ me, other }, tasks, day] = await Promise.all([
    partnersOf(db, actor),
    listTasksForDay(db, actor, today),
    getDay(db, actor, today),
  ]);

  const first = (name: string) => name.split(' ')[0] ?? name;
  const title = other ? copy.today.couple(first(me.name), first(other.name)) : first(me.name);

  return (
    <Screen className="pb-24">
      <header className="mb-6 px-2 pt-6">
        <div aria-hidden="true" dir="ltr" className="mb-4 flex -space-x-2 rtl:justify-end">
          <span className={`${me.side === 'a' ? 'light-a' : 'light-b'} size-7`} />
          {other && <span className={`${other.side === 'a' ? 'light-a' : 'light-b'} size-7`} />}
        </div>
        <h1 className="text-title leading-tight font-semibold text-ink">{title}</h1>
        <h2 className="sr-only">{copy.today.listTitle}</h2>
        <div className="mt-3 min-h-0">
          <DayLine day={day} />
        </div>
      </header>

      <TodayTasks tasks={tasks} me={me} partner={other} today={today} />
    </Screen>
  );
}
