/**
 * The two PREVIEW review accounts, and the file that holds their passwords.
 *
 * The file lives OUTSIDE the repository, beside it, so it is never committed
 * by accident. It is the only place the passwords exist in readable form:
 * the database stores scrypt hashes, and a deployment is only ever given
 * those hashes (scripts/preview-database.mjs), never the passwords.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REVIEW_ACCOUNTS = {
  a: { username: 'review-partner-a', name: 'אור', role: 'OWNER' },
  b: { username: 'review-partner-b', name: 'נטיה', role: 'PARTNER' },
} as const;

export const CREDENTIALS_FILE = resolve(process.cwd(), '..', 'couple-platform-review-credentials.txt');

export interface ReviewPasswords {
  a: string;
  b: string;
}

export function formatCredentials(passwords: ReviewPasswords, database: string): string {
  const { a, b } = REVIEW_ACCOUNTS;
  return [
    'couple-platform — PREVIEW review credentials',
    `database: ${database}`,
    `created:  ${new Date().toISOString()}`,
    '',
    `${a.username}  (${a.name}, ${a.role})`,
    `  password: ${passwords.a}`,
    '',
    `${b.username}  (${b.name}, ${b.role})`,
    `  password: ${passwords.b}`,
    '',
    'Fictional data only. Delete this file when the review is over.',
    '',
  ].join('\n');
}

/** The passwords in an existing credentials file, or null when there is none (or it is not ours). */
export function readCredentials(path = CREDENTIALS_FILE): ReviewPasswords | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const passwordAfter = (username: string) =>
    new RegExp(`^${username}\\b[^\\n]*\\n\\s*password:\\s*(\\S+)`, 'm').exec(text)?.[1];
  const a = passwordAfter(REVIEW_ACCOUNTS.a.username);
  const b = passwordAfter(REVIEW_ACCOUNTS.b.username);
  return a && b ? { a, b } : null;
}
