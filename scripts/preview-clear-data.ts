/**
 * Empties the PREVIEW review list, once, on request — so the reviewers can see
 * the product from its first task (the owner asked to start with no data).
 *
 *   npm run deploy:preview -- --clear-data
 *
 * which makes that one Vercel preview build run this after migrating. Removed:
 * every task, task rating and day closing. Kept: the two review accounts,
 * their link, the settings, and the audit log (history stays history).
 *
 * Refuses unless ALL hold — the same shape as the rest of the preview step:
 *   • it is a Vercel preview build (VERCEL=1, VERCEL_ENV=preview), so it cannot
 *     run against production or from a laptop;
 *   • --confirm names the database in the connection string.
 * docs/adr/0013-preview-database-setup.md (addendum).
 */

import { connect, printTarget, requireDatabaseUrl } from './lib/database';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview') {
    console.error(`\nRefusing: clearing review data only runs inside a Vercel preview build (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}).\n`);
    process.exit(2);
  }
  const url = requireDatabaseUrl();
  printTarget(url);
  const database = new URL(url).pathname.replace(/^\//, '');
  if (argument('confirm') !== database) {
    console.error(`\nRefusing: pass --confirm ${database} to clear this database's review data.\n`);
    process.exit(2);
  }

  const db = connect(url);
  try {
    const counts = await db.$transaction(async (tx) => {
      // Ratings reference tasks (onDelete: Restrict), so they go first.
      const ratings = await tx.taskRating.deleteMany({});
      const tasks = await tx.dailyTask.deleteMany({});
      const days = await tx.dayEntry.deleteMany({});
      return { ratings: ratings.count, tasks: tasks.count, days: days.count };
    });
    console.log(`Review data cleared: ${counts.tasks} tasks, ${counts.ratings} ratings, ${counts.days} day closings. Users, the link and settings kept.`);
  } finally {
    await db.$disconnect();
  }
}

void main();
