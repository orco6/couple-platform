import { access } from '@/domain/contract';
import { requireActor } from '@/core/auth/guards';
import { apiRoute } from '@/core/http/handler';

/** Who am I. Allowed while a password change is pending, so the client can route correctly. */
export const GET = apiRoute('auth.me', async () => {
  const actor = await requireActor({ allowPendingPasswordChange: true });
  return {
    id: actor.id,
    name: actor.name,
    username: actor.username,
    role: actor.role,
    roleLabel: access.roleLabel(actor.role),
    permissions: [...access.permissionsOf(actor.role)],
    mustChangePassword: actor.mustChangePassword,
  };
});
