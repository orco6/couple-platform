/**
 * AUDIT VOCABULARY FOR THIS BUSINESS — replace per project.
 *
 * Register every action your services record, e.g.
 *   entityTypes: { order: 'הזמנה' },
 *   actions: { 'order.created': { label: 'הזמנה נוספה' }, 'order.restored': { label: 'הזמנה שוחזרה', requiresReason: true } },
 *   fields: { fullName: { label: 'שם' }, balanceAgorot: { label: 'יתרה', format: 'money' } },
 *
 * Mark overrides (reopen, restore, manual correction) `requiresReason`.
 * Do not register fields that hold sensitive free text you would not want
 * administrators to read in the audit screen; record a marker instead.
 */

import { defineAuditVocabulary } from '@/core/audit/vocabulary';

export const domainAuditVocabulary = defineAuditVocabulary({
  entityTypes: {},
  actions: {},
  fields: {},
});
