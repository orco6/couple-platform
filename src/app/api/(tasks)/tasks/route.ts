import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created, readBody } from '@/core/http/handler';
import { withIdempotency } from '@/core/http/idempotency';
import { createTask, createTaskSchema } from '@/domain/tasks/tasks';

export const POST = apiRoute('tasks.create', async ({ request }) => {
  const actor = await requireActor();
  return withIdempotency(request, actor.id, 'tasks.create', async () => {
    const input = await readBody(request, createTaskSchema);
    return created(await createTask(db, actor, input));
  });
});
