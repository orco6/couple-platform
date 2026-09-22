import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { setUserStatus } from '@/core/users/users';

const schema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) }).strict();

export const POST = apiRoute<{ id: string }>('admin.users.status', async ({ request, params }) => {
  const actor = await requireActor();
  const { status } = await readBody(request, schema);
  return setUserStatus(db, actor, params.id, status);
});
