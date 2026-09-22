import { requireActor } from '@/core/auth/guards';
import { parsePeriodKey } from '@/core/dates/period';
import { db } from '@/core/db/client';
import { errors } from '@/core/errors/errors';
import { apiRoute } from '@/core/http/handler';
import { closeRevenueMonth } from '@/domain/sample/revenue';

export const POST = apiRoute<{ period: string }>('revenue.close', async ({ params }) => {
  const actor = await requireActor();
  const period = parsePeriodKey(params.period);
  if (!period) throw errors.notFound();
  return closeRevenueMonth(db, actor, period);
});
