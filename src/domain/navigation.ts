/**
 * NAVIGATION — שנינו (second edition).
 *
 * Two destinations and "more", because the product is two things: today, and
 * looking back. The first edition had four tabs (today, closing, week, month),
 * which on a real phone read as a feature menu for an app whose whole point is
 * that there is very little to it.
 *
 *   • Closing the day is not a place you go every time you open the app; it is
 *     a moment. It appears on Today when it is time (DayLine), and stays one
 *     tap away in "more" for any other hour.
 *   • The week and the month are one destination with two views (a segmented
 *     control inside it), so the tab stays lit on either.
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
  { href: '/week', label: copy.nav.reflection, icon: 'history', mobile: 'bar', alsoActiveOn: ['/month'] },

  // 'flag' rather than a tick: core's icon set has no check or moon, and the
  // attention flag is unused elsewhere in this product. A 'moon' icon would be
  // the natural fit and is a candidate generic addition to core — noted, not
  // taken, because one business wanting a nicer glyph is not a platform gap.
  { href: '/review', label: copy.nav.review, icon: 'flag', mobile: 'more', group: 'אישי' },

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
