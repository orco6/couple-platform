/**
 * NAVIGATION — שנינו.
 *
 * Three destinations, because the product is three things: the shared list,
 * closing the day, and looking back. All three are on the phone bar (the
 * foundation allows four), and everything administrative goes into "more" —
 * a couple should not see a management menu while making a shopping list.
 *
 * Filtering by permission here is UX only: every page has its own guard and
 * every service re-checks.
 */

import { can, type Permission } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import type { NavItem } from '@/core/ui/shell/nav-types';

import { copy } from './copy';

const items: Array<NavItem & { permission?: Permission }> = [
  { href: '/', label: copy.nav.today, icon: 'home', mobile: 'bar', matchPrefix: false },
  // 'flag' rather than a tick: core's icon set has no check or moon, and the
  // attention flag is unused elsewhere in this product. A 'moon' icon would be
  // the natural fit and is a candidate generic addition to core — noted, not
  // taken, because one business wanting a nicer glyph is not a platform gap.
  { href: '/review', label: copy.nav.review, icon: 'flag', mobile: 'bar' },
  { href: '/week', label: copy.nav.week, icon: 'chart', mobile: 'bar' },
  { href: '/month', label: copy.nav.month, icon: 'layers', mobile: 'bar' },

  { href: '/attention', label: 'ימים פתוחים', icon: 'list', mobile: 'more', group: 'אישי' },
  { href: '/settings', label: 'הגדרות', icon: 'settings', mobile: 'more', group: 'אישי' },
  { href: '/account', label: 'החשבון שלי', icon: 'user', mobile: 'more', group: 'אישי' },
  { href: '/archive', label: copy.tasks.archived, icon: 'archive', mobile: 'more', group: 'אישי', permission: 'archive.read' },

  { href: '/admin/users', label: 'משתמשים', icon: 'user', mobile: 'more', group: 'ניהול', permission: 'users.read' },
  { href: '/admin/audit', label: 'יומן פעולות', icon: 'history', mobile: 'more', group: 'ניהול', permission: 'audit.read' },
  { href: '/admin/settings', label: 'הגדרות מערכת', icon: 'settings', mobile: 'more', group: 'ניהול', permission: 'settings.manage' },
];

export function navigationFor(actor: Actor): NavItem[] {
  return items.filter((item) => !item.permission || can(actor, item.permission)).map(({ permission: _p, ...item }) => item);
}
