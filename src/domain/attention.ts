/**
 * ATTENTION RULES — שנינו. BUSINESS_RULES.md §8.
 *
 * Exactly one rule, and its tone is the whole point. The foundation's
 * attention machinery is built for an office ("missing invoice", "late
 * payment"), where being chased is the correct experience. Inside a couple it
 * is not: a product that tells two people they are failing at their
 * relationship is worse than a product that says nothing.
 *
 * So the rule finds days nobody closed, calls them open rather than missed,
 * offers them for as long as filling one in is still meaningful (14 days), and
 * resolves itself the moment either partner closes the day. There is no
 * severity above 'info', and there are no manual follow-ups at all
 * (src/domain/follow-ups.ts) — there is nobody to assign one to.
 */

import { can } from '@/core/access/can';
import { addDays, compareCalendarDates, fromDbDate, toDbDate, todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { defineAttentionRule, type AttentionRule } from '@/core/follow-ups/attention';
import { formatCalendarDate } from '@/core/dates/calendar-date';

import { copy } from './copy';
import { coupleIds, isInCouple } from './partners';

/** How far back it is still worth offering to fill a day in. */
const WINDOW_DAYS = 14;

const unclosedDays = defineAttentionRule({
  key: 'unclosed_days',
  label: 'ימים שלא נסגרו',
  description: 'ימים מהשבועיים האחרונים שאף אחד מכם לא סגר. אפשר להשלים, ואפשר להשאיר.',
  severity: 'info',
  list: async (client, actor, { limit }) => {
    // The summaries permission is the one that says "this person may look at
    // past days at all".
    if (!can(actor, 'summaries.read')) return { items: [], total: 0 };

    // And the link is what says WHICH days. Without this the rule would read
    // every DayEntry row on the deployment, so a signed-in account outside the
    // couple would be told, day by day, which evenings these two closed — the
    // dates alone, but the dates alone are still theirs.
    const link = await coupleIds(client);
    if (!isInCouple(link, actor.id) || !link) return { items: [], total: 0 };

    const today = todayIn();
    // Yesterday is excluded: a day that only ended a few hours ago is not yet
    // something to be reminded about.
    const newest = addDays(today, -2);
    const oldest = addDays(today, -(WINDOW_DAYS + 1));

    const rows = await client.dayEntry.findMany({
      where: {
        partnerId: { in: [link.partnerAId, link.partnerBId] },
        entryDate: { gte: toDbDate(oldest), lte: toDbDate(newest) },
      },
      select: { entryDate: true },
    });
    const closed = new Set(rows.map((row) => fromDbDate(row.entryDate)));

    const missing: CalendarDate[] = [];
    for (let date = newest; compareCalendarDates(date, oldest) >= 0; date = addDays(date, -1)) {
      if (!closed.has(date)) missing.push(date);
    }

    return {
      total: missing.length,
      items: missing.slice(0, limit).map((date) => ({
        id: `unclosed-${date}`,
        title: copy.attention.unclosedDay(formatCalendarDate(date)),
        detail: copy.attention.unclosedDayHint,
        href: `/review?date=${date}`,
      })),
    };
  },
});

export const attentionRules: AttentionRule[] = [unclosedDays];
