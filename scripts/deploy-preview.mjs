#!/usr/bin/env node
/**
 * ONE COMMAND to put this build online as a Vercel PREVIEW deployment.
 *
 *   npm run deploy:preview
 *
 * Everything in DEPLOY_PREVIEW.md that a CLI can do, this does. It is
 * idempotent: run it again after any step you had to finish in the browser,
 * and it picks up where it stopped.
 *
 * It stops, with instructions, at exactly the two things Vercel only offers in
 * a browser: signing in, and creating the database. Nothing else needs you.
 *
 * It never reads a database credential. The Neon integration stores them as
 * Sensitive variables, which `vercel env pull` writes as "[SENSITIVE]" and no
 * CLI hands out; only Vercel's own builds see the values. So this script
 * checks that the variables EXIST (by name), and asks the one deployment it
 * creates to migrate and seed from inside its build
 * (scripts/preview-database.mjs, docs/adr/0013-preview-database-setup.md).
 *
 * PREVIEW ONLY. Every deployment is `vercel deploy --target preview` (a bare
 * `vercel deploy` targets production on a project with no Git connection), and
 * this script never passes --prod. No production environment is created.
 */

import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT = process.env.VERCEL_PROJECT ?? 'couple-platform';
const ALIAS = process.env.VERCEL_REVIEW_ALIAS ?? 'couple-platform-review.vercel.app';
/** Neon's database name for a Vercel-created store. The build refuses if it is not the real one. */
const DATABASE = process.env.PREVIEW_DATABASE_NAME ?? 'neondb';
const CREDENTIALS_FILE = resolve(process.cwd(), '..', 'couple-platform-review-credentials.txt');

/**
 * The team the project lives in. The project is `or73/couple-platform`, and
 * `or73` is not the personal scope — without this every command would run
 * against the wrong account and `link` would create a SECOND project with the
 * same name. Override with VERCEL_SCOPE if the team is ever renamed.
 */
const SCOPE = process.env.VERCEL_SCOPE ?? 'or73';

const vercel = `npx --yes vercel@latest --scope ${SCOPE}`;

function sh(command, options = {}) {
  execSync(command, { stdio: 'inherit', ...options });
}

function capture(command, options = {}) {
  return execSync(command, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'], ...options }).trim();
}

function tryCapture(command, options = {}) {
  try {
    return capture(command, options);
  } catch {
    return null;
  }
}

function step(n, text) {
  console.log(`\n── ${n}. ${text}\n`);
}

function stop(text) {
  console.log(`\n✗ ${text}\n`);
  console.log('  Then run this again:  npm run deploy:preview\n');
  process.exit(10);
}

/** The variable NAMES in `vercel env ls preview` — values are never listed, and never needed. */
function previewVariableNames() {
  const listing = tryCapture(`${vercel} env ls preview`) ?? '';
  return new Set(
    listing
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Z][A-Z0-9_]*)\s+\S/.exec(line)?.[1])
      .filter(Boolean),
  );
}

/* ── 1. Who are we ──────────────────────────────────────────────────────── */

step(1, `Vercel account (scope ${SCOPE})`);
let who = tryCapture(`${vercel} whoami`);
if (!who) {
  console.log('Not signed in. Opening the Vercel login — approve it in the browser.\n');
  try {
    sh(`${vercel} login`);
  } catch {
    stop('Vercel login did not complete.');
  }
  who = tryCapture(`${vercel} whoami`);
  if (!who) stop('Still not signed in.');
}
console.log(`Signed in as ${who.split(/\r?\n/).pop()}`);

/* ── 2. The project ─────────────────────────────────────────────────────── */

step(2, `Project ${SCOPE}/${PROJECT}`);
mkdirSync('.vercel', { recursive: true });
const linked = existsSync('.vercel/project.json') && JSON.parse(readFileSync('.vercel/project.json', 'utf8')).projectName === PROJECT;
if (linked) {
  // Re-linking rewrites .gitignore (the CLI appends its own lines), so a linked repo is left alone.
  console.log(`Already linked to ${PROJECT}.`);
} else {
  try {
    // Links to the existing project of that name in this scope; creates it only
    // if there is none.
    sh(`${vercel} link --yes --project ${PROJECT}`);
  } catch {
    stop(`Could not link to the project "${PROJECT}" in scope "${SCOPE}".`);
  }
}

/* ── 3. The database ────────────────────────────────────────────────────── */

step(3, 'Preview database');
let names = previewVariableNames();

if (!names.has('DATABASE_URL')) {
  console.log('No DATABASE_URL in the Preview environment yet. This is the one thing the CLI cannot do.\n');
  console.log(`  1. Open   https://vercel.com/dashboard  →  ${PROJECT}  →  Storage`);
  console.log('  2. Create Database → Neon (Postgres) → region eu-central-1');
  console.log('  3. Name it  couple-platform-preview');
  console.log('  4. When it asks which environments to connect: choose PREVIEW.');
  stop('Create the database, then come back.');
}
if (!names.has('DATABASE_URL_UNPOOLED') && !names.has('POSTGRES_URL_NON_POOLING')) {
  stop('The database is connected but exposes no unpooled URL; expected DATABASE_URL_UNPOOLED.');
}
console.log('Connected: DATABASE_URL (pooled, runtime) and DATABASE_URL_UNPOOLED (direct, migrations).');
console.log('Their values are Sensitive and stay inside Vercel; this script never reads them.');

