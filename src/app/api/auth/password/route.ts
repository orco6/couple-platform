import { z } from 'zod';
import { changeOwnPassword } from '@/core/auth/account';
import { getCurrentSession } from '@/core/auth/current';
import { requireActor } from '@/core/auth/guards';
import { errors } from '@/core/errors/errors';
import { apiRoute, readBody } from '@/core/http/handler';

const schema = z.object({ currentPassword: z.string().max(2000), newPassword: z.string().max(2000) }).strict();

export const POST = apiRoute('auth.password', async ({ request }) => {
  const actor = await requireActor({ allowPendingPasswordChange: true });
  const session = await getCurrentSession();
  if (!session) throw errors.authentication();
  const input = await readBody(request, schema);
  await changeOwnPassword(actor, session.sessionId, input);
  return { ok: true };
});
