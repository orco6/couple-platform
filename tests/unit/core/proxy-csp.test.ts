import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

const csp = (url: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(url, { headers })).headers.get('Content-Security-Policy') ?? '';

describe('page CSP', () => {
  it('asks for HTTPS upgrades only when the page itself was served over HTTPS', () => {
    // Plain http (local production build, a phone on the LAN): upgrading would break every script.
    expect(csp('http://192.168.1.20:3000/login')).not.toContain('upgrade-insecure-requests');
    expect(csp('http://localhost:3200/')).not.toContain('upgrade-insecure-requests');
    expect(csp('https://app.example.co.il/')).toContain('upgrade-insecure-requests');
    // Behind a TLS-terminating proxy the app sees http but the browser used https.
    expect(csp('http://internal:3000/', { 'x-forwarded-proto': 'https' })).toContain('upgrade-insecure-requests');
  });

  it('always carries a per-request nonce and no unsafe-inline scripts', () => {
    const policy = csp('https://app.example.co.il/');
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
