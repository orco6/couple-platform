import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { getEnv } from '@/core/env/env';
import { runHousekeeping } from '@/core/housekeeping';
import { log } from '@/core/log';

/**
 * Daily housekeeping, called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 * Without CRON_SECRET configured the route does not exist (404).
 */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return new NextResponse(null, { status: 404 });

  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new NextResponse(null, { status: 404 });
  }

  const result = await runHousekeeping(db);
  log.info('housekeeping.completed', result);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
