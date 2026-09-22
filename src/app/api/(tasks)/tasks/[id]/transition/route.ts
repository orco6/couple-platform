import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { taskTransitionSchema, transitionTask } from '@/domain/tasks/tasks';

export const POST = apiRoute<{ id: string }>('tasks.transition', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, taskTransitionSchema);
  return transitionTask(db, actor, { ...input, id: params.id });
});
