/**
 * ROLES AND PERMISSIONS FOR THIS BUSINESS — replace per project.
 *
 * Starting point after `npm run foundation:new-business`: three generic roles.
 * Rename and extend from BUSINESS_BRIEF.md → Roles / Permissions.
 *
 * Rules core depends on (checked by tests/unit/core/access-and-lifecycle.test.ts):
 *   • one role must cover every other role and hold users.manage (the owner);
 *   • defaultRole must be a declared role.
 *
 * Add a permission: add it to `domainPermissions`, grant it to roles, check it
 * in the service with assertCan / scopeWhere. Naming: "<area>.<capability>",
 * "_all" for beyond-own-records. No migration is needed for role changes.
 */

import { defineAccess } from '@/core/access/define-access';

export const access = defineAccess({
  domainPermissions: {},
  roles: {
    OWNER: {
      label: 'בעלים',
      description: 'גישה מלאה.',
      permissions: 'all',
    },
    ADMIN: {
      label: 'מנהל מערכת',
      description: 'ניהול משתמשים, הגדרות ויומן הפעולות.',
      permissions: ['users.read', 'users.manage', 'audit.read', 'settings.manage', 'archive.read', 'follow_ups.read_all', 'follow_ups.manage_all'],
    },
    STAFF: {
      label: 'צוות',
      description: 'גישה לעבודה השוטפת בלבד.',
      permissions: [],
    },
  },
  defaultRole: 'STAFF',
});

export type Role = (typeof access.roles)[number];
export type Permission = (typeof access.permissions)[number];
