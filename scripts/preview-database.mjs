#!/usr/bin/env node
/**
 * The PREVIEW database step, run by Vercel's build (`vercel-build` in
 * package.json) BEFORE `next build` — and a no-op in every build but one kind.
 *
 * Why it runs on Vercel and not on the operator's machine: the Neon
 * integration stores its connection strings as Sensitive variables, and
 * Sensitive values are only ever decrypted inside Vercel's builds and
 * functions. `vercel env pull` writes them as "[SENSITIVE]", and no CLI or API
 * call hands them out. Copying them into a laptop would mean weakening that
 * protection, so the migration goes to where the credential already is.
 *
 * It runs only when ALL of these hold (see planPreviewDatabase):
 *   • VERCEL=1 and VERCEL_ENV=preview — a production build never migrates;
 *   • PREVIEW_DB_SETUP=1 — set per deployment by `npm run deploy:preview`
 *     (`vercel deploy --build-env`), never stored on the project, so a push
 *     to main builds and deploys WITHOUT touching the schema;
 *   • PREVIEW_DB_CONFIRM equals the database name in the connection string —
 *     the same named confirmation `db:deploy` asks a human for.
 * PREVIEW_DB_SETUP=1 on a non-preview build fails the build rather than being
 * quietly ignored.
 *
 * Then: `db.ts deploy` (guarded `prisma migrate deploy`, idempotent) and the
 * preview seed with --skip-if-seeded (a no-op once the review accounts exist),
 * given only password HASHES. docs/adr/0013-preview-database-setup.md.
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Pure decision: what to do in this build, given its environment. */
export function planPreviewDatabase(env) {
  if (env.PREVIEW_DB_SETUP !== '1') return { run: false, reason: 'PREVIEW_DB_SETUP is not set for this deployment' };
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview') {
    return { run: false, error: `PREVIEW_DB_SETUP=1 is only allowed in a Vercel preview build (VERCEL_ENV=${env.VERCEL_ENV ?? 'unset'})` };
  }
  const url = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DIRECT_URL;
  if (!url) return { run: false, error: 'no direct database URL (DATABASE_URL_UNPOOLED) in the Preview environment' };
  let database;
  try {
    database = new URL(url).pathname.replace(/^\//, '');
  } catch {
    return { run: false, error: 'the direct database URL is not a valid connection string' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(database) || env.PREVIEW_DB_CONFIRM !== database) {
    return { run: false, error: `refusing: PREVIEW_DB_CONFIRM (${env.PREVIEW_DB_CONFIRM ?? 'unset'}) does not name this database (${database || 'none'})` };
  }
  if (!env.REVIEW_PASSWORD_HASHES) return { run: false, error: 'REVIEW_PASSWORD_HASHES is missing (scripts/preview-credentials.ts)' };
  return { run: true, url, database };
}

function main() {
  const plan = planPreviewDatabase(process.env);
  if (plan.error) {
    console.error(`\n✗ Preview database step: ${plan.error}\n`);
    process.exit(1);
  }
  if (!plan.run) {
    console.log(`Preview database step: skipped (${plan.reason}).`);
    return;
  }

  // Both variables pinned to the direct URL: Prisma's CLI reads DIRECT_URL
  // first, and a check on one while the command reads the other is no check.
  const env = { ...process.env, DATABASE_URL: plan.url, DIRECT_URL: plan.url };
  console.log(`Preview database step: migrating and seeding "${plan.database}".`);
  execSync(`npx tsx scripts/db.ts deploy --confirm ${plan.database}`, { stdio: 'inherit', env });
  execSync(`npx tsx scripts/seed-preview.ts --confirm ${plan.database} --skip-if-seeded`, { stdio: 'inherit', env });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
