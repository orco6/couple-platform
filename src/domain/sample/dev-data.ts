/**
 * SAMPLE DOMAIN — realistic development/QA data: a small service business a
 * few months into using the app. Enough rows to exercise lists, filters,
 * attention rules and a closed month. Deterministic (seeded PRNG, dates
 * relative to today).
 */

import { addDays, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { addMonths, currentPeriod, periodBounds } from '@/core/dates/period';
import type { DomainSeeder } from '@/core/dev-data/types';
import { createFollowUp } from '@/core/follow-ups/follow-ups';
import { createCustomer } from './customers';
import { sampleFollowUpTargets } from './follow-up-targets';
import { createNote } from './notes';
import { closeRevenueMonth } from './revenue';
import { createTask, transitionTask } from './tasks';

function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMER_NAMES = [
  'מאפיית הגליל', 'סטודיו אור', 'משפחת אברהם', 'גן ילדים הדר', 'מוסך השרון', 'קפה נחלת',
  'עו״ד ליבנה ושות׳', 'מרפאת שיניים גבעון', 'חנות הפרחים של רינה', 'בית כנסת אוהל משה', 'Tech Nova Ltd',
  'משרד רו״ח זיו', 'פיצה רומא', 'ספריית השכונה', 'אולם אירועים גלים', 'מספרת סטייל',
];
const CITIES = ['תל אביב-יפו', 'חיפה', 'ירושלים', 'באר שבע', 'רעננה', 'מודיעין', null];
const TASK_TITLES = ['התקנת מערכת', 'ביקור תחזוקה', 'בדיקה שנתית', 'החלפת רכיב', 'ייעוץ טכני', 'הדרכת צוות', 'תיקון תקלה'];

export const seedSampleData: DomainSeeder = async (db, users) => {
  const random = prng(20260916);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const today = todayIn();
  const manager = users.byRole.MANAGER![0];
  const [staffA, staffB] = users.byRole.STAFF!;
  const owners = [staffA, staffB, manager];

  for (const [index, name] of CUSTOMER_NAMES.entries()) {
    const owner = owners[index % owners.length]!;
    const hasContact = index % 5 !== 3;
    const customer = await createCustomer(db, manager, {
      name,
      phone: hasContact ? `05${index % 9}-${String(1000000 + index * 7919).slice(0, 7)}` : null,
      email: hasContact && index % 2 === 0 ? `contact${index}@example.co.il` : null,
      city: pick(CITIES),
      ownerId: owner.id,
    });

    if (index % 3 === 0) {
      await createNote(db, manager, customer.id, { body: 'לקוח ותיק. מעדיף תיאום טלפוני מראש.' });
    }

    const taskCount = 2 + Math.floor(random() * 4);
    for (let t = 0; t < taskCount; t += 1) {
      const dueOffset = Math.floor(random() * 50) - 30;
      const task = await createTask(db, manager, {
        customerId: customer.id,
        title: pick(TASK_TITLES),
        description: t === 0 ? 'פרטים נוספים נמצאים בהערות הלקוח.' : null,
        dueDate: addDays(today, dueOffset),
        assigneeId: owner.id,
        priceAgorot: random() < 0.85 ? (250 + Math.floor(random() * 30) * 50) * 100 : null,
      });

      const roll = random();
      if (roll < 0.45 && dueOffset < 0) {
        const completedOn = addDays(today, Math.max(dueOffset, -95)) as CalendarDate;
        await transitionTask(db, manager, task.id, { version: task.version, to: 'DONE', completedOn });
      } else if (roll < 0.6) {
        await transitionTask(db, manager, task.id, { version: task.version, to: 'IN_PROGRESS' });
      } else if (roll < 0.66) {
        await transitionTask(db, manager, task.id, { version: task.version, to: 'CANCELLED' });
      }
    }

    if (index === 1 || index === 6) {
      await createFollowUp(
        db,
        manager,
        { entityType: 'customer', entityId: customer.id, kind: 'payment_delayed', note: 'התשלום על הביקור האחרון טרם התקבל.', dueDate: addDays(today, 3), assigneeId: owner.id },
        sampleFollowUpTargets,
      );
    }
  }

  // Content at real-world lengths, so design is judged against what businesses type, not
  // "Test User / Task 1": a long legal name, a long title and description, a multi-line note,
  // missing contact details, an overdue job. Deterministic (no random draws), appended after
  // the loop so the seeded sequence above is unchanged.
  const longCustomer = await createCustomer(db, manager, {
    name: 'מרכז רפואי שערי צדק — מחלקת רכש, ציוד רפואי ותחזוקת מבנים',
    phone: '02-6555111',
    email: 'accounts.payable@shaarei-tzedek-medical.org.il',
    city: 'ירושלים',
    ownerId: staffA.id,
  });
  await createNote(db, manager, longCustomer.id, {
    body: [
      'איש קשר: יעל (רכש), טלפון ישיר 02-6555187.',
      'החשבוניות נשלחות רק לכתובת הדוא״ל של הנהלת החשבונות, לא לאיש הקשר.',
      'כניסה לחניון דרך שער 3; יש לתאם אישור כניסה יום מראש.',
    ].join('\n'),
  });
  await createTask(db, manager, {
    customerId: longCustomer.id,
    title: 'החלפת מערכת בקרת הכניסה בקומות 2–4 כולל חיווט מחדש ותיאום עם קבלן המיזוג',
    description: [
      'העבודה מתבצעת בשני שלבים כדי לא להשבית את המחלקה.',
      'שלב א׳: קומה 2 בלבד, אחרי 18:00.',
      'שלב ב׳: קומות 3–4, בתיאום מול מנהל האחזקה.',
    ].join('\n'),
    dueDate: addDays(today, -12),
    assigneeId: staffA.id,
    priceAgorot: 1_284_050,
  });
  await createCustomer(db, manager, {
    name: 'אבו-ג׳אבר עבודות חשמל ואינסטלציה בע״מ',
    phone: null,
    email: null,
    city: null,
    ownerId: staffB.id,
  });

  // Two months ago is closed, so the snapshot path is visible in development.
  const closed = addMonths(currentPeriod(), -2);
  if (periodBounds(closed).endExclusive <= today) await closeRevenueMonth(db, users.top, closed);
};
