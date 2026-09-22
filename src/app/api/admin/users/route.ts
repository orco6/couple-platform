import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created, readBody } from '@/core/http/handler';
import { createUser, createUserSchema, listUsers } from '@/core/users/users';

export const GET = apiRoute('admin.users.list', async () => {
  const actor = await requireActor();
  return { users: await listUsers(db, actor) };
});

/**
 * Returns the temporary password ONCE. It is never stored readable or logged.
 *
 * Deliberately NOT wrapped in withIdempotency: that would store the response —
 * including the temporary password — in the IdempotencyRecord table. A repeated
 * submit is instead refused by the unique username ("already taken").
 */
export const POST = apiRoute('admin.users.create', async ({ request }) => {
  const actor = await requireActor();
  const input = await readBody(request, createUserSchema);
  return created(await createUser(db, actor, input));
});
