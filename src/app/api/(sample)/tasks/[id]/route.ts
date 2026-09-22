import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { getTask, updateTask, updateTaskSchema } from '@/domain/sample/tasks';

type Params = { id: string };

export const GET = apiRoute<Params>('tasks.get', async ({ params }) => {
  const actor = await requireActor();
  return getTask(db, actor, params.id);
});

export const PATCH = apiRoute<Params>('tasks.update', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, updateTaskSchema);
  return updateTask(db, actor, params.id, input);
});
