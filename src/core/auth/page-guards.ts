import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { can, type Permission } from '@/core/access/can';
import { safeRedirectPath } from '@/core/http/safe-redirect';
import type { Actor } from './actor';
import { getCurrentSession } from './current';

/**
 * Page guards: same rules as the API guards, different failure mode. A person
 * who is not signed in is sent to sign in (and back afterwards); a person who
 * may not see a page gets "not found", which reveals nothing about what exists.
 *
 * Page guards protect rendering. They do not replace service-level checks —
 * every service re-checks access for the data it returns.
 */

export async function requireActorPage(): Promise<Actor> {
  const session = await getCurrentSession();
  if (!session) {
    const path = (await headers()).get('x-pathname') ?? '/';
    redirect(`/login?next=${encodeURIComponent(safeRedirectPath(path))}`);
  }
  if (session.actor.mustChangePassword) redirect('/change-password');
  return session.actor;
}

export async function requirePermissionPage(permission: Permission): Promise<Actor> {
  const actor = await requireActorPage();
  if (!can(actor, permission)) notFound();
  return actor;
}
