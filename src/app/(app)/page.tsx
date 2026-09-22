import Link from 'next/link';

import { requireActorPage } from '@/core/auth/page-guards';
import { formatCalendarDate, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { getDay } from '@/domain/day-entries/day-entries';
import { copy } from '@/domain/copy';
import { partnersOf } from '@/domain/partners';
import { listTasksForDay } from '@/domain/tasks/tasks';

import { TaskList } from './(couple)/_components/TaskList';

export const metadata = { title: copy.nav.today };

/**
 * HOME — the shared list.
 *
 * SCREEN_BUILDING_PLAYBOOK, the sixteen questions:
 *  1 Primary task: "לסמן מה נסגר מהרשימה שלנו".
 *  2 What matters most: the open tasks. They are the first thing on the phone,
 *    above everything else, with no figures competing.
 *  3 Secondary: who each task is for, its time hint, and whether the day can be
 *    closed yet.
 *  4 Actions: one primary — adding a task. Completing is not a button with a
 *    label, it is the row's mark. Archiving is destructive and lives inside the
 *    edit sheet, never next to the primary.
 *  5 Shape: a list, not a table. One kind of row, two or three facts each; a
 *    table would imply columns worth comparing.
 *  6 Phone: this screen IS the phone screen. Ruled rows rather than cards so
 *    six tasks fit without scrolling, two thumb-sized targets per row, and the
 *    closed group sinks to the bottom.
 *  7 Loading: the (app) loading skeleton.
 *  8 Empty: never-had-data ("אין משימות ליום הזה" + how to add); all-closed is
 *    a different, warmer state and is not an empty state at all.
 *  9 Errors: a failed toggle snaps the row back and says so (TaskList).
 * 10 Unauthorized: the page guard; there is no per-row scope (R-TASK-01).
 * 11 RTL: logical properties throughout; the mark leads on the right.
 * 12 LTR content: the time hint ("עד 19:00") is dir="ltr".
 * 13 Audit: every write is audited in the service.
 * 14 Confirmation: only archiving, which also collects its reason.
 * 15 Avoided tells: no stat cards, no "ברוכים הבאים", no progress ring, no
 *    chart. The home screen of a to-do product is the list.
 * 16 Specific to this product: the day is the recurring object, and the one
 *    thing the home screen adds beyond the list is whether the two of them can
 *    close it yet — which is the product, not a metric.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const today = todayIn();

  const [{ me, other }, tasks, day] = await Promise.all([
    partnersOf(db, actor),
    listTasksForDay(db, actor, today),
    getDay(db, actor, today),
  ]);

  const open = tasks.filter((task) => task.state === 'OPEN');
  const closed = tasks.filter((task) => task.state === 'COMPLETED');
  const allClosed = open.length === 0 && tasks.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={<bdi dir="ltr">{formatCalendarDate(today)}</bdi>}
        title={copy.tasks.pageTitle}
        description={allClosed ? copy.tasks.allClosedWhy : copy.tasks.openCount(open.length)}
      />

      {/* The day's one shared question, stated once and quietly. It is a link,
          not a banner: nothing here is urgent. */}
      <ReviewStrip
        canClose={day.canClose}
        mine={day.mine !== null}
        partnerSubmitted={day.partnerSubmitted}
        revealed={day.revealed}
        reviewTime={day.reviewTime}
        partnerName={other?.name ?? copy.common.partnerFallback}
      />

      <Section title={allClosed ? copy.tasks.allClosed : undefined}>
        <TaskList tasks={open} me={me} partner={other} today={today} />
      </Section>

      {closed.length > 0 && (
        <Section title={copy.tasks.closedToday}>
          <TaskList tasks={closed} me={me} partner={other} today={today} showAdd={false} />
        </Section>
      )}
    </>
  );
}

function ReviewStrip({
  canClose,
  mine,
  partnerSubmitted,
  revealed,
  reviewTime,
  partnerName,
}: {
  canClose: boolean;
  mine: boolean;
  partnerSubmitted: boolean;
  revealed: boolean;
  reviewTime: string;
  partnerName: string;
}) {
  const message = revealed
    ? copy.day.revealedTitle
    : mine
      ? copy.day.waitingTitle(partnerName)
      : canClose
        ? partnerSubmitted
          ? copy.day.partnerClosedAlready(partnerName)
          : copy.day.pageTitle
        : copy.day.notOpenYetWhy(reviewTime);

  return (
    <div className="mb-6 border-y border-rule-faint py-3">
      {canClose || mine ? (
        <Link
          href="/review"
          className="flex items-center justify-between gap-3 text-body font-medium text-accent-text hover:underline"
        >
          <span>{message}</span>
          <span aria-hidden="true">←</span>
        </Link>
      ) : (
        <p className="text-body text-ink-subtle">{message}</p>
      )}
    </div>
  );
}
