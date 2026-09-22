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
 * PREVIEW ONLY. `vercel deploy` without --prod is always a preview deployment,
 * and this script never passes --prod. No production environment is created.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const PROJECT = process.env.VERCEL_PROJECT ?? 'couple-platform';
const ALIAS = process.env.VERCEL_REVIEW_ALIAS ?? 'couple-platform-review.vercel.app';
const ENV_FILE = '.vercel/.env.preview';

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

/** Reads a KEY=value file as Vercel writes it, quotes and all. */
function readEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
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
console.log(`Signed in as ${who}`);

/* ── 2. The project ─────────────────────────────────────────────────────── */

step(2, `Project "${PROJECT}"`);
mkdirSync('.vercel', { recursive: true });
try {
  // Links to the existing project of that name in this scope; creates it only
  // if there is none.
  sh(`${vercel} link --yes --project ${PROJECT}`);
} catch {
  stop(`Could not link to the project "${PROJECT}" in scope "${SCOPE}".`);
}

/* ── 3. The database ────────────────────────────────────────────────────── */

step(3, 'Preview database');
tryCapture(`${vercel} env pull ${ENV_FILE} --environment=preview --yes`);
let env = readEnvFile(ENV_FILE);

if (!env.DATABASE_URL) {
  console.log('No DATABASE_URL in the Preview environment yet. This is the one thing the CLI cannot do.\n');
  console.log(`  1. Open   https://vercel.com/dashboard  →  ${PROJECT}  →  Storage`);
  console.log('  2. Create Database → Neon (Postgres) → region eu-central-1');
  console.log('  3. Name it  couple-platform-preview');
  console.log('  4. When it asks which environments to connect: choose PREVIEW ONLY.');
  stop('Create the database, then come back.');
}

const direct = env.DATABASE_URL_UNPOOLED ?? env.POSTGRES_URL_NON_POOLING ?? null;
if (!direct) stop('The database is connected but exposes no unpooled URL; expected DATABASE_URL_UNPOOLED.');

const database = new URL(direct).pathname.replace(/^\//, '');
console.log(`Database: ${database}`);

/* ── 4. The remaining Preview variables ─────────────────────────────────── */

step(4, 'Preview environment variables');
const existing = tryCapture(`${vercel} env ls preview`) ?? '';

function setEnv(name, value) {
  if (new RegExp(`^\\s*${name}\\b`, 'm').test(existing)) {
    console.log(`${name} already set — left alone.`);
    return;
  }
  execSync(`${vercel} env add ${name} preview`, { input: `${value}\n`, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`${name} set.`);
}

setEnv('DIRECT_URL', direct);
setEnv('APP_URL', `https://${ALIAS}`);
setEnv('CRON_SECRET', randomBytes(24).toString('base64url'));

/* ── 5. Migrate and seed, from here, over the direct connection ─────────── */

const dbEnv = { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct };

step(5, 'Migrations');
sh(`npm run db:deploy -- --confirm ${database}`, { env: dbEnv });

step(6, 'Review partners and demo data');
try {
  sh(`npm run db:seed:preview -- --confirm ${database}`, { env: dbEnv });
} catch {
  // The seeder refuses a database that already has users, which is what we
  // want on a re-run: the review accounts are already there.
  console.log('\nSeed skipped: this database already has users (the review accounts exist).');
}

/* ── 7. Deploy ──────────────────────────────────────────────────────────── */

step(7, 'Deploying (preview)');
const deployed = capture(`${vercel} deploy --yes`).split(/\s+/).filter((token) => token.startsWith('https://')).pop();
if (!deployed) stop('The deployment produced no URL.');
console.log(`Deployment: ${deployed}`);

step(8, `Stable review alias ${ALIAS}`);
if (tryCapture(`${vercel} alias set ${deployed} ${ALIAS}`) === null) {
  console.log(`Could not claim ${ALIAS} (it may be taken). Review on the deployment URL above instead,`);
  console.log('and set APP_URL to that origin in the Vercel dashboard if sign-in refuses the origin.');
}

/* ── 9. What is left ────────────────────────────────────────────────────── */

tryCapture(`${vercel} env pull ${ENV_FILE} --environment=preview --yes`);
env = readEnvFile(ENV_FILE);

console.log('\n── Ready ──\n');
console.log(`Review URL:  https://${ALIAS}`);
console.log(`             ${deployed}`);
console.log('Credentials: ..\\couple-platform-review-credentials.txt (beside this repo)\n');
console.log('The Git connection is not used by any of this — `vercel deploy` uploads the working');
console.log('directory, so a broken GitHub link cannot stop a review. To fix it anyway, install the');
console.log(`Vercel GitHub App for the orco6 account and grant it couple-platform:`);
console.log('  https://github.com/apps/vercel/installations/select_target\n');
console.log('Two optional finishing touches in the dashboard:');
console.log(`  • Settings → General → Vercel Toolbar: OFF for ${PROJECT}.`);
console.log("    The toolbar injects a script this app's nonce CSP correctly refuses. Turning the");
console.log('    toolbar off is the fix; widening the CSP is not.');
console.log('  • Settings → Deployment Protection → Protection Bypass for Automation: create a secret');
console.log('    if you want the smoke test to run. Deployment Protection itself stays ON.\n');

if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET || env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  console.log('Smoke test: the bypass secret is available; run it with');
} else {
  console.log('Smoke test (after creating the bypass secret above):');
}
console.log(`  SMOKE_BASE_URL=https://${ALIAS} VERCEL_AUTOMATION_BYPASS_SECRET=<secret> \\`);
console.log('  REVIEW_PASSWORD_A=<from the file> REVIEW_PASSWORD_B=<from the file> npm run smoke\n');
