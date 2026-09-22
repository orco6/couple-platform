import { describe, expect, it } from 'vitest';
import { changeOwnPassword } from '@/core/auth/account';
import { hashPassword } from '@/core/auth/password-hash';
import {
  createSession,
  resolveSessionToken,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from '@/core/auth/session';
import { signIn } from '@/core/auth/sign-in';
import { db } from '@/core/db/client';
import { caught, makeUser, TEST_PASSWORD } from '../../support/factories';
import { unprivilegedRole } from '../../support/roles';

const client = { clientAddress: '203.0.113.7' };

describe('sign-in', () => {
  it('signs in with correct credentials and never returns the token hash', async () => {
    const user = await makeUser({ role: unprivilegedRole(), username: 'dana' });
    const { session, actor } = await signIn({ username: ' Dana ', password: TEST_PASSWORD, ...client });
    expect(actor.id).toBe(user.id);
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(session.token);
    expect(JSON.stringify(actor)).not.toContain('scrypt');
  });

  it('gives the same answer for unknown user, wrong password and disabled account', async () => {
    await makeUser({ role: unprivilegedRole(), username: 'active-user' });
    await makeUser({ role: unprivilegedRole(), username: 'gone-user', status: 'DISABLED' });

    const unknown = await caught(() => signIn({ username: 'nobody', password: TEST_PASSWORD, ...client }));
    const wrong = await caught(() => signIn({ username: 'active-user', password: 'wrong-password-1', ...client }));
    const disabled = await caught(() => signIn({ username: 'gone-user', password: TEST_PASSWORD, ...client }));

    for (const error of [unknown, wrong, disabled]) {
      expect(error).toMatchObject({ category: 'authentication', code: 'INVALID_CREDENTIALS', status: 401 });
    }
    expect((unknown as unknown as Error).message).toBe((disabled as unknown as Error).message);
  });

  it('refuses a user whose role no longer exists in the domain', async () => {
    await makeUser({ role: 'RETIRED_ROLE', username: 'old-role' });
    expect(await caught(() => signIn({ username: 'old-role', password: TEST_PASSWORD, ...client }))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('locks a username after 5 failures, even with the right password, then the lock applies to unknown usernames too', async () => {
    await makeUser({ role: unprivilegedRole(), username: 'target' });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await caught(() => signIn({ username: 'target', password: `wrong-${attempt}-xxxxx`, ...client }));
    }
    expect(await caught(() => signIn({ username: 'target', password: TEST_PASSWORD, ...client }))).toMatchObject({ category: 'rate_limited', status: 429 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await caught(() => signIn({ username: 'ghost', password: `wrong-${attempt}-xxxxx`, clientAddress: '198.51.100.9' }));
    }
    expect(await caught(() => signIn({ username: 'ghost', password: 'anything-at-all', clientAddress: '198.51.100.9' }))).toMatchObject({ status: 429 });
  });

  it('stores no username or address in the throttle table', async () => {
    await caught(() => signIn({ username: 'secret-name', password: 'wrong-password-x', ...client }));
    const rows = await db.loginThrottle.findMany();
    expect(rows.length).toBe(2);
    expect(JSON.stringify(rows)).not.toContain('secret-name');
    expect(JSON.stringify(rows)).not.toContain(client.clientAddress);
  });

  it('upgrades hashes created with old parameters on successful sign-in', async () => {
    const user = await makeUser({ role: unprivilegedRole(), username: 'legacy' });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(TEST_PASSWORD, { log2N: 11, r: 8, p: 1 }) } });
    await signIn({ username: 'legacy', password: TEST_PASSWORD, ...client });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash.startsWith('scrypt$15$')).toBe(true);
  });
});

describe('sessions', () => {
  it('resolves a valid token and rejects tampered ones', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    const session = await createSession(db, user.id);
    expect((await resolveSessionToken(db, session.token))?.actor.id).toBe(user.id);
    expect(await resolveSessionToken(db, session.token.slice(0, -1) + (session.token.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(await resolveSessionToken(db, "' OR 1=1 --")).toBeNull();
    expect(await resolveSessionToken(db, undefined)).toBeNull();
  });

  it('expires on idle timeout and on the absolute cap, deleting the row', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    const start = new Date('2026-01-01T08:00:00Z');
    const idle = await createSession(db, user.id, start);
    expect(await resolveSessionToken(db, idle.token, new Date(start.getTime() + SESSION_IDLE_TTL_MS + 1))).toBeNull();
    expect(await db.session.count({ where: { id: idle.id } })).toBe(0);

    // Active every day, it still ends at the absolute cap.
    const busy = await createSession(db, user.id, start);
    for (let day = 1; day * 86_400_000 < SESSION_ABSOLUTE_TTL_MS; day += 1) {
      expect(await resolveSessionToken(db, busy.token, new Date(start.getTime() + day * 86_400_000))).not.toBeNull();
    }
    expect(await resolveSessionToken(db, busy.token, new Date(start.getTime() + SESSION_ABSOLUTE_TTL_MS + 1))).toBeNull();
  });

  it('ends every session immediately when the user is disabled', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    const a = await createSession(db, user.id);
    await createSession(db, user.id);
    await db.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
    expect(await resolveSessionToken(db, a.token)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('changing one’s own password', () => {
  it('requires the current password, clears mustChangePassword, and ends other sessions only', async () => {
    const user = await makeUser({ role: unprivilegedRole(), mustChangePassword: true, username: 'newcomer' });
    const current = await createSession(db, user.id);
    const other = await createSession(db, user.id);

    expect(
      await caught(() => changeOwnPassword(user, current.id, { currentPassword: 'not-it-at-all', newPassword: 'a brand new phrase' })),
    ).toMatchObject({ category: 'validation' });

    await changeOwnPassword(user, current.id, { currentPassword: TEST_PASSWORD, newPassword: 'a brand new phrase' });

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(await resolveSessionToken(db, current.token)).not.toBeNull();
    expect(await resolveSessionToken(db, other.token)).toBeNull();
    const signedIn = await signIn({ username: 'newcomer', password: 'a brand new phrase', clientAddress: 'x' });
    expect(signedIn.actor.mustChangePassword).toBe(false);

    const audit = await db.auditEvent.findFirstOrThrow({ where: { action: 'auth.password_changed' } });
    expect(JSON.stringify(audit)).not.toContain('brand new');
  });

  it('refuses reusing the current password and weak passwords', async () => {
    const user = await makeUser({ role: unprivilegedRole(), username: 'reuse' });
    const session = await createSession(db, user.id);
    expect(await caught(() => changeOwnPassword(user, session.id, { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }))).toMatchObject({ category: 'validation' });
    expect(await caught(() => changeOwnPassword(user, session.id, { currentPassword: TEST_PASSWORD, newPassword: '1234567890' }))).toMatchObject({ category: 'validation' });
  });
});
