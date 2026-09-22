import { NextResponse } from 'next/server';
import { db } from '@/core/db/client';
import { log } from '@/core/log';

/**
 * Liveness + database reachability for uptime monitors. Reveals nothing about
 * versions, hosts or errors — just ok / degraded.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    log.error('health.database_unreachable', { error });
    return NextResponse.json({ status: 'degraded' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
