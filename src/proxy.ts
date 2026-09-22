import { NextResponse, type NextRequest } from 'next/server';
import { copy } from '@/core/copy';
import { isSameOriginRequest } from '@/core/http/origin';

/**
 * Request proxy (Next.js 16's name for middleware). Runs before every matched
 * request and does three things, none of which touch the database:
 *
 *  1. Refuses cross-origin state-changing API requests (CSRF defence in depth).
 *  2. Sets a strict, nonce-based Content-Security-Policy for pages.
 *  3. Passes the pathname to server components (for the post-login redirect).
 *
 * Authentication is NOT decided here. A proxy check is easy to bypass by a
 * route the matcher forgot, so every page and route handler enforces access
 * itself (core/auth/guards.ts, page-guards.ts).
 */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : [];
    const sameOrigin = isSameOriginRequest({
      method: request.method,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      allowedOrigins,
    });
    if (!sameOrigin) {
      return NextResponse.json(
        { error: { category: 'authorization', code: 'CROSS_ORIGIN_REJECTED', message: copy.errors.crossOrigin } },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  // Only ask the browser to upgrade subresources when this page itself arrived over HTTPS.
  // A production build served over plain http (E2E, testing on a phone over the LAN) would
  // otherwise request every script over https and never hydrate: WebKit does not exempt
  // localhost, and no browser exempts a LAN address. Found by the iPhone WebKit sweep.
  const servedOverHttps =
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // Inline style attributes are used for dynamic geometry (sheet drag offset).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(servedOverHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', `${pathname}${request.nextUrl.search}`);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // No header-based exclusions: a request must not be able to opt out of the
    // same-origin check by carrying a particular header.
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
  ],
};
