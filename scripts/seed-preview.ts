/**
 * Seed a FRESH PREVIEW database with two review partners and demo data.
 *
 *   DATABASE_URL=<direct preview url> npm run db:seed:preview -- --confirm <database-name>
 *
 * Safe by construction, like bootstrap-owner and for the same reasons:
 *   • refuses if ANY user already exists, so it can never overwrite or add to
 *     an installation that is already in use (with --skip-if-seeded that is a
 *     clean no-op instead of an error, for re-runs);
 *   • requires --confirm with the exact database name;
 *   • generates both passwords unless they are supplied in the environment,
 *     prints them once, and writes them to a file OUTSIDE the repository.
 *
 * On Vercel (scripts/preview-database.mjs) it is given only the password
 * HASHES, in REVIEW_PASSWORD_HASHES; the passwords stay in the credentials
 * file on the operator's machine, and nothing secret reaches the build log.
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

import { hashPassword } from '@/core/auth/password-hash';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';
import { isValidUsername, normalizeUsername } from '@/core/auth/username';
import type { Actor } from '@/core/auth/actor';
import { updateSetting } from '@/core/settings/settings';
import { seedDomainData } from '@/domain/dev-data';
import { REVIEW_TIME_KEY } from '@/domain/settings';

import { connect, printTarget, requireDatabaseUrl } from './lib/database';
import { CREDENTIALS_FILE, formatCredentials, REVIEW_ACCOUNTS } from './lib/review-credentials';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

/** { a, b } scrypt hashes from REVIEW_PASSWORD_HASHES (base64url JSON), or null when not supplied. */
function suppliedHashes(): { a: string; b: string } | null {
  const encoded = process.env.REVIEW_PASSWORD_HASHES;
  if (!encoded) return null;
  const hashes = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { a?: unknown; b?: unknown };
  const valid = (hash: unknown): hash is string => typeof hash === 'string' && hash.startsWith('scrypt$');
  if (!valid(hashes.a) || !valid(hashes.b)) {
    console.error('REVIEW_PASSWORD_HASHES must hold two scrypt hashes (scripts/preview-credentials.ts).');
    process.exit(1);
  }
  return { a: hashes.a, b: hashes.b };
}

async function main() {
  const url = requireDatabaseUrl();
  printTarget(url);
  const database = new URL(url).pathname.replace(/^\//, '');

  if (argument('confirm') !== database) {
    console.error(`\nRefusing: pass --confirm ${database} to seed this database.\n`);
    process.exit(2);
  }
  const { a, b } = REVIEW_ACCOUNTS;
  if (!isValidUsername(normalizeUsername(a.username)) || !isValidUsername(normalizeUsername(b.username))) {
    console.error('The review usernames are not valid for this installation.');
    process.exit(1);
  }
  const hashes = suppliedHashes();

  const db = connect(url);
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      if (process.argv.includes('--skip-if-seeded')) {
        // The one thing a re-run still does: keep the review accounts' display
        // names in step with REVIEW_ACCOUNTS. Matched by username, so ids,
        // roles, passwords and data are untouched, and nothing is created.
        for (const account of [a, b]) {
          const renamed = await db.user.updateMany({
            where: { username: normalizeUsername(account.username), NOT: { name: account.name } },
            data: { name: account.name },
          });
          if (renamed.count > 0) console.log(`Renamed ${account.username} to its review display name.`);
        }
        console.log(`Seed skipped: this database already has ${existing} user(s) — the review accounts exist.`);
        return;
      }
      console.error(`\nRefusing: this database already has ${existing} user(s). The preview seed only runs on an empty installation.\n`);
      process.exit(2);
    }

    // Supplied passwords win, so a re-created preview can keep the ones the
    // reviewer already has on their phone. Supplied hashes win over both.
    const passwordA = hashes ? null : (process.env.REVIEW_PASSWORD_A ?? generateTemporaryPassword());
    const passwordB = hashes ? null : (process.env.REVIEW_PASSWORD_B ?? generateTemporaryPassword());

    const create = async (account: (typeof REVIEW_ACCOUNTS)['a' | 'b'], passwordHash: string): Promise<Actor> => {
      const user = await db.user.create({
        data: {
          name: account.name,
          username: normalizeUsername(account.username),
          role: account.role,
          passwordHash,
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
    const partnerA = await create(a, hashes?.a ?? (await hashPassword(passwordA!)));
    const partnerB = await create(b, hashes?.b ?? (await hashPassword(passwordB!)));

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

    if (hashes) {
      console.log(`\nSeeded ${a.username} and ${b.username}. Passwords: the credentials file on the operator's machine.\n`);
      return;
    }

    const lines = formatCredentials({ a: passwordA!, b: passwordB! }, database);
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
