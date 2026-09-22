/**
 * ROLES AND PERMISSIONS — שנינו.
 *
 * A couple is not a hierarchy, so there are two roles and almost no difference
 * between them. `OWNER` exists for two structural reasons, not because one
 * partner outranks the other:
 *   • core requires one role that covers every other role and holds
 *     `users.manage` (tests/unit/core/access-and-lifecycle.test.ts);
 *   • somebody has to be able to invite the second partner and reset a
 *     forgotten password, and there is no support desk.
 *
 * Everything about the shared day — the list, closing the day, the summaries —
 * is granted identically to both. See BUSINESS_RULES.md §1.
 *
 * R-ACC-04 — no permission here grants reading another partner's unrevealed
 * day entry. That gate is the reveal state, not a role: `OWNER` holds
 * `permissions: 'all'` and is still refused. Anyone tempted to add a
 * `day_entries.read_all` permission should read R-DAY-05 first — it would make
 * the product's one promise breakable by an administrator.
 */

import { defineAccess } from '@/core/access/define-access';

export const access = defineAccess({
  domainPermissions: {
    'tasks.read': 'צפייה ברשימה המשותפת',
    'tasks.create': 'הוספת משימה',
    'tasks.edit': 'עריכת משימה',
    'tasks.complete': 'סגירה ופתיחה מחדש של משימה',
    'tasks.archive': 'העברת משימה לארכיון ושחזור',
    'task_ratings.rate': 'דירוג משימה שהפרטנר סגר',
    'day_entries.submit': 'סגירת היום',
    'day_entries.read': 'צפייה בסגירות היום שלי',
    'summaries.read': 'צפייה בסיכומים',
  },
  roles: {
    OWNER: {
      label: 'בעלים',
      description: 'פרטנר שגם מזמין את הפרטנר השני ומשנה את ההגדרות המשותפות.',
      permissions: 'all',
    },
    PARTNER: {
      label: 'פרטנר',
      description: 'הרשימה המשותפת, סגירת היום והסיכומים.',
      permissions: [
        'tasks.read',
        'tasks.create',
        'tasks.edit',
        'tasks.complete',
        'tasks.archive',
        'task_ratings.rate',
        'day_entries.submit',
        'day_entries.read',
        'summaries.read',
        'archive.read',
      ],
    },
  },
  // A newly invited person is the second partner, never an owner.
  defaultRole: 'PARTNER',
});

export type Role = (typeof access.roles)[number];
export type Permission = (typeof access.permissions)[number];
