import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { getUser, updateUser, updateUserSchema } from '@/core/users/users';

type Params = { id: string };

export const GET = apiRoute<Params>('admin.users.get', async ({ params }) => {
  const actor = await requireActor();
  return getUser(db, actor, params.id);
});

export const PATCH = apiRoute<Params>('admin.users.update', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, updateUserSchema);
  return updateUser(db, actor, params.id, input);
});
