/**
 * Take a plain-SQL backup of whatever DATABASE_URL (or --url) points at.
 *
 *   npm run db:backup
 *   npm run db:backup -- --url "postgresql://…"
 *
 * Read-only. Writes to backups/ (gitignored — a dump holds every customer and
 * figure the business has). Uses pg_dump when installed; otherwise runs the
 * official postgres image through Docker, choosing a client version at least
 * as new as the server (pg_dump refuses newer servers).
 *
 * This is a MANUAL backup tool. It is not a backup strategy by itself — see
 * PRODUCTION_READINESS.md → Backups for what must actually be configured.
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createPrismaClient } from '@/core/db/create-client';
import { printTarget } from './lib/database';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function serverMajorVersion(url: string): Promise<number> {
  const db = createPrismaClient(url);
  try {
    const rows = await db.$queryRaw<Array<{ server_version_num: string }>>`SHOW server_version_num`;
    return Math.floor(Number(rows[0]?.server_version_num ?? '170000') / 10000);
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const url = argument('url') ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('No database URL. Set DATABASE_URL or pass --url.');
    process.exit(1);
  }
  printTarget(url, 'Backing up');

  const directory = resolve('backups');
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const database = new URL(url).pathname.replace(/^\//, '');
  const file = `${database}-${stamp}.sql`;

  const local = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  let result;
  if (local.status === 0) {
    result = spawnSync('pg_dump', ['--no-owner', '--no-privileges', '--file', join(directory, file), url], { stdio: 'inherit' });
  } else {
    const major = Math.max(await serverMajorVersion(url), 16);
    // Inside a container, 127.0.0.1 is the container itself; reach the host instead.
    const containerUrl = url.replace('@127.0.0.1', '@host.docker.internal').replace('@localhost', '@host.docker.internal');
    result = spawnSync(
      'docker',
      ['run', '--rm', '-v', `${directory}:/backups`, `postgres:${major}-alpine`, 'pg_dump', '--no-owner', '--no-privileges', '--file', `/backups/${file}`, containerUrl],
      { stdio: 'inherit' },
    );
  }

  if (result.status !== 0) {
    console.error('Backup FAILED. Nothing usable was written.');
    process.exit(1);
  }
  const size = statSync(join(directory, file)).size;
  console.log(`\nBackup written: backups/${file} (${Math.round(size / 1024)} KB)`);
  console.log('Verify it by restoring into a scratch database before relying on it (PRODUCTION_READINESS.md → Restore drill).\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
