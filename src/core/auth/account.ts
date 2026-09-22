/**
 * A person managing their own credentials.
 */

import { db } from '@/core/db/client';
import { copy } from '@/core/copy';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from './actor';
import { hashPassword, verifyPassword } from './password-hash';
import { normalizePasswordInput } from './password-input';
import { checkPasswordPolicy } from './password-policy';
import { revokeUserSessions } from './session';
import { assertNotThrottled, recordFailure, USERNAME_POLICY, usernameThrottleKey } from './throttle';

/**
 * Change one's own password. Requires the current password even when a
 * temporary password is being replaced: a session left open on a shared
 * computer must not be enough to take over the account.
 *
 * Every OTHER session is ended; the one making the change stays signed in.
 */
export async function changeOwnPassword(
  actor: Actor,
  sessionId: string,
  input: { currentPassword: string; newPassword: string },
  client: DbClient = db,
): Promise<void> {
  const currentPassword = normalizePasswordInput(input.currentPassword);
  const newPassword = normalizePasswordInput(input.newPassword);

  const user = await client.user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true, username: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') throw errors.authentication();

  // Same per-username throttle as sign-in: a stolen session must not become a
  // way to brute-force the account's password for use elsewhere.
  const throttleKey = usernameThrottleKey(user.username);
  await assertNotThrottled(client, [throttleKey]);
  const { valid } = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    await recordFailure(client, throttleKey, USERNAME_POLICY);
    throw errors.validation(copy.auth.currentPasswordWrong, { currentPassword: copy.auth.currentPasswordWrong });
  }

  const problem = checkPasswordPolicy(newPassword, { username: user.username });
  if (problem) throw errors.validation(problem.message, { newPassword: problem.message });

  if ((await verifyPassword(newPassword, user.passwordHash)).valid) {
    throw errors.validation(copy.auth.passwordSameAsCurrent, { newPassword: copy.auth.passwordSameAsCurrent });
  }

  const passwordHash = await hashPassword(newPassword);

  await inTransaction(client, async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    });
    await revokeUserSessions(tx, actor.id, { exceptSessionId: sessionId });
    await recordAudit(tx, { actor, action: 'auth.password_changed', entityType: 'user', entityId: actor.id });
  });
}

/** Sign out everywhere else (lost phone, shared computer). */
export async function revokeOtherSessions(actor: Actor, sessionId: string, client: DbClient = db): Promise<number> {
  const count = await revokeUserSessions(client, actor.id, { exceptSessionId: sessionId });
  await recordAudit(client, {
    actor,
    action: 'auth.sessions_revoked',
    entityType: 'user',
    entityId: actor.id,
    metadata: { sessionsEnded: count },
  });
  return count;
}

