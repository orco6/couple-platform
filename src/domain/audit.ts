/**
 * AUDIT VOCABULARY — שנינו.
 *
 * R-DAY-30 is the rule that shapes this file: **ratings and notes never enter
 * the audit log.** The OWNER can read the log, so writing a rating into it
 * would defeat the reveal rule permanently and retroactively — worse than not
 * having the rule at all, because the partners would believe they were
 * protected.
 *
 * So a day closing records the DATE and nothing else, and an amendment records
 * markers (`ratingsChanged`, `noteChanged`) rather than values. That is enough
 * to answer "was this day closed, and was it changed afterwards", which is the
 * only question the log needs to answer here.
 *
 * Reads are not audited at all (BUSINESS_BRIEF §22): logging who looked at
 * whose note would be surveillance inside a relationship, and the log itself is
 * readable by one of the two people.
 */

import { defineAuditVocabulary } from '@/core/audit/vocabulary';

export const domainAuditVocabulary = defineAuditVocabulary({
  entityTypes: {
    daily_task: 'משימה',
    day_entry: 'סגירת יום',
    task_rating: 'דירוג משימה',
    partnership: 'הקישור בין הפרטנרים',
  },
  actions: {
    'task.created': { label: 'משימה נוספה' },
    'task.updated': { label: 'משימה עודכנה' },
    'task.completed': { label: 'משימה נסגרה' },
    'task.reopened': { label: 'משימה נפתחה מחדש' },
    'task.archived': { label: 'משימה הועברה לארכיון', requiresReason: true },
    'task.restored': { label: 'משימה הוחזרה לרשימה', requiresReason: true },
    'task_rating.given': { label: 'משימה דורגה' },
    'task_rating.changed': { label: 'דירוג משימה שונה' },
    'day_entry.submitted': { label: 'היום נסגר' },
    'day_entry.amended': { label: 'סגירת היום שונתה' },
    'partnership.linked': { label: 'הפרטנר השני קושר' },
  },
  fields: {
    // Task fields are ordinary domestic detail — safe to read in the log.
    title: { label: 'משימה' },
    forWhom: {
      label: 'בשביל מי',
      format: 'enum',
      values: { ME: 'עליי', PARTNER: 'על הפרטנר', BOTH: 'שנינו' },
    },
    taskDate: { label: 'ליום', format: 'calendar_date' },
    dueTime: { label: 'עד שעה', format: 'instant' },
    note: { label: 'פתק' },
    ownerId: { label: 'באחריות', format: 'reference' },
    // Safe in the log: how the dishes went is ordinary feedback about a chore,
    // not the private self-assessment the daily entry holds.
    ratingValue: { label: 'דירוג' },

    // Day-entry fields. `entryDate` is the only value ever recorded; the two
    // markers below exist so an amendment is visible without its content.
    entryDate: { label: 'היום', format: 'calendar_date' },
    ratingsChanged: { label: 'הדירוגים שונו', format: 'boolean' },
    noteChanged: { label: 'הפתק שונה', format: 'boolean' },

    partnerName: { label: 'הפרטנר' },
  },
});
