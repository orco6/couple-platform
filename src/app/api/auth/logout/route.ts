import { clearSessionCookie, readSessionToken } from '@/core/auth/cookies';
import { revokeSessionToken } from '@/core/auth/session';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';

/** Always succeeds: signing out with no session is simply already signed out. */
export const POST = apiRoute('auth.logout', async () => {
  await revokeSessionToken(db, await readSessionToken());
  await clearSessionCookie();
  return { ok: true };
});
