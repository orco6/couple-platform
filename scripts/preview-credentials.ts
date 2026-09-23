/**
 * Makes sure the PREVIEW review credentials exist, and hands the deploy script
 * their HASHES — never the passwords.
 *
 *   npx tsx scripts/preview-credentials.ts
 *
 * Reuses the passwords already in the credentials file (so a re-run, or a
 * re-created preview, keeps the ones the reviewer has on their phone), or
 * generates two and writes the file, mode 600, outside the repository.
 *
 * stdout is ONE line: base64url JSON of { a: <scrypt hash>, b: <scrypt hash> },
 * which scripts/deploy-preview.mjs passes to the one build that seeds. Nothing
 * else is written to stdout; the passwords are never printed.
 */

import { writeFileSync } from 'node:fs';

import { hashPassword } from '@/core/auth/password-hash';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';

import { CREDENTIALS_FILE, formatCredentials, readCredentials } from './lib/review-credentials';

async function main() {
  let passwords = readCredentials();
  if (passwords) {
    console.error(`Review credentials: reusing ${CREDENTIALS_FILE}`);
  } else {
    // Four groups (~79 bits), not the three of a temporary password: these are
    // not changed on first sign-in, and only their hashes ever leave this machine.
    passwords = { a: generateTemporaryPassword(4), b: generateTemporaryPassword(4) };
    writeFileSync(CREDENTIALS_FILE, formatCredentials(passwords, 'the Vercel preview database'), {
      encoding: 'utf8',
      mode: 0o600,
    });
    console.error(`Review credentials: written to ${CREDENTIALS_FILE}`);
  }

  const hashes = { a: await hashPassword(passwords.a), b: await hashPassword(passwords.b) };
  process.stdout.write(`${Buffer.from(JSON.stringify(hashes)).toString('base64url')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
