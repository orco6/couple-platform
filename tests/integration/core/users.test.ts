import { describe, expect, it } from 'vitest';
import { createSession, resolveSessionToken } from '@/core/auth/session';
import { signIn } from '@/core/auth/sign-in';
import { db } from '@/core/db/client';
import { createUser, listUsers, resetUserPassword, setUserStatus, updateUser } from '@/core/users/users';
import { caught, makeUser } from '../../support/factories';
import { escalationPair, topRole, unprivilegedRole } from '../../support/roles';

describe('user administration (role-agnostic)', () => {
  it('creates users with a one-time temporary password that must be changed and is never stored or audited', async () => {
    const admin = await makeUser({ role: topRole() });
    const { user, temporaryPassword } = await createUser(db, admin, { name: 'דנה לוי', username: 'Dana.Levi', email: null, role: unprivilegedRole() });
    expect(user.username).toBe('dana.levi');
    expect(user.mustChangePassword).toBe(true);
    expect(JSON.stringify(user)).not.toContain(temporaryPassword);

    const { actor } = await signIn({ username: 'dana.levi', password: temporaryPassword, clientAddress: 'x' });
    expect(actor.mustChangePassword).toBe(true);

    const everything = JSON.stringify([await db.auditEvent.findMany(), await db.idempotencyRecord.findMany(), await db.user.findMany()]);
    expect(everything).not.toContain(temporaryPassword);
  });

  it('never exposes password hashes in listings', async () => {
    const admin = await makeUser({ role: topRole() });
    expect(JSON.stringify(await listUsers(db, admin))).not.toMatch(/scrypt|passwordHash/);
  });

  it('refuses user administration to roles without users.manage', async () => {
    const staff = await makeUser({ role: unprivilegedRole() });
    const other = await makeUser({ role: unprivilegedRole() });
    expect(await caught(() => listUsers(db, staff))).toMatchObject({ status: 403 });
    expect(await caught(() => createUser(db, staff, { name: 'x y', username: 'sneaky', email: null, role: unprivilegedRole() }))).toMatchObject({ status: 403 });
    expect(await caught(() => resetUserPassword(db, staff, other.id))).toMatchObject({ status: 403 });
    expect(await caught(() => setUserStatus(db, staff, other.id, 'DISABLED'))).toMatchObject({ status: 403 });
    expect(await caught(() => updateUser(db, staff, staff.id, { role: topRole() }))).toMatchObject({ status: 403 });
  });

  const pair = escalationPair();
  it.skipIf(!pair)('prevents escalation between user-manager levels (when the domain has more than one)', async () => {
    const manager = await makeUser({ role: pair!.manager });
    const protectedUser = await makeUser({ role: pair!.protectedRole });
    const staff = await makeUser({ role: unprivilegedRole() });
    expect(await caught(() => createUser(db, manager, { name: 'x y', username: 'new-top', email: null, role: pair!.protectedRole }))).toMatchObject({ status: 403 });
    expect(await caught(() => updateUser(db, manager, staff.id, { role: pair!.protectedRole }))).toMatchObject({ status: 403 });
    expect(await caught(() => resetUserPassword(db, manager, protectedUser.id))).toMatchObject({ status: 403 });
    expect(await caught(() => setUserStatus(db, manager, protectedUser.id, 'DISABLED'))).toMatchObject({ status: 403 });
  });

  it('nobody can change their own role or disable themselves', async () => {
    const admin = await makeUser({ role: topRole() });
    expect(await caught(() => updateUser(db, admin, admin.id, { role: unprivilegedRole() }))).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ROLE' });
    expect(await caught(() => setUserStatus(db, admin, admin.id, 'DISABLED'))).toMatchObject({ code: 'CANNOT_DISABLE_SELF' });
  });

  it('two administrators disabling each other at the same moment cannot leave nobody in charge', async () => {
    for (let run = 0; run < 3; run += 1) {
      await db.session.deleteMany();
      await db.user.updateMany({ data: { status: 'DISABLED' } });
      const a = await makeUser({ role: topRole() });
      const b = await makeUser({ role: topRole() });
      const results = await Promise.allSettled([setUserStatus(db, a, b.id, 'DISABLED'), setUserStatus(db, b, a.id, 'DISABLED')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'LAST_ADMINISTRATOR' });
      expect(await db.user.count({ where: { status: 'ACTIVE', id: { in: [a.id, b.id] } } })).toBe(1);
    }
  });

  it('password reset ends the target’s sessions, clears a sign-in lock, and forces a change', async () => {
    const admin = await makeUser({ role: topRole() });
    const staff = await makeUser({ role: unprivilegedRole(), username: 'locked-out' });
    const session = await createSession(db, staff.id);
    for (let i = 0; i < 5; i += 1) await caught(() => signIn({ username: 'locked-out', password: `nope-${i}-xxxxx`, clientAddress: 'a' }));

    const { temporaryPassword } = await resetUserPassword(db, admin, staff.id);

    expect(await resolveSessionToken(db, session.token)).toBeNull();
    const { actor } = await signIn({ username: 'locked-out', password: temporaryPassword, clientAddress: 'b' });
    expect(actor.mustChangePassword).toBe(true);
  });

  it('role changes take effect on the next request (sessions revoked) and are audited', async () => {
    const admin = await makeUser({ role: topRole() });
    const target = await makeUser({ role: topRole() });
    const session = await createSession(db, target.id);
    await updateUser(db, admin, target.id, { role: unprivilegedRole() });
    expect(await resolveSessionToken(db, session.token)).toBeNull();
    const event = await db.auditEvent.findFirstOrThrow({ where: { action: 'user.role_changed' } });
    expect(event.before).toEqual({ role: topRole() });
    expect(event.after).toEqual({ role: unprivilegedRole() });
  });

  it('a disabled user is refused at sign-in and loses existing sessions immediately', async () => {
    const admin = await makeUser({ role: topRole() });
    const staff = await makeUser({ role: unprivilegedRole(), username: 'leaving' });
    const session = await createSession(db, staff.id);
    await setUserStatus(db, admin, staff.id, 'DISABLED');
    expect(await resolveSessionToken(db, session.token)).toBeNull();
    expect(await caught(() => signIn({ username: 'leaving', password: 'correct-horse-battery', clientAddress: 'x' }))).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects duplicate usernames with a field error, case-insensitively', async () => {
    const admin = await makeUser({ role: topRole() });
    await createUser(db, admin, { name: 'א ב', username: 'same', email: null, role: unprivilegedRole() });
    const error = await caught(() => createUser(db, admin, { name: 'ג ד', username: 'SAME', email: null, role: unprivilegedRole() }));
    expect(error).toMatchObject({ category: 'validation' });
    expect(error.fieldErrors).toHaveProperty('username');
  });

  it('refuses unknown roles', async () => {
    const admin = await makeUser({ role: topRole() });
    expect(await caught(() => createUser(db, admin, { name: 'x y', username: 'ghost-role', email: null, role: 'GOD' }))).toMatchObject({ category: 'validation' });
  });
});
