/**
 * NAVIGATION FOR THIS BUSINESS — replace per project.
 *
 * Add one item per domain screen. Filtering by permission here is UX only:
 * every page enforces access with a page guard, and every service re-checks.
 * Mobile: at most four items with mobile: 'bar'; the rest go in the "more" sheet.
 */

import { can, type Permission } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import type { NavItem } from '@/core/ui/shell/nav-types';

const items: Array<NavItem & { permission?: Permission }> = [
  { href: '/', label: 'היום', icon: 'home', mobile: 'bar', matchPrefix: false },
  { href: '/attention', label: 'לטיפול', icon: 'flag', mobile: 'bar' },
  { href: '/admin/users', label: 'משתמשים', icon: 'user', mobile: 'more', group: 'ניהול', permission: 'users.read' },
  { href: '/admin/audit', label: 'יומן פעולות', icon: 'history', mobile: 'more', group: 'ניהול', permission: 'audit.read' },
  { href: '/admin/settings', label: 'הגדרות', icon: 'settings', mobile: 'more', group: 'ניהול', permission: 'settings.manage' },
  { href: '/account', label: 'החשבון שלי', icon: 'user', mobile: 'more', group: 'אישי' },
];

export function navigationFor(actor: Actor): NavItem[] {
  return items.filter((item) => !item.permission || can(actor, item.permission)).map(({ permission: _p, ...item }) => item);
}
