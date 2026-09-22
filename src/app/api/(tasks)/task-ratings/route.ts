import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { rateTask, rateTaskSchema } from '@/domain/tasks/task-ratings';

/**
 * Rating a completed task. Not idempotency-wrapped: the service upserts a
 * single row per task, so a retry produces the same rating rather than a second
 * one, and changing a rating is the same call with a different value.
 */
export const POST = apiRoute('task_ratings.rate', async ({ request }) => {
  const actor = await requireActor();
  const input = await readBody(request, rateTaskSchema);
  return rateTask(db, actor, input);
});
