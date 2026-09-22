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
 * day only one partner closed (so the waiting state is visible), a day neither
 * closed (so the attention rule has something to find), and today left open so
 * the review screen has work to do.
 */

import type { DomainSeeder } from '@/core/dev-data/types';
import { addDays, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { localToInstant, type LocalTime } from '@/core/dates/local-time';

import { submitDayEntry } from './day-entries/day-entries';
import { linkPartner } from './partners';
import { createTask, transitionTask } from './tasks/tasks';

/** A plausible submission instant for a past day: that evening, 22:10. */
function eveningOf(date: CalendarDate): Date {
  return localToInstant(date, '22:10' as LocalTime) ?? new Date();
}

export const seedDomainData: DomainSeeder = async (db, users) => {
  const owner = users.byRole.OWNER?.[0] ?? users.top;
  const partner = users.byRole.PARTNER?.[0];
  if (!partner) return;

  // The couple itself. Everything below depends on the link existing, because
  // the reveal rule pairs rows by it.
  await linkPartner(db, owner, { partnerId: partner.id });

  const today = todayIn();
  const day = (offset: number) => addDays(today, offset);

  /* ── The shared list ──────────────────────────────────────────────────── */

  const openToday = [
    { title: 'לאסוף את הכביסה מהמכבסה', forWhom: 'ME' as const, dueTime: '19:00' as LocalTime, note: null },
    {
      title: 'להזמין מקום לשבת',
      forWhom: 'BOTH' as const,
      dueTime: null,
      note: 'דיברנו על זה שלושה שבועות.\nאם אין מקום, נשמח גם במשהו קטן בשכונה.',
    },
    { title: 'לשלם ארנונה', forWhom: 'PARTNER' as const, dueTime: '23:59' as LocalTime, note: null },
    // Nothing but a title: the row must still read well with no metadata.
    { title: 'לקנות קפה', forWhom: 'ME' as const, dueTime: null, note: null },
    {
      // The longest title the schema allows (200 characters), so the list and
      // the phone row are judged against the worst case, not a short label.
      title:
        'להתקשר למוסך בעניין הרעש מהגלגל הקדמי הימני ולשאול אם צריך להחליף את המסבים או רק להדק, ולבדוק כמה זמן זה לוקח ואם אפשר להשאיר את הרכב בבוקר ולאסוף אותו אחרי העבודה באותו יום עצמו',
      forWhom: 'BOTH' as const,
      dueTime: null,
      note: null,
    },
  ];

  for (const task of openToday) {
    await createTask(db, owner, {
      title: task.title,
      forWhom: task.forWhom,
      taskDate: day(0),
      dueTime: task.dueTime,
      note: task.note,
    });
  }

  // One closed by each partner today, so the completion split is not 100/0.
  const closedByPartner = await createTask(db, partner, {
    title: 'להתקשר לאמא',
    forWhom: 'PARTNER',
    taskDate: day(0),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, partner, { id: closedByPartner.id, version: closedByPartner.version, to: 'COMPLETED' });

  const closedByOwner = await createTask(db, owner, {
    title: 'להוציא את האופניים מהמחסן',
    forWhom: 'ME',
    taskDate: day(0),
    dueTime: null,
    note: null,
  });
  await transitionTask(db, owner, { id: closedByOwner.id, version: closedByOwner.version, to: 'COMPLETED' });

  // An archived task, with the reason the archive screen shows.
  const archived = await createTask(db, owner, {
    title: 'לבדוק מחירים לחופשה באוגוסט',
    forWhom: 'BOTH',
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

  // Past days, so the weekly and monthly summaries have a real shape.
  for (let offset = -20; offset <= -1; offset += 1) {
    const count = (Math.abs(offset) % 3) + 1;
    for (let index = 0; index < count; index += 1) {
      const task = await createTask(db, index % 2 === 0 ? owner : partner, {
        title: ['קניות לשבוע', 'לתלות את הכיבוס', 'לתאם עם השכנים', 'להחזיר ספרים לספרייה'][(index + count) % 4]!,
        forWhom: (['ME', 'PARTNER', 'BOTH'] as const)[(index + count) % 3]!,
        taskDate: day(offset),
        dueTime: null,
        note: null,
      });
      // Most get done, some do not — a 100% list is not a real list.
      if ((index + Math.abs(offset)) % 4 !== 0) {
        await transitionTask(db, index % 2 === 0 ? owner : partner, {
          id: task.id,
          version: task.version,
          to: 'COMPLETED',
        });
      }
    }
  }

  /* ── Closing the days ─────────────────────────────────────────────────── */

  // execution / respect per day, both partners. Varied on purpose: a product
  // whose fixtures are all fours and fives looks like it cannot render a bad
  // day, and the bad days are the ones that matter.
  const closings: Array<{ offset: number; owner?: [number, number]; partner?: [number, number]; note?: string }> = [
    { offset: -20, owner: [3, 3], partner: [3, 4] },
    { offset: -19, owner: [4, 4], partner: [4, 4] },
    { offset: -18, owner: [2, 2], partner: [2, 3], note: 'יום ארוך. נדבר על זה מחר.' },
    { offset: -17, owner: [4, 5], partner: [5, 5] },
    { offset: -16, owner: [5, 5], partner: [5, 5] },
    { offset: -15, owner: [3, 4], partner: [4, 4] },
    { offset: -14, owner: [4, 4], partner: [3, 4] },
    { offset: -13, owner: [1, 2], partner: [2, 2], note: 'לא יום טוב. שנינו היינו עייפים והכל יצא חד.' },
    { offset: -12, owner: [3, 3], partner: [3, 3] },
    { offset: -11, owner: [4, 4], partner: [4, 5] },
    { offset: -10, owner: [5, 5], partner: [4, 5] },
    { offset: -9, owner: [4, 3], partner: [4, 4] },
    { offset: -8, owner: [3, 4], partner: [3, 3] },
    { offset: -7, owner: [4, 4], partner: [5, 4] },
    { offset: -6, owner: [5, 5], partner: [5, 5], note: 'יצאנו לסיבוב בלי לתכנן וחזרנו אחרי חצות.\nכזה שכדאי לזכור.' },
    // Nobody closed this one: the attention rule has to find something.
    { offset: -5 },
    { offset: -4, owner: [4, 4], partner: [4, 4] },
    // Only the partner closed it, so the "waiting for you" state is visible.
    { offset: -3, partner: [4, 5] },
    { offset: -2, owner: [4, 5], partner: [5, 5] },
    { offset: -1, owner: [3, 4], partner: [4, 4] },
    // Today is left open on purpose — the review screen needs work to do.
  ];

  for (const closing of closings) {
    const date = day(closing.offset);
    const now = eveningOf(date);

    if (closing.owner) {
      await submitDayEntry(
        db,
        owner,
        {
          entryDate: date,
          executionRating: closing.owner[0],
          respectRating: closing.owner[1],
          note: closing.note ?? null,
        },
        now,
      );
    }
    if (closing.partner) {
      await submitDayEntry(
        db,
        partner,
        { entryDate: date, executionRating: closing.partner[0], respectRating: closing.partner[1], note: null },
        now,
      );
    }
  }
};
