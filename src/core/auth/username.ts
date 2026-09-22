/**
 * Usernames: lowercase latin so "Dana" and "dana" cannot be two accounts, and a
 * conservative character set so a username can be dictated over the phone.
 */

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(input: string): string {
  return input
    .replace(/[\u200b\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .trim()
    .toLowerCase();
}

export function isValidUsername(normalized: string): boolean {
  return USERNAME_PATTERN.test(normalized);
}
