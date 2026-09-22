/**
 * Password hashing with scrypt (Node's built-in crypto — no native dependency,
 * no custom cryptography).
 *
 * Why scrypt and not bcrypt: bcrypt silently ignores everything after 72
 * bytes (a long Hebrew passphrase is ~2 bytes per letter), and bcryptjs is a
 * pure-JS reimplementation. scrypt is memory-hard, ships with Node, and runs
 * identically on Vercel, in CI and locally. See docs/adr/0002-authentication.md.
 *
 * Stored format:  scrypt$<log2 N>$<r>$<p>$<salt b64url>$<key b64url>
 * The parameters travel with the hash, so they can be raised later: a login
 * with an older-parameter hash reports `needsRehash` and is upgraded in place.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keyLength: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key))),
  );

export interface HashParameters {
  log2N: number;
  r: number;
  p: number;
}

/** ~60–120ms and 32 MiB on current hardware. */
export const CURRENT_PARAMETERS: HashParameters = { log2N: 15, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function maxmemFor(parameters: HashParameters): number {
  return 256 * 2 ** parameters.log2N * parameters.r + 16 * 1024 * 1024;
}

export async function hashPassword(password: string, parameters: HashParameters = CURRENT_PARAMETERS): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH, {
    N: 2 ** parameters.log2N,
    r: parameters.r,
    p: parameters.p,
    maxmem: maxmemFor(parameters),
  });
  return ['scrypt', parameters.log2N, parameters.r, parameters.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

function parseStored(stored: string) {
  const [scheme, log2N, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return null;
  const parameters = { log2N: Number(log2N), r: Number(r), p: Number(p) };
  if (![parameters.log2N, parameters.r, parameters.p].every((n) => Number.isInteger(n) && n > 0)) return null;
  if (parameters.log2N > 20 || parameters.r > 32 || parameters.p > 16) return null;
  return { parameters, salt: Buffer.from(salt, 'base64url'), key: Buffer.from(key, 'base64url') };
}

export async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  const parsed = parseStored(stored);
  if (!parsed) {
    await equalizeTiming();
    return { valid: false, needsRehash: false };
  }
  const candidate = await scrypt(password, parsed.salt, parsed.key.length, {
    N: 2 ** parsed.parameters.log2N,
    r: parsed.parameters.r,
    p: parsed.parameters.p,
    maxmem: maxmemFor(parsed.parameters),
  });
  const valid = candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
  const needsRehash =
    valid &&
    (parsed.parameters.log2N !== CURRENT_PARAMETERS.log2N ||
      parsed.parameters.r !== CURRENT_PARAMETERS.r ||
      parsed.parameters.p !== CURRENT_PARAMETERS.p);
  return { valid, needsRehash };
}

let timingHash: Promise<string> | undefined;

/**
 * Spend the time a real verification would. Called when the username does not
 * exist, so response time cannot reveal which usernames are real.
 */
export async function equalizeTiming(): Promise<void> {
  timingHash ??= hashPassword(randomBytes(12).toString('base64url'));
  const stored = await timingHash;
  const parsed = parseStored(stored)!;
  await scrypt('timing-equalizer', parsed.salt, parsed.key.length, {
    N: 2 ** parsed.parameters.log2N,
    r: parsed.parameters.r,
    p: parsed.parameters.p,
    maxmem: maxmemFor(parsed.parameters),
  });
}
