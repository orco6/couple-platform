/**
 * Sessions — database-backed, opaque tokens.
 *
 * Not JWTs: disabling a user, resetting a password or changing a role must take
 * effect on the very next request, and a self-contained token cannot be revoked
 * before it expires. Here, revocation is deleting rows.
 *
 *   • Token: 32 bytes from the OS CSPRNG, base64url, only in an httpOnly cookie.
 *   • Stored: SHA-256 of the token. A leaked Session table is not a login.
 *   • Idle expiry slides (refreshed at most once per REFRESH_INTERVAL, so reads
 *     do not write on every request); an absolute cap bounds total lifetime.
 *   • Every resolution re-checks the user: DISABLED or an unknown role ends
 *     every session that user has.
 *
 * This module has no Next.js imports so it is directly testable; the cookie
 * plumbing is in ./cookies.ts.
 */

import { createHash, randomBytes } from 'node:crypto';
import { access } from '@/domain/contract';
import type { DbClient } from '@/core/db/types';
import { ACTOR_SELECT, type Actor } from './actor';

export const SESSION_IDLE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  id: string;
  token: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

export async function createSession(client: DbClient, userId: string, now = new Date()): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_TTL_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

  const session = await client.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt, absoluteExpiresAt, createdAt: now, lastSeenAt: now },
    select: { id: true },
  });
  return { id: session.id, token, expiresAt, absoluteExpiresAt };
}

export interface ResolvedSession {
  sessionId: string;
  actor: Actor;
}

export async function resolveSessionToken(
  client: DbClient,
  token: string | undefined | null,
  now = new Date(),
): Promise<ResolvedSession | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  const session = await client.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      absoluteExpiresAt: true,
      lastSeenAt: true,
      user: { select: ACTOR_SELECT },
    },
  });
  if (!session) return null;

  if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
    await client.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  // Checked on every request, not only at sign-in, so revoking access is immediate.
  if (session.user.status !== 'ACTIVE' || !access.isRole(session.user.role)) {
    await client.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > SESSION_REFRESH_INTERVAL_MS) {
    const slid = Math.min(now.getTime() + SESSION_IDLE_TTL_MS, session.absoluteExpiresAt.getTime());
    await client.session.updateMany({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt: new Date(slid) },
    });
  }

  const { status: _status, ...actor } = session.user;
  return { sessionId: session.id, actor };
}

export async function revokeSessionToken(client: DbClient, token: string | undefined | null): Promise<void> {
  if (!token || !TOKEN_PATTERN.test(token)) return;
  await client.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

/** Ends every session a user has (optionally keeping the current one). */
export async function revokeUserSessions(
  client: DbClient,
  userId: string,
  options: { exceptSessionId?: string } = {},
): Promise<number> {
  const result = await client.session.deleteMany({
    where: { userId, ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}) },
  });
  return result.count;
}

export async function purgeExpiredSessions(client: DbClient, now = new Date()): Promise<number> {
  const result = await client.session.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { absoluteExpiresAt: { lte: now } }] },
  });
  return result.count;
}
