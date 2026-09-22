/**
 * Sign-in: the one place a password is checked against an account.
 *
 * The failure path is deliberately uniform — same message, same status, same
 * rough timing — whether the username is unknown, the password is wrong, or
 * the account is disabled. A form that tells those apart is a list of who
 * works here, and "this account is disabled" confirms the password was right.
 */

import { db } from '@/core/db/client';
import { copy } from '@/core/copy';
import type { DbClient } from '@/core/db/types';
import { AppError, errors } from '@/core/errors/errors';
import { access } from '@/domain/contract';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from './actor';
import { equalizeTiming, hashPassword, verifyPassword } from './password-hash';
import { normalizePasswordInput } from './password-input';
import { createSession, type CreatedSession } from './session';
import {
  assertNotThrottled,
  clearFailures,
  clientThrottleKey,
  CLIENT_POLICY,
  recordFailure,
  USERNAME_POLICY,
  usernameThrottleKey,
} from './throttle';
import { normalizeUsername } from './username';

export interface SignInInput {
  username: string;
  password: string;
  clientAddress: string;
}

export interface SignInResult {
  session: CreatedSession;
  actor: Actor;
}

const invalidCredentials = () => new AppError('authentication', 'INVALID_CREDENTIALS', copy.auth.invalidCredentials);

export async function signIn(input: SignInInput, client: DbClient = db, now = new Date()): Promise<SignInResult> {
  const username = normalizeUsername(input.username);
  const password = normalizePasswordInput(input.password);
  if (!username || !password) throw errors.validation(copy.auth.missingCredentials);
  // Bound the work an attacker can make scrypt do per request.
  if (username.length > 64 || password.length > 1024) throw invalidCredentials();

  const usernameKey = usernameThrottleKey(username);
  // An unknown client address must not become one shared key: 50 failures from
  // anyone would then lock sign-in for everyone. Only real addresses are counted.
  const clientKey = input.clientAddress && input.clientAddress !== 'unknown' ? clientThrottleKey(input.clientAddress) : null;
  await assertNotThrottled(client, clientKey ? [usernameKey, clientKey] : [usernameKey], now);

  const user = await client.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, role: true, status: true, mustChangePassword: true, passwordHash: true },
  });

  if (!user) {
    await equalizeTiming();
    await recordFailure(client, usernameKey, USERNAME_POLICY, now);
    if (clientKey) await recordFailure(client, clientKey, CLIENT_POLICY, now);
    throw invalidCredentials();
  }

  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);

  if (!valid || user.status !== 'ACTIVE' || !access.isRole(user.role)) {
    await recordFailure(client, usernameKey, USERNAME_POLICY, now);
    if (clientKey) await recordFailure(client, clientKey, CLIENT_POLICY, now);
    throw invalidCredentials();
  }

  await clearFailures(client, usernameKey);

  await client.user.update({
    where: { id: user.id },
    data: { lastLoginAt: now, ...(needsRehash ? { passwordHash: await hashPassword(password) } : {}) },
  });

  const session = await createSession(client, user.id, now);
  const actor: Actor = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };

  await recordAudit(client, { actor, action: 'auth.signed_in', entityType: 'user', entityId: user.id });

  return { session, actor };
}
