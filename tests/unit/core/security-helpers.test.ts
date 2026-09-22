import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { diffForAudit, redactForAudit } from '@/core/audit/redact';
import { assertSafeForDestructiveOperation, describeDatabaseUrl } from '@/core/db/safety';
import { EnvError, parseEnv } from '@/core/env/env';
import { assertPrismaCommandAllowed } from '@/core/db/prisma-command-guard';
import { selectSessionToken } from '@/core/auth/cookies';
import { isSameOriginRequest } from '@/core/http/origin';
import { safeRedirectPath } from '@/core/http/safe-redirect';
import { redactForLog } from '@/core/log';
import { motion } from '@/core/ui/motion';

describe('database safety guard', () => {
  const local = 'postgresql://u:p@127.0.0.1:5434/bpf_test';

  it('allows a local, correctly named database', () => {
    expect(assertSafeForDestructiveOperation('test-reset', local, {}).database).toBe('bpf_test');
  });

  it('refuses remote hosts even with a test-looking name', () => {
    expect(() => assertSafeForDestructiveOperation('test-reset', 'postgresql://u:p@ep-x.neon.tech/bpf_test', {})).toThrow(/local/);
  });

  it('refuses the wrong database name for the operation', () => {
    expect(() => assertSafeForDestructiveOperation('test-reset', 'postgresql://u:p@127.0.0.1/bpf_dev', {})).toThrow(/_test/);
    expect(() => assertSafeForDestructiveOperation('local-reset', 'postgresql://u:p@localhost/app', {})).toThrow(/_dev/);
    expect(() => assertSafeForDestructiveOperation('local-reset', 'postgresql://u:p@localhost/production_dev_copy', {})).toThrow();
  });

  it('refuses in deployed environments whatever the URL says', () => {
    expect(() => assertSafeForDestructiveOperation('test-reset', local, { APP_ENV: 'production' })).toThrow();
    expect(() => assertSafeForDestructiveOperation('test-reset', local, { APP_ENV: 'preview' })).toThrow();
    expect(() => assertSafeForDestructiveOperation('test-reset', local, { VERCEL_ENV: 'development' })).toThrow();
  });

  it('refuses missing URLs and only trusts CI service hosts inside CI', () => {
    expect(() => assertSafeForDestructiveOperation('test-reset', undefined, {})).toThrow();
    expect(describeDatabaseUrl('postgresql://u:p@postgres/bpf_test').isLocalHost).toBe(false);
    expect(describeDatabaseUrl('postgresql://u:p@postgres/bpf_test', { CI: 'true' }).isLocalHost).toBe(true);
    expect(describeDatabaseUrl('postgresql://u:p@ep-cool.eu-central-1.aws.neon.tech/db').looksManaged).toBe(true);
  });
});

