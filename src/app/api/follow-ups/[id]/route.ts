import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { closeFollowUp } from '@/core/follow-ups/follow-ups';
import { apiRoute, readBody } from '@/core/http/handler';
import { fields } from '@/core/validation/fields';

const schema = z
  .object({
    outcome: fields.oneOf(['RESOLVED', 'DISMISSED']),
    resolution: fields.optionalText({ label: 'אופן הטיפול', max: 1000, multiline: true }),
  })
  .strict();

export const POST = apiRoute<{ id: string }>('follow_ups.close', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, schema);
  return closeFollowUp(db, actor, params.id, input.outcome, input.resolution ?? null);
});
