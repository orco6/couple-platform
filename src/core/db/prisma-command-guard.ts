/**
 * Refuses destructive Prisma CLI commands against anything but a local
 * development/test database. Pure, so it is unit-tested; called from
 * prisma.config.ts, which every Prisma CLI command evaluates.
 *
 *   db push          always refused (schema changes must be migrations)
 *   migrate reset    local *_dev / *_test / *_e2e only
 *   migrate dev      local *_dev / *_test / *_e2e only (it may reset on drift)
 *   db seed          local *_dev / *_e2e only
 *   db execute       local *_dev / *_test / *_e2e only (arbitrary SQL)
 *
 * Everything else (generate, validate, format, studio, migrate deploy/status/
 * diff/resolve) passes: those are the commands a production operator needs.
 */

import { assertSafeForDestructiveOperation, UnsafeDatabaseOperationError, type DestructiveOperation } from './safety';

type Environment = Record<string, string | undefined>;

export function classifyPrismaCommand(args: readonly string[]): 'push' | DestructiveOperation | null {
  const words = args.filter((arg) => !arg.startsWith('-'));
  const [first, second] = words;
  if (first === 'db' && second === 'push') return 'push';
  if (first === 'migrate' && (second === 'reset' || second === 'dev')) return 'any-local';
  if (first === 'db' && second === 'execute') return 'any-local';
  if (first === 'db' && second === 'seed') return 'dev-seed';
  return null;
}

export function assertPrismaCommandAllowed(args: readonly string[], url: string, environment: Environment): void {
  const operation = classifyPrismaCommand(args);
  if (operation === null) return;
  if (operation === 'push') {
    throw new UnsafeDatabaseOperationError(
      'prisma db push is disabled in this project: every schema change must be a migration. ' +
        'Use: npm run db:migrate:dev -- --name <change>',
    );
  }
  if (!url) throw new UnsafeDatabaseOperationError(`Refusing prisma ${args.join(' ')}: no database URL is set.`);
  assertSafeForDestructiveOperation(operation, url, environment);
}
