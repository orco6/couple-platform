/**
 * DEVELOPMENT / QA DATA — שנינו.
 *
 * Everything is created THROUGH the services, so fixtures obey the same
 * validation, lifecycle, reveal and audit rules as real use — a seeder that
 * writes rows directly can produce states the product cannot reach, and then
 * the screenshots are of a product that does not exist.
 *
 * The data is deliberately awkward, because DESIGN_REVIEW.md judges screens
 * against realistic content: the longest title the schema allows, a task with
 * nothing but a title, a multi-line note, an archived task with its reason, a
 * completed task still waiting for the other partner's rating, a task rated 5,
 * a day only one partner closed, a day neither closed, and today left open so
 * both the list and the review screen have work to do.
 */

import type { DomainSeeder } from '@/core/dev-data/types';
import { addDays, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { localToInstant, type LocalTime } from '@/core/dates/local-time';

import { submitDayEntry } from './day-entries/day-entries';
import { linkPartner } from './partners';
import { rateTask } from './tasks/task-ratings';
import { createTask, transitionTask } from './tasks/tasks';

/** A plausible submission instant for a past day: that evening, 22:10. */
function eveningOf(date: CalendarDate): Date {
  return localToInstant(date, '22:10' as LocalTime) ?? new Date();
}

export const seedDomainData: DomainSeeder = async (db, users) => {
  const owner = users.byRole.OWNER?.[0] ?? users.top;
  const partner = users.byRole.PARTNER?.[0];
  if (!partner) return;

  // The couple itself. Everything below depends on the link existing: the
  // reveal rule pairs day entries by it, and a task's owner must be one of the
  // two people in it.
  await linkPartner(db, owner, { partnerId: partner.id });

  const today = todayIn();
  const day = (offset: number) => addDays(today, offset);

  /* ── Today's list ─────────────────────────────────────────────────────── */

  const openToday: Array<{ title: string; ownerId: string; dueTime: LocalTime | null; note: string | null }> = [
    { title: 'לאסוף את הכביסה מהמכבסה', ownerId: owner.id, dueTime: '19:00' as LocalTime, note: null },
    {
      title: 'להזמין מקום לשבת',
      ownerId: partner.id,
      dueTime: null,
      note: 'דיברנו על זה שלושה שבועות.\nאם אין מקום, נשמח גם במשהו קטן בשכונה.',
    },
    { title: 'לשלם ארנונה', ownerId: partner.id, dueTime: '23:59' as LocalTime, note: null },
    // Nothing but a title: the row must still read well with no metadata.
    { title: 'לקנות קפה', ownerId: owner.id, dueTime: null, note: null },
    {
      // The longest title the schema allows (200 characters), so the list and
      // the phone row are judged against the worst case, not a short label.
      title:
        'להתקשר למוסך בעניין הרעש מהגלגל הקדמי הימני ולשאול אם צריך להחליף את המסבים או רק להדק, ולבדוק כמה זמן זה לוקח ואם אפשר להשאיר את הרכב בבוקר ולאסוף אותו אחרי העבודה באותו יום עצמו',
      ownerId: owner.id,
      dueTime: null,
      note: null,
    },
  ];

  for (const task of openToday) {
    await createTask(db, owner, {
      title: task.title,
      ownerId: task.ownerId,
      taskDate: day(0),
      dueTime: task.dueTime,
      note: task.note,
    });
  }

  // Completed and already rated by the other partner — the settled state.
  const ratedTask = await createTask(db, owner, {
    title: 'להתקשר לאמא',
    ownerId: partner.id,
    taskDate: day(0),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, partner, { id: ratedTask.id, version: ratedTask.version, to: 'COMPLETED' });
  await rateTask(db, owner, { taskId: ratedTask.id, value: 5 });

  // Completed and NOT rated — this is what "ממתין לדירוג" has to render, and
  // the owner sees it as waiting on the other person, not as a chase.
  const awaitingTask = await createTask(db, owner, {
    title: 'להוציא את האופניים מהמחסן',
    ownerId: owner.id,
    taskDate: day(0),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, owner, { id: awaitingTask.id, version: awaitingTask.version, to: 'COMPLETED' });

  // One the *partner* finished, waiting for the owner's rating: the prompt the
  // signature interaction is launched from.
  const toRateTask = await createTask(db, owner, {
    title: 'לתלות את המדף בסלון',
    ownerId: partner.id,
    taskDate: day(0),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, partner, { id: toRateTask.id, version: toRateTask.version, to: 'COMPLETED' });

  // An archived task, with the reason the archive screen shows.
  const archived = await createTask(db, owner, {
    title: 'לבדוק מחירים לחופשה באוגוסט',
    ownerId: owner.id,
    taskDate: day(-6),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, owner, {
    id: archived.id,
    version: archived.version,
    to: 'ARCHIVED',
    reason: 'החלטנו לדחות את החופשה לשנה הבאה.',
  });

  /* ── Past days, so the week and the month have a real shape ──────────── */

  const pastTitles = ['קניות לשבוע', 'לתלות את הכיבוס', 'לתאם עם השכנים', 'להחזיר ספרים לספרייה', 'לקבוע רופא שיניים'];

  for (let offset = -27; offset <= -1; offset += 1) {
    const count = (Math.abs(offset) % 3) + 1;
    for (let index = 0; index < count; index += 1) {
      const ownedByOwner = (index + Math.abs(offset)) % 2 === 0;
      const task = await createTask(db, owner, {
        title: pastTitles[(index + Math.abs(offset)) % pastTitles.length]!,
        ownerId: ownedByOwner ? owner.id : partner.id,
        taskDate: day(offset),
        dueTime: null,
        note: null,
      });

      // Most get done, some do not — a 100% list is not a real list.
      if ((index + Math.abs(offset)) % 4 === 0) continue;

      await transitionTask(db, ownedByOwner ? owner : partner, {
        id: task.id,
        version: task.version,
        to: 'COMPLETED',
      });

      // Most completed tasks get rated by the other partner; some are left
      // waiting, which is what drives the weekly insight.
      if ((index + Math.abs(offset)) % 5 === 0) continue;
      const rater = ownedByOwner ? partner : owner;
      await rateTask(db, rater, { taskId: task.id, value: 3 + ((Math.abs(offset) + index) % 3) });
    }
  }

  /* ── Closing the days ─────────────────────────────────────────────────── */

  // Mutual respect per day, both partners. Varied on purpose: a product whose
  // fixtures are all fours and fives looks like it cannot render a bad day, and
  // the bad days are the ones that matter.
  const closings: Array<{ offset: number; owner?: number; partner?: number; note?: string }> = [
    { offset: -27, owner: 3, partner: 4 },
    { offset: -26, owner: 4, partner: 4 },
    { offset: -25, owner: 2, partner: 3, note: 'יום ארוך. נדבר על זה מחר.' },
    { offset: -24, owner: 5, partner: 5 },
    { offset: -23, owner: 4, partner: 4 },
    { offset: -22, owner: 3, partner: 3 },
    { offset: -21, owner: 4, partner: 5 },
    { offset: -20, owner: 3, partner: 3 },
    { offset: -19, owner: 4, partner: 4 },
    { offset: -18, owner: 2, partner: 2, note: 'לא יום טוב. שנינו היינו עייפים והכל יצא חד.' },
    { offset: -17, owner: 4, partner: 5 },
    { offset: -16, owner: 5, partner: 5 },
    { offset: -15, owner: 4, partner: 4 },
    { offset: -14, owner: 3, partner: 4 },
    { offset: -13, owner: 4, partner: 4 },
    { offset: -12, owner: 5, partner: 4 },
    { offset: -11, owner: 4, partner: 4 },
    { offset: -10, owner: 3, partner: 3 },
    { offset: -9, owner: 4, partner: 4 },
    { offset: -8, owner: 5, partner: 5 },
    { offset: -7, owner: 4, partner: 4 },
    { offset: -6, owner: 5, partner: 5, note: 'יצאנו לסיבוב בלי לתכנן וחזרנו אחרי חצות.\nכזה שכדאי לזכור.' },
    // Nobody closed this one: the attention rule has to find something.
    { offset: -5 },
    { offset: -4, owner: 4, partner: 4 },
    // Only the partner closed it, so the "waiting for you" state is visible.
    { offset: -3, partner: 4 },
    { offset: -2, owner: 4, partner: 5 },
    { offset: -1, owner: 4, partner: 4 },
    // Today is left open on purpose — the review screen needs work to do.
  ];

  for (const closing of closings) {
    const date = day(closing.offset);
    const now = eveningOf(date);

    if (closing.owner !== undefined) {
      await submitDayEntry(db, owner, { entryDate: date, respectRating: closing.owner, note: closing.note ?? null }, now);
    }
    if (closing.partner !== undefined) {
      await submitDayEntry(db, partner, { entryDate: date, respectRating: closing.partner, note: null }, now);
    }
  }
};
