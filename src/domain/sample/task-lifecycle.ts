/**
 * SAMPLE DOMAIN — task lifecycle.
 *
 *   OPEN ──start──▶ IN_PROGRESS ──complete──▶ DONE
 *     │                  │                     │
 *     └──complete────────┼─────────────────────┘ (OPEN may complete directly)
 *     └──cancel──▶ CANCELLED ◀──cancel──┘
 *   DONE / CANCELLED ──reopen (tasks.reopen + reason)──▶ IN_PROGRESS
 */

import { defineLifecycle } from '@/core/lifecycle/lifecycle';
import type { Permission } from '@/domain/access';

export const taskLifecycle = defineLifecycle<'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED', Permission>({
  initial: 'OPEN',
  states: {
    OPEN: { label: 'פתוחה', tone: 'neutral' },
    IN_PROGRESS: { label: 'בביצוע', tone: 'active' },
    DONE: { label: 'בוצעה', tone: 'success', terminal: true },
    CANCELLED: { label: 'בוטלה', tone: 'muted', terminal: true },
  },
  transitions: [
    { name: 'start', from: ['OPEN'], to: 'IN_PROGRESS', label: 'התחלת עבודה' },
    { name: 'complete', from: ['OPEN', 'IN_PROGRESS'], to: 'DONE', label: 'סימון כבוצעה' },
    { name: 'cancel', from: ['OPEN', 'IN_PROGRESS'], to: 'CANCELLED', label: 'ביטול' },
    {
      name: 'reopen',
      from: ['DONE', 'CANCELLED'],
      to: 'IN_PROGRESS',
      permission: 'tasks.reopen',
      requiresReason: true,
      label: 'פתיחה מחדש',
    },
  ],
});

export type TaskStatus = (typeof taskLifecycle.states)[number];
