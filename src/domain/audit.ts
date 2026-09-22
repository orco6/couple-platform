/**
 * AUDIT VOCABULARY FOR THIS BUSINESS — replace per project.
 *
 * Every action a domain service records must be listed here. Mark actions that
 * override something the system decided (reopen, price change on finished
 * work, restore) as `requiresReason` — the recorder refuses to write them
 * without one.
 */

import { defineAuditVocabulary } from '@/core/audit/vocabulary';

export const domainAuditVocabulary = defineAuditVocabulary({
  entityTypes: {
    customer: 'לקוח',
    task: 'משימה',
    note: 'הערה',
  },
  actions: {
    'customer.created': { label: 'לקוח נוסף' },
    'customer.updated': { label: 'לקוח עודכן' },
    'customer.archived': { label: 'לקוח הועבר לארכיון' },
    'customer.restored': { label: 'לקוח שוחזר מהארכיון', requiresReason: true },
    'task.created': { label: 'משימה נוספה' },
    'task.updated': { label: 'משימה עודכנה' },
    'task.status_changed': { label: 'סטטוס משימה שונה' },
    'task.reopened': { label: 'משימה נפתחה מחדש', requiresReason: true },
    'task.archived': { label: 'משימה הועברה לארכיון' },
    'task.restored': { label: 'משימה שוחזרה מהארכיון', requiresReason: true },
    'note.created': { label: 'הערה נוספה' },
    'note.deleted': { label: 'הערה נמחקה' },
  },
  fields: {
    title: { label: 'כותרת' },
    phone: { label: 'טלפון' },
    city: { label: 'עיר' },
    ownerId: { label: 'אחראי', format: 'reference' },
    assigneeId: { label: 'מבצע', format: 'reference' },
    priceAgorot: { label: 'מחיר לפני מע״מ', format: 'money' },
    vatRateBps: { label: 'שיעור מע״מ', format: 'rate' },
    completedOn: { label: 'תאריך ביצוע', format: 'calendar_date' },
    description: { label: 'תיאור' },
    body: { label: 'תוכן' },
    archiveReason: { label: 'סיבת העברה לארכיון' },
  },
});
