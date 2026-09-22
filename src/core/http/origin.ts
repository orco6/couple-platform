/**
 * Same-origin check for state-changing requests (CSRF defence in depth).
 *
 * The session cookie is SameSite=Lax, which already stops cross-site POSTs from
 * carrying it in modern browsers. This adds an explicit server-side rule that
 * does not depend on browser behaviour: a POST/PUT/PATCH/DELETE to the API is
 * refused unless its Origin (or, failing that, Referer) is this app.
 *
 * Pure function so it is unit-tested; applied in src/proxy.ts.
 */

export const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isSameOriginRequest(input: {
  method: string;
  origin: string | null;
  referer: string | null;
  host: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  allowedOrigins: readonly string[];
}): boolean {
  if (!STATE_CHANGING_METHODS.has(input.method.toUpperCase())) return true;

  const allowed = new Set(input.allowedOrigins.map((origin) => origin.replace(/\/$/, '').toLowerCase()));
  const host = (input.forwardedHost ?? input.host)?.split(',')[0]?.trim().toLowerCase();
  if (host) {
    const proto = input.forwardedProto?.split(',')[0]?.trim().toLowerCase();
    if (proto) allowed.add(`${proto}://${host}`);
    else {
      allowed.add(`https://${host}`);
      allowed.add(`http://${host}`);
    }
  }

  const candidate = input.origin ?? originOf(input.referer);
  // A state-changing browser request always carries one of the two. Their
  // absence means a non-browser client, which the session cookie alone cannot
  // come from under SameSite=Lax — but refusing is the safe default.
  if (!candidate || candidate === 'null') return false;
  return allowed.has(candidate.toLowerCase());
}

function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
