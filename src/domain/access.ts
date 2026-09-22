/**
 * ROLES AND PERMISSIONS FOR THIS BUSINESS — replace per project.
 *
 * Add a permission: add a key to `domainPermissions`, grant it to roles, check
 * it in the service (`assertCan(actor, 'x.y')`) and, if it gates a screen, in
 * the page guard and navigation. Add a role: add an entry to `roles`. No
 * migration is needed for either — roles are stored as strings.
 *
 * Naming: "<area>.<capability>". Use `_all` for "not only my own records".
 */

import { defineAccess } from '@/core/access/define-access';

export const access = defineAccess({
  domainPermissions: {
    'customers.read_all': 'צפייה בכל הלקוחות',
    'customers.create': 'הוספת לקוחות',
    'customers.edit_all': 'עריכת כל הלקוחות',
    'customers.archive': 'העברת לקוחות לארכיון',
    'tasks.read_all': 'צפייה בכל המשימות',
    'tasks.create': 'הוספת משימות',
    'tasks.edit_all': 'עריכת כל המשימות',
    'tasks.set_price': 'קביעת מחיר למשימה',
    'tasks.reopen': 'פתיחה מחדש של משימה שבוצעה',
    'tasks.archive': 'העברת משימות לארכיון',
    'notes.delete_any': 'מחיקת הערות של אחרים',
    'reports.revenue': 'צפייה בסיכום ההכנסות',
  },
  roles: {
    OWNER: {
      label: 'בעלים',
      description: 'גישה מלאה, כולל סגירת תקופות כספיות.',
      permissions: 'all',
    },
    ADMIN: {
      label: 'מנהל מערכת',
      description: 'ניהול משתמשים, הגדרות וכל הנתונים. ללא סגירת תקופות.',
      permissions: [
        'users.read',
        'users.manage',
        'audit.read',
        'settings.manage',
        'archive.read',
        'follow_ups.read_all',
        'follow_ups.manage_all',
        'customers.read_all',
        'customers.create',
        'customers.edit_all',
        'customers.archive',
        'tasks.read_all',
        'tasks.create',
        'tasks.edit_all',
        'tasks.set_price',
        'tasks.reopen',
        'tasks.archive',
        'notes.delete_any',
        'reports.revenue',
      ],
    },
    MANAGER: {
      label: 'מנהל',
      description: 'כל הלקוחות והמשימות, תמחור ומעקב. ללא ניהול משתמשים.',
      permissions: [
        'users.read',
        'archive.read',
        'follow_ups.read_all',
        'follow_ups.manage_all',
        'customers.read_all',
        'customers.create',
        'customers.edit_all',
        'customers.archive',
        'tasks.read_all',
        'tasks.create',
        'tasks.edit_all',
        'tasks.set_price',
        'tasks.reopen',
        'tasks.archive',
        'notes.delete_any',
        'reports.revenue',
      ],
    },
    STAFF: {
      label: 'צוות',
      description: 'הלקוחות והמשימות של העובד בלבד.',
      permissions: ['customers.create', 'tasks.create'],
    },
  },
  defaultRole: 'STAFF',
});

export type Role = (typeof access.roles)[number];
export type Permission = (typeof access.permissions)[number];
