import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { transitionTask, transitionTaskSchema } from '@/domain/sample/tasks';

export const POST = apiRoute<{ id: string }>('tasks.transition', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, transitionTaskSchema);
  return transitionTask(db, actor, params.id, input);
});
