import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { fields } from '@/core/validation/fields';
import { restoreTask } from '@/domain/sample/tasks';

const schema = z.object({ reason: fields.reason() }).strict();

export const POST = apiRoute<{ id: string }>('tasks.restore', async ({ request, params }) => {
  const actor = await requireActor();
  const { reason } = await readBody(request, schema);
  await restoreTask(db, actor, params.id, reason);
  return { ok: true };
});
