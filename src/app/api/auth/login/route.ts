import { z } from 'zod';
import { signIn } from '@/core/auth/sign-in';
import { writeSessionCookie } from '@/core/auth/cookies';
import { apiRoute, clientAddress, readBody } from '@/core/http/handler';

const schema = z.object({ username: z.string().max(200), password: z.string().max(2000) }).strict();

export const POST = apiRoute('auth.login', async ({ request }) => {
  const input = await readBody(request, schema);
  const { session, actor } = await signIn({ ...input, clientAddress: clientAddress(request) });
  await writeSessionCookie(session.token, session.absoluteExpiresAt);
  // The token never appears in a response body.
  return { mustChangePassword: actor.mustChangePassword };
});
