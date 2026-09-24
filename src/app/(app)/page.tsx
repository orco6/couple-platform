import { cookies } from 'next/headers';

import { requireActorPage } from '@/core/auth/page-guards';
import { addDays, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';
import { partnersOf } from '@/domain/partners';
import { listTasksForDay } from '@/domain/tasks/tasks';

import { DayLine } from './(couple)/_components/DayLine';
import { PageTransition } from './(couple)/_components/PageTransition';
import { PartnerAvatar } from './(couple)/_components/PartnerAvatar';
import { Screen } from './(couple)/_components/Screen';
import { TodayTasks } from './(couple)/_components/TodayTasks';
import { readTodayView, TODAY_VIEW_COOKIE } from './(couple)/_components/today-view';

export const metadata = { title: copy.nav.today };

/**
 * TODAY — a shared space for two people, not a task manager.
 *
 * The whole screen is: whose space this is (their two names, large, and their
 * two lights), the day's question when it is time to ask it, and today's list
 * on one frosted surface under one quiet label — "these are our tasks" has to
 * be read in a second. One action floats above the tab bar. No date, no
 * counts, no explanations. The room behind carries the look, so the screen is
 * still a place with nothing on the list.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [{ me, other }, tasks, tomorrowTasks, day, jar] = await Promise.all([
    partnersOf(db, actor),
    listTasksForDay(db, actor, today),
    listTasksForDay(db, actor, addDays(today, 1)),
    getDay(db, actor, today),
    cookies(),
  ]);

  const first = (name: string) => name.split(' ')[0] ?? name;
  const title = other ? copy.today.couple(first(me.name), first(other.name)) : first(me.name);

  return (
    <PageTransition>
      <Screen className="pb-24">
        <header className="mb-7 px-2 pt-8">
          {/* Two presences, one space: the pair of lights is the product's mark.
            They come together as the screen opens, then breathe, slowly. */}
          <div aria-hidden="true" dir="ltr" className="couple-mark mb-5 flex -space-x-3 rtl:justify-end">
            <PartnerAvatar person={me} size={me.photo ? 4 : 2.5} />
            {other && (
              <PartnerAvatar person={other} size={other.photo ? 4 : 2.5} className={other.photo ? undefined : 'mix-blend-multiply dark:mix-blend-screen'} />
            )}
          </div>
          <h1 className="text-[2.375rem] leading-[1.08] font-bold tracking-tight text-balance text-ink">{title}</h1>
          <div className="mt-4 min-h-0">
            <DayLine day={day} />
          </div>
        </header>
        <TodayTasks
          tasks={tasks}
          tomorrow={tomorrowTasks}
          me={me}
          partner={other}
          today={today}
          initialView={readTodayView(jar.get(TODAY_VIEW_COOKIE)?.value)}
        />
      </Screen>
    </PageTransition>
  );
}
