import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { createFollowUp, createFollowUpSchema } from '@/core/follow-ups/follow-ups';
import { apiRoute, created, readBody } from '@/core/http/handler';
import { withIdempotency } from '@/core/http/idempotency';
import { followUpTargets } from '@/domain/follow-ups';

export const POST = apiRoute('follow_ups.create', async ({ request }) => {
  const actor = await requireActor();
  return withIdempotency(request, actor.id, 'follow_ups.create', async () => {
    const input = await readBody(request, createFollowUpSchema);
    return created(await createFollowUp(db, actor, input, followUpTargets));
  });
});
