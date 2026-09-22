import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { resetUserPassword } from '@/core/users/users';

/** Returns the new temporary password ONCE, to the administrator who reset it. */
export const POST = apiRoute<{ id: string }>('admin.users.password_reset', async ({ params }) => {
  const actor = await requireActor();
  return resetUserPassword(db, actor, params.id);
});
