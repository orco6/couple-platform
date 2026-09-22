/**
 * Database safety guards.
 *
 * Pure functions, used by every script that can destroy or fabricate data
 * (test resets, local resets, dev seeds, QA data). The rule is deliberately
 * blunt: destructive operations run only against a database that is
 *
 *   1. on a local host (localhost / 127.0.0.1 / ::1, or the CI service host), AND
 *   2. named with an allowed suffix for the operation (_dev, _test, _e2e), AND
 *   3. in a process whose APP_ENV is not production or preview.
 *
 * All three, not any one. A shell that still exports a production
 * DATABASE_URL, a stray .env, or a mistyped database name each fail a
 * different check. See docs/adr/0006-production-safety.md.
 */

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  isLocalHost: boolean;
  /** Recognisable managed-Postgres hosts. Informational; never trusted as "safe". */
  looksManaged: boolean;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Hosts used by CI service containers. Only honoured when CI=true. */
const CI_SERVICE_HOSTS = new Set(['postgres']);

const MANAGED_HOST_PATTERNS = [
  /\.neon\.tech$/i,
  /\.supabase\.(co|com)$/i,
  /\.rds\.amazonaws\.com$/i,
  /\.render\.com$/i,
  /\.railway\.app$/i,
  /\.vercel-storage\.com$/i,
];

export function describeDatabaseUrl(url: string, environment: { CI?: string } = {}): DatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Database URL is not a valid URL.');
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error('Database URL must use the postgresql:// scheme.');
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalHost =
    LOCAL_HOSTS.has(host) || (environment.CI === 'true' && CI_SERVICE_HOSTS.has(host));

  return {
    host,
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    isLocalHost,
    looksManaged: MANAGED_HOST_PATTERNS.some((pattern) => pattern.test(host)),
  };
}

export type DestructiveOperation = 'test-reset' | 'e2e-reset' | 'local-reset' | 'dev-seed' | 'qa-data' | 'any-local';

const ALLOWED_SUFFIXES: Record<DestructiveOperation, readonly string[]> = {
  'test-reset': ['_test'],
  'e2e-reset': ['_e2e'],
  'local-reset': ['_dev'],
  'dev-seed': ['_dev', '_e2e'],
  'qa-data': ['_dev', '_e2e'],
  /** Direct Prisma CLI commands that may destroy data (see prisma-command-guard.ts). */
  'any-local': ['_dev', '_test', '_e2e'],
};

export class UnsafeDatabaseOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeDatabaseOperationError';
  }
}

/**
 * Throws unless `operation` is allowed against `url` in this environment.
 * Returns the parsed target so callers can print what they are about to touch.
 */
export function assertSafeForDestructiveOperation(
  operation: DestructiveOperation,
  url: string | undefined,
  environment: { APP_ENV?: string; VERCEL_ENV?: string; CI?: string; NODE_ENV?: string },
): DatabaseTarget {
  if (!url) {
    throw new UnsafeDatabaseOperationError(`Refusing ${operation}: no database URL is set.`);
  }

  const appEnv = environment.APP_ENV ?? '';
  if (appEnv === 'production' || appEnv === 'preview' || environment.VERCEL_ENV) {
    throw new UnsafeDatabaseOperationError(
      `Refusing ${operation}: APP_ENV/VERCEL_ENV indicates a deployed environment.`,
    );
  }

  const target = describeDatabaseUrl(url, environment);

  if (!target.isLocalHost) {
    throw new UnsafeDatabaseOperationError(
      `Refusing ${operation} on host "${target.host}": destructive operations only run against a local database.`,
    );
  }

  const suffixes = ALLOWED_SUFFIXES[operation];
  if (!suffixes.some((suffix) => target.database.endsWith(suffix))) {
    throw new UnsafeDatabaseOperationError(
      `Refusing ${operation} on database "${target.database}": the name must end with ${suffixes.join(' or ')}.`,
    );
  }

  return target;
}