/* ── 4. The remaining Preview variables ─────────────────────────────────── */

step(4, 'Preview environment variables');

function setEnv(name, value, { sensitive }) {
  if (names.has(name)) {
    console.log(`${name} already set — left alone.`);
    return;
  }
  execSync(`${vercel} env add ${name} preview --yes ${sensitive ? '--sensitive' : '--no-sensitive'}`, {
    input: `${value}\n`,
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  console.log(`${name} set.`);
}

setEnv('APP_URL', `https://${ALIAS}`, { sensitive: false });
setEnv('CRON_SECRET', randomBytes(24).toString('base64url'), { sensitive: true });
// The Vercel Toolbar injects a script this app's nonce CSP correctly refuses.
// Turning the toolbar off for Preview is the fix; widening the CSP is not.
setEnv('VERCEL_PREVIEW_FEEDBACK_ENABLED', '0', { sensitive: false });
names = previewVariableNames();
for (const required of ['APP_URL', 'CRON_SECRET']) {
  if (!names.has(required)) stop(`${required} did not appear in the Preview environment.`);
}

/* ── 5. Review credentials (hashes only leave this machine) ─────────────── */

step(5, 'Review credentials');
const hashes = capture('npx tsx scripts/preview-credentials.ts', { stdio: ['inherit', 'pipe', 'inherit'] });
if (!/^[A-Za-z0-9_-]+$/.test(hashes)) stop('scripts/preview-credentials.ts did not produce the password hashes.');

/* ── 6. Deploy: this one build migrates and seeds ───────────────────────── */

step(6, `Deploying (preview) — the build migrates "${DATABASE}" and seeds it if empty`);
// `--clear-data` (on request only): this one build also empties the review
// list and day closings — scripts/preview-clear-data.ts.
const clearData = process.argv.includes('--clear-data') ? [`PREVIEW_CLEAR_DATA=${DATABASE}`] : [];
if (clearData.length) console.log(`This deployment will EMPTY the tasks, ratings and day closings in "${DATABASE}" (users and settings stay).`);
const buildEnv = [`PREVIEW_DB_SETUP=1`, `PREVIEW_DB_CONFIRM=${DATABASE}`, `REVIEW_PASSWORD_HASHES=${hashes}`, ...clearData]
  .map((pair) => `--build-env ${pair}`)
  .join(' ');
let deployed;
try {
  // --target preview is explicit: with no Git connection, a bare `vercel deploy` targets PRODUCTION
  // (seen on this project). The build step refuses the flag outside preview either way.
  deployed = capture(`${vercel} deploy --yes --target preview ${buildEnv}`, { stdio: ['inherit', 'pipe', 'inherit'] })
    .match(/https:\/\/[a-z0-9-]+\.vercel\.app/g)
    ?.pop();
} catch {
  console.log('\nThe build failed. Its log (migrations and seed included):');
  console.log(`  npx vercel@latest --scope ${SCOPE} inspect <deployment url above> --logs`);
  console.log(`If it says PREVIEW_DB_CONFIRM does not name the database, run with PREVIEW_DATABASE_NAME=<that name>.`);
  stop('Deployment failed.');
}
if (!deployed) stop('The deployment produced no URL.');
console.log(`Deployment: ${deployed}`);

step(7, `Stable review alias ${ALIAS}`);
let reviewUrl = `https://${ALIAS}`;
if (tryCapture(`${vercel} alias set ${deployed} ${ALIAS}`) === null) {
  reviewUrl = deployed;
  console.log(`Could not claim ${ALIAS} (it may be taken). Review on the deployment URL above instead,`);
  console.log('and set APP_URL to that origin in the Vercel dashboard if sign-in refuses the origin.');
}

/* ── 8. Smoke test, when it can get through Deployment Protection ───────── */

step(8, 'Deployed smoke test');
const credentials = existsSync(CREDENTIALS_FILE) ? readFileSync(CREDENTIALS_FILE, 'utf8') : '';
const password = (username) => new RegExp(`^${username}\\b[^\\n]*\\n\\s*password:\\s*(\\S+)`, 'm').exec(credentials)?.[1];
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (bypass && password('review-partner-a') && password('review-partner-b')) {
  try {
    sh('npm run smoke', {
      env: {
        ...process.env,
        SMOKE_BASE_URL: reviewUrl,
        REVIEW_PASSWORD_A: password('review-partner-a'),
        REVIEW_PASSWORD_B: password('review-partner-b'),
      },
    });
    console.log('Smoke test passed.');
  } catch {
    console.log('\n✗ Smoke test failed — the deployment is up; see the report above.');
    process.exitCode = 1;
  }
} else {
  console.log('Skipped: Deployment Protection stays ON, and the smoke test needs its automation bypass.');
  console.log('  Settings → Deployment Protection → Protection Bypass for Automation → create a secret, then');
  console.log('  VERCEL_AUTOMATION_BYPASS_SECRET=<secret> npm run deploy:preview');
}

console.log('\n── Ready ──\n');
console.log(`Review URL:  ${reviewUrl}`);
console.log(`             ${deployed}`);
console.log(`Credentials: ${CREDENTIALS_FILE}\n`);
console.log('The Git connection is not used by any of this — `vercel deploy` uploads the working');
console.log('directory, so a broken GitHub link cannot stop a review. To fix it anyway, install the');
console.log(`Vercel GitHub App for the orco6 account and grant it couple-platform:`);
console.log('  https://github.com/apps/vercel/installations/select_target\n');
