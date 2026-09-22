/**
 * Seed a FRESH PREVIEW database with two review partners and demo data.
 *
 *   DATABASE_URL=<direct preview url> npm run db:seed:preview -- --confirm <database-name>
 *
 * Safe by construction, like bootstrap-owner and for the same reasons:
 *   • refuses if ANY user already exists, so it can never overwrite or add to
 *     an installation that is already in use;
 *   • requires --confirm with the exact database name;
 *   • generates both passwords unless they are supplied in the environment,
 *     prints them once, and writes them to a file OUTSIDE the repository.
 *
 * It is not `seed-dev`: that one truncates every table and is guarded to local
 * databases only. This one writes to an empty database and never deletes
 * anything, which is why it is allowed to run against a remote preview.
 *
 * All of the data below is fictional and comes from src/domain/dev-data.ts —
 * created through the domain services, so it obeys the same validation,
 * lifecycle and audit rules as real use.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { hashPassword } from '@/core/auth/password-hash';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';
import { isValidUsername, normalizeUsername } from '@/core/auth/username';
import type { Actor } from '@/core/auth/actor';
import { updateSetting } from '@/core/settings/settings';
import { seedDomainData } from '@/domain/dev-data';
import { REVIEW_TIME_KEY } from '@/domain/settings';

import { connect, printTarget, requireDatabaseUrl } from './lib/database';

const USERNAME_A = 'review-partner-a';
const USERNAME_B = 'review-partner-b';
const NAME_A = 'נועה ברק';
const NAME_B = 'מיכל ביטון';

/** Outside the repository, beside it — so it is never committed by accident. */
const CREDENTIALS_FILE = resolve(process.cwd(), '..', 'couple-platform-review-credentials.txt');

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const url = requireDatabaseUrl();
  printTarget(url);
  const database = new URL(url).pathname.replace(/^\//, '');

  if (argument('confirm') !== database) {
    console.error(`\nRefusing: pass --confirm ${database} to seed this database.\n`);
    process.exit(2);
  }
  if (!isValidUsername(normalizeUsername(USERNAME_A)) || !isValidUsername(normalizeUsername(USERNAME_B))) {
    console.error('The review usernames are not valid for this installation.');
    process.exit(1);
  }

  const db = connect(url);
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      console.error(`\nRefusing: this database already has ${existing} user(s). The preview seed only runs on an empty installation.\n`);
      process.exit(2);
    }

    // Supplied passwords win, so a re-created preview can keep the ones the
    // reviewer already has on their phone.
    const passwordA = process.env.REVIEW_PASSWORD_A ?? generateTemporaryPassword();
    const passwordB = process.env.REVIEW_PASSWORD_B ?? generateTemporaryPassword();

    const create = async (username: string, name: string, role: string, password: string): Promise<Actor> => {
      const user = await db.user.create({
        data: {
          name,
          username: normalizeUsername(username),
          role,
          passwordHash: await hashPassword(password),
          // Not a temporary password: a forced change on a phone is friction
          // for a reviewer, and these are random, single-purpose credentials
          // on a database that holds nothing but fictional data.
          mustChangePassword: false,
          status: 'ACTIVE',
          passwordChangedAt: new Date(),
        },
      });
      return { id: user.id, name: user.name, username: user.username, role: user.role, mustChangePassword: false } as Actor;
    };

    // A is OWNER because somebody has to be able to link the couple and move
    // the shared hour; B is an ordinary PARTNER. Both see the same product.
    const partnerA = await create(USERNAME_A, NAME_A, 'OWNER', passwordA);
    const partnerB = await create(USERNAME_B, NAME_B, 'PARTNER', passwordB);

    // The domain seeder links the couple and creates everything else. It reads
    // only [0] of each role, so the pair is the same person twice.
    await seedDomainData(db, {
      byRole: { OWNER: [partnerA, partnerA], PARTNER: [partnerB, partnerB] },
      top: partnerA,
      pending: partnerA,
      disabled: partnerB,
    });

    // So the day can actually be closed whenever the review happens. The
    // default (21:30) would show a reviewer nothing but "come back later".
    await updateSetting(db, partnerA, REVIEW_TIME_KEY, '00:00');

    const lines = [
      'couple-platform — PREVIEW review credentials',
      `database: ${database}`,
      `created:  ${new Date().toISOString()}`,
      '',
      `${USERNAME_A}  (${NAME_A}, OWNER)`,
      `  password: ${passwordA}`,
      '',
      `${USERNAME_B}  (${NAME_B}, PARTNER)`,
      `  password: ${passwordB}`,
      '',
      'Fictional data only. Delete this file when the review is over.',
      '',
    ].join('\n');

    writeFileSync(CREDENTIALS_FILE, lines, { encoding: 'utf8', mode: 0o600 });

    console.log(`\n${lines}`);
    console.log(`Written to: ${CREDENTIALS_FILE}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
