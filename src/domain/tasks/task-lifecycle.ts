/**
 * The shared list's state machine — BUSINESS_RULES.md §4.
 *
 * The state is DERIVED from two nullable column pairs rather than stored in a
 * status column, because the columns are what the database constrains
 * (R-TASK-10, R-TASK-11) and a third representation of the same fact would be
 * a thing that can disagree with itself.
 *
 * Note what is deliberately cheap: reopening needs no reason and no extra
 * permission (R-TASK-04). A mis-tap at 23:40 must be undoable without a dialog,
 * and either partner can do it — the list is shared.
 */

import { defineLifecycle } from '@/core/lifecycle/lifecycle';
import type { Permission } from '@/domain/access';

export type TaskState = 'OPEN' | 'COMPLETED' | 'ARCHIVED';

export const taskLifecycle = defineLifecycle<TaskState, Permission>({
  initial: 'OPEN',
  states: {
    OPEN: { label: 'פתוחה', tone: 'active' },
    // Not `terminal`: reopening is an ordinary, expected move here.
    COMPLETED: { label: 'נסגרה', tone: 'success' },
    ARCHIVED: { label: 'בארכיון', tone: 'muted' },
  },
  transitions: [
    { name: 'complete', from: ['OPEN'], to: 'COMPLETED', permission: 'tasks.complete', label: 'סימון כנסגרה' },
    { name: 'reopen', from: ['COMPLETED'], to: 'OPEN', permission: 'tasks.complete', label: 'פתיחה מחדש' },
    {
      name: 'archive',
      from: ['OPEN', 'COMPLETED'],
      to: 'ARCHIVED',
      permission: 'tasks.archive',
      requiresReason: true,
      label: 'העברה לארכיון',
    },
    {
      name: 'restore',
      from: ['ARCHIVED'],
      to: 'OPEN',
      permission: 'tasks.archive',
      requiresReason: true,
      label: 'החזרה לרשימה',
    },
  ],
});

/** The single source of a task's state: the columns themselves. */
export function taskStateOf(task: { completedAt: Date | null; archivedAt: Date | null }): TaskState {
  if (task.archivedAt) return 'ARCHIVED';
  return task.completedAt ? 'COMPLETED' : 'OPEN';
}
