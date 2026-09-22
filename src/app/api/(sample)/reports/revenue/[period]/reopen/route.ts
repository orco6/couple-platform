import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { parsePeriodKey } from '@/core/dates/period';
import { db } from '@/core/db/client';
import { errors } from '@/core/errors/errors';
import { apiRoute, readBody } from '@/core/http/handler';
import { fields } from '@/core/validation/fields';
import { reopenRevenueMonth } from '@/domain/sample/revenue';

const schema = z.object({ reason: fields.reason() }).strict();

export const POST = apiRoute<{ period: string }>('revenue.reopen', async ({ request, params }) => {
  const actor = await requireActor();
  const period = parsePeriodKey(params.period);
  if (!period) throw errors.notFound();
  const { reason } = await readBody(request, schema);
  return reopenRevenueMonth(db, actor, period, reason);
});
