/**
 * Shared plumbing for database scripts: env loading, target description,
 * guarded destructive helpers.
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPrismaClient, type Database } from '@/core/db/create-client';
import { assertSafeForDestructiveOperation, describeDatabaseUrl, type DestructiveOperation } from '@/core/db/safety';

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env, or export it for this command.');
    process.exit(1);
  }
  return url;
}

export function printTarget(url: string, label = 'Target database'): void {
  const target = describeDatabaseUrl(url, { CI: process.env.CI });
  console.log(`${label}: ${target.database} on ${target.host}:${target.port}${target.isLocalHost ? ' (local)' : ' (REMOTE)'}`);
}

/** Throws (and exits) unless the operation is allowed on this URL in this environment. */
export function guard(operation: DestructiveOperation, url: string): void {
  try {
    assertSafeForDestructiveOperation(operation, url, process.env);
  } catch (error) {
    console.error(`\n✋ ${(error as Error).message}\n`);
    process.exit(2);
  }
}

export function connect(url: string): Database {
  return createPrismaClient(url);
}

/**
 * Empty every application table (keeps the migration history). TRUNCATE is used
 * rather than DELETE, so the append-only audit trigger does not fire. Only ever
 * called after `guard`.
 */
export async function truncateAll(db: Database): Promise<void> {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((table) => `"public"."${table.tablename.replace(/"/g, '""')}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export function run(command: string, env: NodeJS.ProcessEnv = process.env): void {
  // execSync through the shell: on Windows, npx is a .cmd shim that cannot be spawned directly.
  execSync(command, { stdio: 'inherit', env });
}

/**
 * Run a command for its OUTPUT, not for its exit code.
 *
 * `prisma migrate status` exits 1 whenever migrations are pending — which is
 * always true on a fresh database. Running it through `run()` therefore threw
 * before `migrate deploy` was ever reached, so the first deployment to a new
 * database could not be made with the guarded script. Its report is still
 * printed: it is what tells the operator what is about to be applied.
 */
export function report(command: string, env: NodeJS.ProcessEnv = process.env): void {
  try {
    execSync(command, { stdio: 'inherit', env });
  } catch {
    // The status itself is the answer; a non-zero exit is part of it.
  }
}

export const RESET_SCHEMA_SQL = join(process.cwd(), 'scripts', 'sql', 'reset-schema.sql');

/**
 * Drop the schema and replay every migration from empty. Guarded by the caller.
 *
 * Both DATABASE_URL and DIRECT_URL are pinned to the guarded URL for the
 * migrate step: Prisma's CLI reads DIRECT_URL first (prisma.config.ts), and a
 * guard that checks one variable while the destructive command reads another
 * is not a guard (a real Koma near-miss).
 */
export async function rebuildSchema(url: string): Promise<void> {
  const db = connect(url);
  try {
    for (const statement of readFileSync(RESET_SCHEMA_SQL, 'utf8').split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
  } finally {
    await db.$disconnect();
  }
  run('npx prisma migrate deploy', { ...process.env, DATABASE_URL: url, DIRECT_URL: url });
}
