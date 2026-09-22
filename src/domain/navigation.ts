/**
 * NAVIGATION FOR THIS BUSINESS — replace per project.
 *
 * Filtering by permission here is UX only. Every page enforces access with a
 * page guard, and every service re-checks access for the data it returns.
 */

import { can, type Permission } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import type { NavItem } from '@/core/ui/shell/nav-types';

const items: Array<NavItem & { permission?: Permission }> = [
  { href: '/', label: 'היום', icon: 'home', mobile: 'bar', matchPrefix: false },
  { href: '/customers', label: 'לקוחות', icon: 'users', mobile: 'bar' },
  { href: '/tasks', label: 'משימות', icon: 'list', mobile: 'bar' },
  { href: '/attention', label: 'לטיפול', icon: 'flag', mobile: 'bar' },
  { href: '/reports/revenue', label: 'הכנסות', icon: 'chart', mobile: 'more', permission: 'reports.revenue' },
  { href: '/admin/users', label: 'משתמשים', icon: 'user', mobile: 'more', group: 'ניהול', permission: 'users.read' },
  { href: '/admin/audit', label: 'יומן פעולות', icon: 'history', mobile: 'more', group: 'ניהול', permission: 'audit.read' },
  { href: '/admin/archive', label: 'ארכיון', icon: 'archive', mobile: 'more', group: 'ניהול', permission: 'archive.read' },
  { href: '/admin/settings', label: 'הגדרות', icon: 'settings', mobile: 'more', group: 'ניהול', permission: 'settings.manage' },
  { href: '/account', label: 'החשבון שלי', icon: 'user', mobile: 'more', group: 'אישי' },
];

export function navigationFor(actor: Actor): NavItem[] {
  return items.filter((item) => !item.permission || can(actor, item.permission)).map(({ permission: _p, ...item }) => item);
}