describe('environment validation', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost/bpf_dev' };

  it('accepts a minimal development environment', () => {
    expect(parseEnv({ ...base }).APP_ENV).toBe('development');
  });

  it('fails early with the variable name when something required is missing or malformed', () => {
    expect(() => parseEnv({})).toThrow(EnvError);
    expect(() => parseEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  const hosted = { DATABASE_URL: 'postgresql://u:p@ep-cool-123-pooler.eu-central-1.aws.neon.tech/app?sslmode=require' };

  it('requires an https APP_URL in preview and production', () => {
    expect(() => parseEnv({ ...hosted, APP_ENV: 'production' })).toThrow(/APP_URL/);
    expect(() => parseEnv({ ...hosted, APP_ENV: 'production', APP_URL: 'http://x.co' })).toThrow(/https/);
    expect(parseEnv({ ...hosted, VERCEL_ENV: 'preview', APP_URL: 'https://x.vercel.app' }).APP_ENV).toBe('preview');
    expect(parseEnv({ ...hosted, VERCEL_ENV: 'production', APP_URL: 'https://x.co' }).APP_ENV).toBe('production');
  });

  it('never lets Secure be switched off outside development', () => {
    expect(() => parseEnv({ ...hosted, APP_ENV: 'production', APP_URL: 'https://x.co', COOKIE_SECURE: 'false' })).toThrow();
  });

  it('refuses a deployed environment pointing at a loopback database', () => {
    expect(() => parseEnv({ ...base, APP_ENV: 'production', APP_URL: 'https://x.co' })).toThrow(/local database/);
    expect(() => parseEnv({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:5434/x', VERCEL_ENV: 'preview', APP_URL: 'https://x.co' })).toThrow(/local database/);
  });

  it('refuses an APP_ENV that contradicts the Vercel environment', () => {
    expect(() => parseEnv({ ...hosted, VERCEL_ENV: 'production', APP_ENV: 'development', APP_URL: 'https://x.co' })).toThrow(/contradicts/);
    expect(() => parseEnv({ ...hosted, VERCEL_ENV: 'preview', APP_ENV: 'production', APP_URL: 'https://x.co' })).toThrow(/contradicts/);
  });
});

describe('session cookie selection (fixation defence)', () => {
  it('over HTTPS only the __Host- cookie counts; a planted plain cookie is ignored', () => {
    expect(selectSessionToken({ secureCookie: undefined, plainCookie: 'attacker' }, true)).toBeUndefined();
    expect(selectSessionToken({ secureCookie: 'mine', plainCookie: 'attacker' }, true)).toBe('mine');
  });

  it('over plain HTTP (local dev) only the plain cookie exists', () => {
    expect(selectSessionToken({ secureCookie: 'x', plainCookie: 'dev' }, false)).toBe('dev');
  });
});

describe('Prisma CLI guard (prisma.config.ts)', () => {
  const local = 'postgresql://u:p@127.0.0.1:5434/app_dev';
  const remote = 'postgresql://u:p@ep-x.neon.tech/app';

  it('always refuses db push', () => {
    expect(() => assertPrismaCommandAllowed(['db', 'push'], local, {})).toThrow(/disabled/);
    expect(() => assertPrismaCommandAllowed(['db', 'push', '--accept-data-loss'], local, {})).toThrow(/disabled/);
  });

  it('refuses reset / migrate dev / db execute / db seed against remote or wrongly named databases', () => {
    for (const args of [['migrate', 'reset', '--force'], ['migrate', 'dev'], ['db', 'execute', '--stdin'], ['db', 'seed']]) {
      expect(() => assertPrismaCommandAllowed(args, remote, {}), args.join(' ')).toThrow();
      expect(() => assertPrismaCommandAllowed(args, 'postgresql://u:p@localhost/production', {}), args.join(' ')).toThrow();
    }
    expect(() => assertPrismaCommandAllowed(['migrate', 'reset'], local, { VERCEL_ENV: 'production' })).toThrow();
  });

  it('lets the commands operators need run anywhere', () => {
    for (const args of [['generate'], ['validate'], ['migrate', 'deploy'], ['migrate', 'status'], ['migrate', 'diff', '--from-empty'], ['migrate', 'resolve']]) {
      expect(() => assertPrismaCommandAllowed(args, remote, {}), args.join(' ')).not.toThrow();
    }
    expect(() => assertPrismaCommandAllowed(['migrate', 'dev', '--name', 'x'], local, {})).not.toThrow();
  });
});

describe('open redirect protection', () => {
  it.each(['/customers', '/tasks?status=DONE', '/a/b#c'])('keeps same-site path %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '%2F%2Fevil.com', '/%0d%0aSet-Cookie:x', '', null])(
    'rejects %j',
    (path) => {
      expect(safeRedirectPath(path as string)).toBe('/');
    },
  );
});

describe('same-origin check for state-changing requests', () => {
  const base = { host: 'app.example.co.il', forwardedProto: 'https', referer: null, allowedOrigins: [] as string[] };

  it('allows same origin and safe methods', () => {
    expect(isSameOriginRequest({ ...base, method: 'POST', origin: 'https://app.example.co.il' })).toBe(true);
    expect(isSameOriginRequest({ ...base, method: 'GET', origin: 'https://evil.example' })).toBe(true);
  });

  it('refuses cross-origin, null origin, missing origin, and protocol downgrade', () => {
    expect(isSameOriginRequest({ ...base, method: 'POST', origin: 'https://evil.example' })).toBe(false);
    expect(isSameOriginRequest({ ...base, method: 'DELETE', origin: 'null' })).toBe(false);
    expect(isSameOriginRequest({ ...base, method: 'PATCH', origin: null })).toBe(false);
    expect(isSameOriginRequest({ ...base, method: 'POST', origin: 'http://app.example.co.il' })).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(isSameOriginRequest({ ...base, method: 'POST', origin: null, referer: 'https://app.example.co.il/customers' })).toBe(true);
  });
});

describe('secrets never reach the audit log or the server log', () => {
  it('drops credential-like keys at any depth and keeps the rest', () => {
    const cleaned = redactForAudit({ name: 'דנה', passwordHash: 'x', nested: { token: 't', apiKey: 'k', city: 'חיפה' }, when: new Date('2026-01-01T00:00:00Z') });
    expect(cleaned).toEqual({ name: 'דנה', nested: { city: 'חיפה' }, when: '2026-01-01T00:00:00.000Z' });
  });

  it('diffs only changed, non-noise fields', () => {
    expect(diffForAudit({ a: 1, b: 2, updatedAt: 1, version: 1 }, { a: 1, b: 3, updatedAt: 2, version: 2 })).toEqual({ before: { b: 2 }, after: { b: 3 } });
    expect(diffForAudit({ a: 1 }, { a: 1 })).toBeNull();
  });

  it('redacts log context', () => {
    expect(redactForLog({ password: 'p', cookie: 'c', route: 'x' })).toEqual({ password: '[redacted]', cookie: '[redacted]', route: 'x' });
  });
});

describe('motion tokens', () => {
  it('JS timings match the CSS source of truth', () => {
    const css = readFileSync('src/core/ui/styles/foundation.css', 'utf8');
    const read = (name: string) => Number(new RegExp(`--motion-${name}:\\s*(\\d+)ms`).exec(css)?.[1]);
    expect(read('sheet-enter')).toBe(motion.sheetEnterMs);
    expect(read('sheet-exit')).toBe(motion.sheetExitMs);
    expect(read('backdrop')).toBe(motion.backdropMs);
    expect(read('dialog-enter')).toBe(motion.dialogEnterMs);
    expect(read('dialog-exit')).toBe(motion.dialogExitMs);
    expect(read('disclosure-enter')).toBe(motion.disclosureEnterMs);
    expect(read('disclosure-exit')).toBe(motion.disclosureExitMs);
    expect(read('reduced')).toBe(motion.reducedMs);
    expect(css).toContain('--motion-sheet-enter-ease: cubic-bezier(0.32, 0.72, 0, 1)');
  });
});
