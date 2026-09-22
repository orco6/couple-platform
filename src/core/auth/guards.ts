import 'server-only';

import { assertCan, type Permission } from '@/core/access/can';
import { errors } from '@/core/errors/errors';
import type { Actor } from './actor';
import { getCurrentSession } from './current';

/**
 * API guards. Every route handler that touches data starts with one of these.
 *
 * `mustChangePassword` is enforced HERE as well as on pages: an account holding
 * a temporary password can call exactly the password-change, sign-out and
 * who-am-I endpoints, and nothing else — not by UI convention but by refusal.
 */

export async function requireActor(options: { allowPendingPasswordChange?: boolean } = {}): Promise<Actor> {
  const session = await getCurrentSession();
  if (!session) throw errors.authentication();
  if (session.actor.mustChangePassword && !options.allowPendingPasswordChange) {
    throw errors.passwordChangeRequired();
  }
  return session.actor;
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  assertCan(actor, permission);
  return actor;
}
