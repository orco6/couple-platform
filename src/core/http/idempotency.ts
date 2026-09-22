import 'server-only';

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { redactForAudit } from '@/core/audit/redact';
import { copy } from '@/core/copy';
import { db } from '@/core/db/client';
import type { DbClient } from '@/core/db/types';
import { isUniqueViolation } from '@/core/db/types';
import { AppError } from '@/core/errors/errors';
import { log } from '@/core/log';

/**
 * Duplicate-submission protection for create-style endpoints.
 *
 * A double tap, a retry after a flaky network, or a resubmitted form sends the
 * same `Idempotency-Key` header. The first request claims the key (a unique row
 * per user + scope + key) and stores its response; a repeat gets that stored
 * response back instead of creating a second record.
 *
 * Rules:
 *   • Keys are per user and per scope — another user's identical key is unrelated.
 *   • The key is bound to a fingerprint of the request body. Reusing a key with
 *     a DIFFERENT body is refused (422 IDEMPOTENCY_KEY_REUSED) rather than
 *     replaying a response that belongs to other data.
 *   • A repeat while the first is still running gets 409 DUPLICATE_REQUEST.
 *     A claim older than ABANDONED_AFTER_MS without a response (a crashed or
 *     timed-out request) is treated as abandoned and may be claimed again.
 *   • Only 2xx responses are stored; a failure releases the key.
 *   • Responses containing credential-like keys are never stored.
 *   • Records are deleted by housekeeping after IDEMPOTENCY_TTL_MS.
 *
 * Without a key the request simply runs; `useSubmit` always sends one.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
export { IDEMPOTENCY_TTL_MS } from './idempotency-ttl';
/** Longer than any request can legitimately run (serverless limits are well below). */
export const ABANDONED_AFTER_MS = 2 * 60 * 1000;

export async function withIdempotency(
  request: Request,
  userId: string,
  scope: string,
  work: () => Promise<Response>,
  client: DbClient = db,
  now: () => Date = () => new Date(),
): Promise<Response> {
  const key = request.headers.get('idempotency-key');
  if (!key) return work();
  if (!KEY_PATTERN.test(key)) throw new AppError('validation', 'BAD_IDEMPOTENCY_KEY', copy.errors.badRequest);

  const fingerprint = createHash('sha256').update(await request.clone().text()).digest('hex');
  const recordId = await claim(client, { key, userId, scope, fingerprint }, now);
  if (recordId instanceof Response) return recordId;

  let response: Response;
  try {
    response = await work();
  } catch (error) {
    await client.idempotencyRecord.deleteMany({ where: { id: recordId } });
    throw error;
  }

  if (response.status < 200 || response.status >= 300) {
    await client.idempotencyRecord.deleteMany({ where: { id: recordId } });
    return response;
  }

  const body = (await response.clone().json().catch(() => null)) as Prisma.InputJsonValue | null;
  if (body !== null && JSON.stringify(redactForAudit(body)) !== JSON.stringify(body)) {
    log.warn('idempotency.sensitive_response_not_stored', { scope });
    await client.idempotencyRecord.deleteMany({ where: { id: recordId } });
    return response;
  }

  await client.idempotencyRecord.update({
    where: { id: recordId },
    data: { responseStatus: response.status, responseBody: body ?? {} },
  });
  return response;
}

async function claim(
  client: DbClient,
  input: { key: string; userId: string; scope: string; fingerprint: string },
  now: () => Date,
  attempt = 0,
): Promise<string | Response> {
  try {
    const record = await client.idempotencyRecord.create({ data: input, select: { id: true } });
    return record.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  const existing = await client.idempotencyRecord.findUnique({
    where: { userId_scope_key: { userId: input.userId, scope: input.scope, key: input.key } },
    select: { id: true, fingerprint: true, responseStatus: true, responseBody: true, createdAt: true },
  });
  if (!existing) {
    // Deleted between our insert and our read (failed first attempt). Try once more.
    if (attempt === 0) return claim(client, input, now, 1);
    throw new AppError('conflict', 'DUPLICATE_REQUEST', copy.errors.duplicateRequest);
  }

  if (existing.fingerprint && existing.fingerprint !== input.fingerprint) {
    throw new AppError('business_rule', 'IDEMPOTENCY_KEY_REUSED', copy.errors.badRequest);
  }

  if (existing.responseStatus != null) {
    return NextResponse.json(existing.responseBody, {
      status: existing.responseStatus,
      headers: { 'Cache-Control': 'no-store', 'Idempotent-Replay': 'true' },
    });
  }

  const abandoned = now().getTime() - existing.createdAt.getTime() > ABANDONED_AFTER_MS;
  if (abandoned && attempt === 0) {
    await client.idempotencyRecord.deleteMany({ where: { id: existing.id, responseStatus: null } });
    return claim(client, input, now, 1);
  }
  throw new AppError('conflict', 'DUPLICATE_REQUEST', copy.errors.duplicateRequest);
}
