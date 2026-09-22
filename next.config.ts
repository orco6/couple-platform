import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

/**
 * Next.js configuration.
 *
 * Security headers that do not depend on the request live here. The
 * Content-Security-Policy needs a per-request nonce, so it is set in
 * src/proxy.ts instead.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The parent folder of this repository may contain other projects with their
  // own lockfiles. Pin the tracing root so the build never walks into them.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },

  env: {
    // Build identity, frozen at build time so a bug report can name the build.
    APP_VERSION: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // Authenticated API responses must never be cached by a proxy or browser.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
