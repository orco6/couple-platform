import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { archiveTask } from '@/domain/sample/tasks';

export const POST = apiRoute<{ id: string }>('tasks.archive', async ({ params }) => {
  const actor = await requireActor();
  await archiveTask(db, actor, params.id);
  return { ok: true };
});
