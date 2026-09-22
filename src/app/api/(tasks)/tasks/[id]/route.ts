import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { updateTask, updateTaskSchema } from '@/domain/tasks/tasks';

/**
 * The id in the path and the id in the body must agree — the service scopes by
 * the body's id, so accepting a mismatch would make the URL decorative.
 */
export const PATCH = apiRoute<{ id: string }>('tasks.update', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, updateTaskSchema);
  return updateTask(db, actor, { ...input, id: params.id });
});
