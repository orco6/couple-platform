/**
 * Housekeeping: delete rows that carry no information any more.
 *
 *   • expired sessions (idle or absolute)
 *   • login throttle rows untouched for a day
 *   • idempotency records older than their 24-hour window
 *
 * Never touches business data or the audit log. Run daily by Vercel Cron
 * (vercel.json → /api/cron/housekeeping) or any scheduler.
 */

import { purgeExpiredSessions } from '@/core/auth/session';
import { purgeStaleThrottleRows } from '@/core/auth/throttle';
import type { DbClient } from '@/core/db/types';
import { IDEMPOTENCY_TTL_MS } from '@/core/http/idempotency-ttl';

export async function runHousekeeping(client: DbClient, now = new Date()) {
  const [sessions, throttleRows, idempotencyRecords] = await Promise.all([
    purgeExpiredSessions(client, now),
    purgeStaleThrottleRows(client, now),
    client.idempotencyRecord
      .deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - IDEMPOTENCY_TTL_MS) } } })
      .then((result) => result.count),
  ]);
  return { sessions, throttleRows, idempotencyRecords };
}
