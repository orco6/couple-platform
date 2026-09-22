/**
 * Prisma CLI configuration (migrations, generate, studio).
 *
 * The CLI uses DIRECT_URL when present: migrations take advisory locks and run
 * DDL, which do not work reliably through a transaction-mode pooler such as
 * Neon's "-pooler" endpoint. The running application uses DATABASE_URL (pooled)
 * through the driver adapter in src/core/db/create-client.ts.
 *
 * SAFETY NET: this file is evaluated by EVERY Prisma CLI command, including
 * ones typed by hand (`npx prisma migrate reset`). Commands that can destroy
 * data or drift the schema are refused here unless the target is a local
 * _dev/_test/_e2e database — the same rule as scripts/db.ts. `db push` is refused
 * always. Non-destructive commands (generate, validate, migrate deploy/status,
 * migrate diff) are unaffected. See docs/adr/0006-production-safety.md.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { assertPrismaCommandAllowed } from './src/core/db/prisma-command-guard';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';

assertPrismaCommandAllowed(process.argv.slice(2), url, process.env);

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
});
