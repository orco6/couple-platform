/**
 * Guarded database commands. Use these instead of calling the Prisma CLI
 * directly for anything that changes a database.
 *
 *   npm run db:migrate:dev -- --name add_invoice_number   create + apply a migration (LOCAL _dev only)
 *   npm run db:reset:local                                 drop, re-migrate, seed dev data (LOCAL _dev only)
 *   npm run db:seed:dev                                    replace data with dev fixtures (LOCAL only)
 *   npm run db:deploy -- --confirm <database-name>         apply pending migrations to ANY database,
 *                                                          after printing the target and requiring its name
 *
 * `prisma db push` is disabled (package.json): it changes a schema without a
 * migration file, which is how production drifts from the repository.
 */

import { printTarget, guard, rebuildSchema, requireDatabaseUrl, run } from './lib/database';
import { seedDevData } from './lib/fixtures';

const [command, ...rest] = process.argv.slice(2);
const url = requireDatabaseUrl();

function argument(name: string): string | undefined {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
}

async function main() {
  switch (command) {
    case 'migrate-dev': {
      guard('local-reset', url);
      printTarget(url);
      const name = argument('name');
      run(`npx prisma migrate dev${name ? ` --name ${name.replace(/[^a-z0-9_]/gi, '_')}` : ''}`);
      // Prisma 7's migrate dev no longer regenerates the client; without this, new models look missing.
      run('npx prisma generate');
      return;
    }

    case 'reset-local': {
      guard('local-reset', url);
      printTarget(url);
      await rebuildSchema(url);
      run('npx prisma generate');
      await seedDevData(url);
      return;
    }

    case 'seed-dev': {
      guard('dev-seed', url);
      printTarget(url);
      await seedDevData(url);
      return;
    }

    case 'deploy': {
      const deployUrl = process.env.DIRECT_URL || url;
      printTarget(deployUrl, 'Migrations will be applied to');
      const database = new URL(deployUrl).pathname.replace(/^\//, '');
      const confirm = argument('confirm');
      if (confirm !== database) {
        console.error(`\nRefusing: pass --confirm ${database} to apply migrations to this database.`);
        console.error('Before production: take a backup, read PRODUCTION_READINESS.md → Migrations.\n');
        process.exit(2);
      }
      run('npx prisma migrate status', { ...process.env, DIRECT_URL: deployUrl });
      run('npx prisma migrate deploy', { ...process.env, DIRECT_URL: deployUrl });
      return;
    }

    default:
      console.error('Usage: tsx scripts/db.ts <migrate-dev|reset-local|seed-dev|deploy> [options]');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
