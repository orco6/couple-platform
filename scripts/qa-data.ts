/**
 * QA / developer data mode.
 *
 * Replace the data in a LOCAL development or E2E database with a named
 * scenario, instead of filling long forms by hand before every test session.
 *
 *   npm run qa:data -- minimal      users only (all roles, one pending password change, one disabled)
 *   npm run qa:data -- realistic    users + customers, tasks across months, notes, follow-ups, a closed month
 *
 * Cannot touch production: refused unless the database is on a local host,
 * its name ends in _dev or _e2e, and APP_ENV/VERCEL_ENV do not indicate a
 * deployed environment (src/core/db/safety.ts). There is intentionally no
 * HTTP endpoint for this — a route can be reached from the internet, a local
 * script cannot.
 */

import { guard, printTarget, requireDatabaseUrl } from './lib/database';
import { seedDevData } from './lib/fixtures';

const scenario = process.argv[2] ?? 'realistic';
if (scenario !== 'minimal' && scenario !== 'realistic') {
  console.error('Usage: npm run qa:data -- <minimal|realistic>');
  process.exit(1);
}

const url = requireDatabaseUrl();
guard('qa-data', url);
printTarget(url);

seedDevData(url, scenario).catch((error) => {
  console.error(error);
  process.exit(1);
});
