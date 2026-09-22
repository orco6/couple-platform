/**
 * Brute-force protection for sign-in.
 *
 * Database-backed, so the limit holds across serverless instances and
 * restarts. Two independent counters per attempt:
 *
 *   per username   5 failures in 15 minutes → locked 15 minutes
 *                  Stops online guessing against one account.
 *   per client IP  50 failures in 15 minutes → locked 15 minutes
 *                  Stops one source spraying many usernames.
 *
 * The username counter applies whether or not the username exists, and the
 * locked response is identical either way — so throttling cannot be used to
 * discover accounts. Keys are SHA-256 hashes; no username or address is stored.
 *
 * Trade-off (documented in SECURITY_CHECKLIST.md): someone who knows a username
 * can lock that person out for 15 minutes at a time. An administrator password
 * reset clears the lock. That is the standard, accepted cost of lockout.
 *
 * The increment is a single atomic INSERT … ON CONFLICT, so concurrent failed
 * attempts cannot race past the limit.
 */

import { createHash } from 'node:crypto';
import { copy } from '@/core/copy';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';

export interface ThrottlePolicy {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

export const USERNAME_POLICY: ThrottlePolicy = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const CLIENT_POLICY: ThrottlePolicy = { maxFailures: 50, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export const usernameThrottleKey = (normalizedUsername: string) => `u:${digest(normalizedUsername)}`;
export const clientThrottleKey = (clientAddress: string) => `c:${digest(clientAddress)}`;

export async function assertNotThrottled(client: DbClient, keys: string[], now = new Date()): Promise<void> {
  const locked = await client.loginThrottle.findFirst({
    where: { key: { in: keys }, lockedUntil: { gt: now } },
    orderBy: { lockedUntil: 'desc' },
    select: { lockedUntil: true },
  });
  if (locked?.lockedUntil) {
    const seconds = Math.ceil((locked.lockedUntil.getTime() - now.getTime()) / 1000);
    throw errors.rateLimited(copy.auth.throttled, seconds);
  }
}

export async function recordFailure(client: DbClient, key: string, policy: ThrottlePolicy, now = new Date()): Promise<void> {
  const windowCutoff = new Date(now.getTime() - policy.windowMs);
  const lockUntil = new Date(now.getTime() + policy.lockMs);

  await client.$executeRaw`
    INSERT INTO "LoginThrottle" ("key", "failures", "windowStart", "lockedUntil", "updatedAt")
    VALUES (${key}, 1, ${now}, ${policy.maxFailures <= 1 ? lockUntil : null}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE WHEN "LoginThrottle"."windowStart" < ${windowCutoff} THEN 1 ELSE "LoginThrottle"."failures" + 1 END,
      "windowStart" = CASE WHEN "LoginThrottle"."windowStart" < ${windowCutoff} THEN ${now} ELSE "LoginThrottle"."windowStart" END,
      "lockedUntil" = CASE
        WHEN (CASE WHEN "LoginThrottle"."windowStart" < ${windowCutoff} THEN 1 ELSE "LoginThrottle"."failures" + 1 END) >= ${policy.maxFailures}
        THEN ${lockUntil}
        ELSE "LoginThrottle"."lockedUntil"
      END,
      "updatedAt" = ${now}
  `;
}

export async function clearFailures(client: DbClient, key: string): Promise<void> {
  await client.loginThrottle.deleteMany({ where: { key } });
}

/** Housekeeping: rows untouched for a day carry no information. */
export async function purgeStaleThrottleRows(client: DbClient, now = new Date()): Promise<number> {
  const result = await client.loginThrottle.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
  return result.count;
}
