/**
 * Password policy (server-authoritative; the client mirrors messages only).
 *
 * Follows NIST SP 800-63B rather than folklore: a real minimum length, a
 * generous maximum, a check against the most common passwords, and NO
 * composition rules ("one capital, one symbol") and no forced periodic
 * rotation — both push people toward predictable patterns.
 */

import { copy } from '@/core/copy';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/**
 * The passwords attackers try first, including patterns common on Israeli
 * keyboards. Compared case-insensitively. Short on purpose: length already
 * excludes most of the classic lists; this closes the long-but-obvious ones.
 */
const COMMON = new Set([
  '1234567890', '12345678910', '0123456789', '1111111111', '0000000000', '1234512345',
  'qwertyuiop', 'asdfghjkl;', 'password123', 'password1!', 'passw0rd123', 'iloveyou123',
  'qwerty1234', '1q2w3e4r5t', 'abcdefghij', 'abc1234567', 'a123456789', '123456789a',
  '1234567890a', 'aa12345678', 'welcome123', 'admin12345', 'administrator', 'letmein123',
  'changeme123', 'shalom1234', 'israel1234', 'yisrael123', 'ani123456789', 'q1w2e3r4t5',
  'sheket1234', 'password12', 'qwertyuiop1',
]);

export interface PasswordProblem {
  message: string;
}

export function checkPasswordPolicy(password: string, context: { username?: string } = {}): PasswordProblem | null {
  // Length in code points, so an emoji counts as one character, as a person sees it.
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return { message: copy.auth.passwordTooShort(PASSWORD_MIN_LENGTH) };
  if (length > PASSWORD_MAX_LENGTH) return { message: copy.auth.passwordTooLong };

  const lowered = password.toLowerCase();
  if (COMMON.has(lowered)) return { message: copy.auth.passwordTooCommon };
  if (/^(.)\1+$/.test(password)) return { message: copy.auth.passwordTooCommon };

  const username = context.username?.toLowerCase();
  if (username && username.length >= 3 && lowered.includes(username)) {
    return { message: copy.auth.passwordContainsUsername };
  }
  return null;
}
