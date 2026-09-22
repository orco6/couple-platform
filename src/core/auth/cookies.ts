import 'server-only';

import { cookies, headers } from 'next/headers';
import { getEnv } from '@/core/env/env';

/**
 * Session cookie plumbing.
 *
 * Over HTTPS the cookie is named with the `__Host-` prefix, which browsers only
 * accept when it is Secure, has Path=/ and no Domain — so it cannot be set or
 * shadowed by a sibling subdomain. Over plain http (local development) the
 * prefix is impossible, so a plain name is used.
 *
 * Secure is derived from the request protocol, not NODE_ENV (Koma lesson: a
 * production build served over http on a LAN set Secure, and WebKit silently
 * dropped the cookie — endless login loop on iPhones only).
 *
 * SameSite=Lax blocks the cookie on cross-site POSTs; the proxy additionally
 * rejects cross-origin state-changing API requests (see src/proxy.ts).
 */

export const SECURE_COOKIE_NAME = '__Host-session';
export const PLAIN_COOKIE_NAME = 'session';

export async function isSecureRequest(): Promise<boolean> {
  const env = getEnv();
  if (env.COOKIE_SECURE === 'true') return true;
  if (env.COOKIE_SECURE === 'false') return false;
  const forwardedProto = (await headers()).get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.split(',')[0]?.trim() === 'https';
  return env.APP_ENV === 'production' || env.APP_ENV === 'preview';
}

/**
 * Which cookie may carry the session for this request.
 *
 * Over HTTPS ONLY the __Host- cookie is honoured. Falling back to the plain name
 * would let a sibling subdomain (or an HTTP response on the same host) plant
 * "session=<attacker's token>" and silently sign a victim into the attacker's
 * account (session fixation / login CSRF). Over plain HTTP (local development)
 * a __Host- cookie cannot exist, so only the plain name is read.
 */
export function selectSessionToken(
  values: { secureCookie: string | undefined; plainCookie: string | undefined },
  secure: boolean,
): string | undefined {
  return secure ? values.secureCookie : values.plainCookie;
}

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return selectSessionToken(
    { secureCookie: store.get(SECURE_COOKIE_NAME)?.value, plainCookie: store.get(PLAIN_COOKIE_NAME)?.value },
    await isSecureRequest(),
  );
}

/** Route handlers only — Server Components cannot set cookies. */
export async function writeSessionCookie(token: string, expires: Date): Promise<void> {
  const secure = await isSecureRequest();
  const store = await cookies();
  store.set(secure ? SECURE_COOKIE_NAME : PLAIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SECURE_COOKIE_NAME);
  store.delete(PLAIN_COOKIE_NAME);
}
