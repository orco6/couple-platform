import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { fields } from '@/core/validation/fields';
import { archiveCustomer } from '@/domain/sample/customers';

const schema = z.object({ reason: fields.optionalText({ label: 'סיבה', max: 500, multiline: true }) }).strict();

export const POST = apiRoute<{ id: string }>('customers.archive', async ({ request, params }) => {
  const actor = await requireActor();
  const { reason } = await readBody(request, schema);
  await archiveCustomer(db, actor, params.id, reason ?? null);
  return { ok: true };
});
