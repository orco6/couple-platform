import { revokeOtherSessions } from '@/core/auth/account';
import { getCurrentSession } from '@/core/auth/current';
import { requireActor } from '@/core/auth/guards';
import { errors } from '@/core/errors/errors';
import { apiRoute } from '@/core/http/handler';

/** Sign out of every other device. */
export const DELETE = apiRoute('auth.sessions.revoke_others', async () => {
  const actor = await requireActor();
  const session = await getCurrentSession();
  if (!session) throw errors.authentication();
  const ended = await revokeOtherSessions(actor, session.sessionId);
  return { ended };
});
