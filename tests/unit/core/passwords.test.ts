import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/core/auth/password-hash';
import { normalizePasswordInput, wouldNormalizePassword } from '@/core/auth/password-input';
import { checkPasswordPolicy } from '@/core/auth/password-policy';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';
import { isValidUsername, normalizeUsername } from '@/core/auth/username';

const ch = (code: number) => String.fromCharCode(code);

describe('password input normalization (Koma paste bug)', () => {
  it('removes invisible formatting characters anywhere', () => {
    expect(normalizePasswordInput(`${ch(0x200f)}abc${ch(0x200e)}def${ch(0xfeff)}`)).toBe('abcdef');
    expect(normalizePasswordInput(`abc${ch(0x2066)}def${ch(0x2069)}`)).toBe('abcdef');
  });

  it('trims edge whitespace including non-breaking spaces, keeps inner spaces', () => {
    expect(normalizePasswordInput(`${ch(0xa0)} my pass phrase \n`)).toBe('my pass phrase');
  });

  it('keeps structural joiners (emoji ZWJ sequences)', () => {
    const family = `👨${ch(0x200d)}👩${ch(0x200d)}👧`;
    expect(normalizePasswordInput(family)).toBe(family);
  });

  it('makes composed and decomposed forms equal', () => {
    const decomposed = 'cafe' + ch(0x301); // e + combining acute accent
    const composed = 'caf' + ch(0xe9); // precomposed é
    expect(decomposed).not.toBe(composed);
    expect(normalizePasswordInput(decomposed)).toBe(normalizePasswordInput(composed));
    expect(wouldNormalizePassword('plain')).toBe(false);
  });
});

describe('password policy', () => {
  it('enforces length without composition rules', () => {
    expect(checkPasswordPolicy('short')).not.toBeNull();
    expect(checkPasswordPolicy('long enough phrase')).toBeNull();
    expect(checkPasswordPolicy('שלוםשלוםשלום')).toBeNull();
  });

  it('rejects common and repeated passwords, and ones containing the username', () => {
    expect(checkPasswordPolicy('1234567890')).not.toBeNull();
    expect(checkPasswordPolicy('aaaaaaaaaaaa')).not.toBeNull();
    expect(checkPasswordPolicy('dana-secret-123', { username: 'dana' })).not.toBeNull();
  });
});

describe('hashing', () => {
  it('verifies, rejects, and never stores the plain password', async () => {
    const hash = await hashPassword('correct horse', { log2N: 10, r: 8, p: 1 });
    expect(hash).not.toContain('correct');
    expect(hash.startsWith('scrypt$10$8$1$')).toBe(true);
    expect((await verifyPassword('correct horse', hash)).valid).toBe(true);
    expect((await verifyPassword('correct horsE', hash)).valid).toBe(false);
  });

  it('salts every hash', async () => {
    const a = await hashPassword('same', { log2N: 10, r: 8, p: 1 });
    const b = await hashPassword('same', { log2N: 10, r: 8, p: 1 });
    expect(a).not.toBe(b);
  });

  it('flags hashes with old parameters for upgrade', async () => {
    const old = await hashPassword('pw-for-rehash', { log2N: 10, r: 8, p: 1 });
    expect(await verifyPassword('pw-for-rehash', old)).toEqual({ valid: true, needsRehash: true });
  });

  it('treats malformed stored hashes as invalid, not as errors', async () => {
    expect((await verifyPassword('x', 'garbage')).valid).toBe(false);
    expect((await verifyPassword('x', 'scrypt$99$8$1$aa$bb')).valid).toBe(false);
  });
});

describe('temporary passwords and usernames', () => {
  it('generates unambiguous, policy-compliant temporary passwords', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const value = generateTemporaryPassword();
      expect(value).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
      expect(checkPasswordPolicy(value)).toBeNull();
      seen.add(value);
    }
    expect(seen.size).toBe(200);
  });

  it('normalizes usernames', () => {
    expect(normalizeUsername(` Dana.Levi${ch(0x200f)} `)).toBe('dana.levi');
    expect(isValidUsername('dana.levi')).toBe(true);
    expect(isValidUsername('דנה')).toBe(false);
    expect(isValidUsername('ab')).toBe(false);
  });
});
