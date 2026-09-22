/**
 * Environment validation.
 *
 * Every variable the application reads is declared here, parsed once, and
 * typed. A missing or malformed required value throws with a message naming
 * the variable — at the first request, not three screens later as `undefined`.
 *
 * `parseEnv` is pure (it takes the source object) so it can be tested without
 * touching `process.env`. `getEnv` caches the parsed result for the process.
 */

import { z } from 'zod';

export const APP_ENVIRONMENTS = ['development', 'test', 'preview', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

const postgresUrl = z
  .string({ error: 'is required' })
  .min(1, 'is required')
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// connection string');

const baseSchema = z.object({
  APP_ENV: z.enum(APP_ENVIRONMENTS),
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl.optional(),
  APP_URL: z.url({ error: 'must be an absolute URL, e.g. https://app.example.com' }).optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Enables /api/cron/housekeeping (Vercel Cron sends it as a Bearer token). */
  CRON_SECRET: z.string().min(24, 'must be at least 24 characters').optional(),
});

export type Env = z.infer<typeof baseSchema>;

type Source = Record<string, string | undefined>;

/** Vercel sets VERCEL_ENV; map it so preview deployments are never "production". */
function deriveAppEnv(source: Source): string | undefined {
  if (source.APP_ENV) return source.APP_ENV;
  if (source.VERCEL_ENV === 'production') return 'production';
  if (source.VERCEL_ENV === 'preview' || source.VERCEL_ENV === 'development') return 'preview';
  if (source.NODE_ENV === 'test') return 'test';
  return 'development';
}

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
  }
}

export function parseEnv(source: Source): Env {
  const blankToUndefined = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value]),
  );

  const result = baseSchema.safeParse({ ...blankToUndefined, APP_ENV: deriveAppEnv(blankToUndefined) });

  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`),
    );
  }

  const env = result.data;
  const problems: string[] = [];

  if (env.APP_ENV === 'production' || env.APP_ENV === 'preview') {
    if (!env.APP_URL) problems.push(`APP_URL is required when APP_ENV=${env.APP_ENV}`);
    if (env.APP_URL && !env.APP_URL.startsWith('https://')) {
      problems.push('APP_URL must use https:// outside development');
    }
    if (env.COOKIE_SECURE === 'false') {
      problems.push('COOKIE_SECURE=false is not allowed outside development');
    }
    // A deployed app talking to a database on its own loopback is always a misconfiguration
    // (and on Vercel, a guaranteed outage).
    if (/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(env.DATABASE_URL)) {
      problems.push(`DATABASE_URL points at a local database while APP_ENV=${env.APP_ENV}`);
    }
  }

  // An explicit APP_ENV that contradicts the platform is refused: "development"
  // on a Vercel production deployment would unlock development-only behaviour.
  const vercelEnv = blankToUndefined.VERCEL_ENV;
  const explicit = blankToUndefined.APP_ENV;
  if (vercelEnv && explicit) {
    const expected = vercelEnv === 'production' ? 'production' : 'preview';
    if (explicit !== expected) {
      problems.push(`APP_ENV=${explicit} contradicts VERCEL_ENV=${vercelEnv} (expected ${expected}); remove APP_ENV on Vercel`);
    }
  }

  if (problems.length > 0) throw new EnvError(problems);
  return env;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function isProductionLike(env: Pick<Env, 'APP_ENV'> = getEnv()): boolean {
  return env.APP_ENV === 'production' || env.APP_ENV === 'preview';
}
