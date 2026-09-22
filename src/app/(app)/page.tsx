import { requireActorPage } from '@/core/auth/page-guards';
import { formatCalendarDate, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { copy } from '@/domain/copy';
import { getDay } from '@/domain/day-entries/day-entries';
import { partnersOf } from '@/domain/partners';
import { listTasksForDay } from '@/domain/tasks/tasks';

import { DayHeroCard } from './(couple)/_components/DayHeroCard';
import { Screen } from './(couple)/_components/Screen';
import { TaskList } from './(couple)/_components/TaskList';

export const metadata = { title: copy.nav.today };

/**
 * TODAY — SCREEN_BUILDING_PLAYBOOK, the sixteen questions.
 *
 *  1 Primary task: "לסמן מה נסגר, ולדרג מה שהפרטנר סגר".
 *  2 What matters most: whatever is this person's turn. Tasks waiting for MY
 *    rating come first, because someone is waiting on the other end and it
 *    costs one tap; then the open list.
 *  3 Secondary: whose task it is, its time hint, and where the day stands.
 *  4 Actions: one primary — adding a task. Completing is the card's mark;
 *    rating is five stars inline. Archiving lives inside the edit sheet.
 *  5 Shape: cards, one per task. Not a table (nothing to compare in columns)
 *    and not ruled rows (each task can carry its own action area, which a row
 *    cannot hold without looking broken).
 *  6 Phone: this IS the phone screen. Two thumb-sized targets per card, the
 *    rating stars at 40px each, and the day card at the top where the thumb
 *    does not reach — it is read, not tapped.
 *  7 Loading: the (app) skeleton.
 *  8 Empty: never-had-data ("אין משימות ליום הזה" + how to add). All-closed is
 *    a warmer state, not an empty one.
 *  9 Errors: an optimistic card snaps back and says so (TaskList).
 * 10 Unauthorized: the page guard. There is no per-row scope (R-TASK-01), and
 *    the rate action is absent unless the server would accept it.
 * 11 RTL: logical properties throughout; the star row is LTR, like every
 *    magnitude axis in this product.
 * 12 LTR content: the time hint and the rating number.
 * 13 Audit: every write is audited in the service.
 * 14 Confirmation: only archiving, which also collects its reason.
 * 15 Avoided tells: no stat cards, no progress ring, no "ברוכים הבאים", no
 *    chart. One gradient surface, and it is the product's subject.
 * 16 Specific to this product: the day as a single object at the top, and a
 *    section that exists only because somebody is waiting for you.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [{ me, other }, tasks, day] = await Promise.all([
    partnersOf(db, actor),
    listTasksForDay(db, actor, today),
    getDay(db, actor, today),
  ]);

  const toRate = tasks.filter((task) => task.permissions.rate && task.rating === null);
  const open = tasks.filter((task) => task.state === 'OPEN');
  const closed = tasks.filter((task) => task.state === 'COMPLETED' && !toRate.includes(task));
  const allClosed = open.length === 0 && tasks.length > 0;

  return (
    <Screen>
      <PageHeader
        title={copy.tasks.pageTitle}
        description={allClosed ? copy.tasks.allClosedWhy : copy.tasks.openCount(open.length)}
      />

      <div className="mb-7">
        <DayHeroCard day={day} dateLabel={formatCalendarDate(today)} />
      </div>

      {/* First, because it is the other person's turn and it costs one tap. */}
      {toRate.length > 0 && (
        <Section title={copy.taskRating.sectionTitle}>
          <TaskList tasks={toRate} me={me} partner={other} today={today} showAdd={false} />
        </Section>
      )}

      <Section title={allClosed ? copy.tasks.allClosed : undefined}>
        <TaskList tasks={open} me={me} partner={other} today={today} />
      </Section>

      {closed.length > 0 && (
        <Section title={copy.tasks.closedToday}>
          <TaskList tasks={closed} me={me} partner={other} today={today} showAdd={false} />
        </Section>
      )}
    </Screen>
  );
}
