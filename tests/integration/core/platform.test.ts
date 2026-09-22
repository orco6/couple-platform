/**
 * Core platform guarantees that must hold for ANY business: audit, idempotency,
 * settings, housekeeping, password-change throttling, follow-ups.
 * No sample-domain entities or role names are used here.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { changeOwnPassword } from '@/core/auth/account';
import { createSession, SESSION_ABSOLUTE_TTL_MS } from '@/core/auth/session';
import { signIn } from '@/core/auth/sign-in';
import { AuditReasonMissingError, recordAudit } from '@/core/audit/record';
import { db } from '@/core/db/client';
import { closeFollowUp, createFollowUp, listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { defineFollowUpTargets } from '@/core/follow-ups/targets';
import { runHousekeeping } from '@/core/housekeeping';
import { ABANDONED_AFTER_MS, withIdempotency } from '@/core/http/idempotency';
import { defineSetting } from '@/core/settings/define-setting';
import { listSettings, readSettingFrom, updateSetting, type SettingRegistry } from '@/core/settings/settings';
import { caught, makeUser, TEST_PASSWORD } from '../../support/factories';
import { topRole, unprivilegedRole } from '../../support/roles';

describe('audit log', () => {
  it('is append-only at the database level, even bypassing the application', async () => {
    const admin = await makeUser({ role: topRole() });
    await recordAudit(db, { actor: admin, action: 'user.updated', entityType: 'user', entityId: admin.id, after: { name: 'x' } });
    const event = await db.auditEvent.findFirstOrThrow();
    await expect(db.auditEvent.update({ where: { id: event.id }, data: { reason: 'rewritten' } })).rejects.toThrow();
    await expect(db.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET "actorLabel" = 'someone else'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent"`)).rejects.toThrow();
    expect(await db.auditEvent.count()).toBe(1);
  });

  it('refuses reason-required actions without a reason, and unknown actions', async () => {
    const admin = await makeUser({ role: topRole() });
    await expect(recordAudit(db, { actor: admin, action: 'period.reopened', entityType: 'period', entityId: 'x', reason: '  ' })).rejects.toBeInstanceOf(AuditReasonMissingError);
    await expect(recordAudit(db, { actor: admin, action: 'not.a.real.action' as never, entityType: 'x', entityId: 'x' })).rejects.toThrow();
  });

  it('records who/what/when/which and strips secrets at any depth', async () => {
    const admin = await makeUser({ role: topRole(), name: 'בעלת העסק' });
    await recordAudit(db, {
      actor: admin,
      action: 'user.updated',
      entityType: 'user',
      entityId: 'target-id',
      before: { name: 'a', passwordHash: 'scrypt$...' },
      after: { name: 'b', nested: { token: 'secret-token', sessionId: 's', ok: 1 } },
      metadata: { apiKey: 'k', note: 'fine' },
    });
    const event = await db.auditEvent.findFirstOrThrow();
    expect(event).toMatchObject({ actorId: admin.id, actorLabel: 'בעלת העסק', action: 'user.updated', entityType: 'user', entityId: 'target-id' });
    expect(event.occurredAt).toBeInstanceOf(Date);
    const stored = JSON.stringify(event);
    for (const secret of ['scrypt$', 'secret-token', '"k"', 'sessionId']) expect(stored).not.toContain(secret);
    expect(event.after).toEqual({ name: 'b', nested: { ok: 1 } });
  });

  it('password changes, sign-ins and resets never put credentials into the log', async () => {
    const user = await makeUser({ role: unprivilegedRole(), username: 'auditor-check' });
    const { session } = await signIn({ username: 'auditor-check', password: TEST_PASSWORD, clientAddress: 'x' });
    const stored = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    await changeOwnPassword(user, stored.id, { currentPassword: TEST_PASSWORD, newPassword: 'another good phrase' });
    const everything = JSON.stringify(await db.auditEvent.findMany());
    for (const secret of [TEST_PASSWORD, 'another good phrase', session.token, stored.tokenHash]) expect(everything).not.toContain(secret);
  });
});

describe('duplicate submissions (Idempotency-Key)', () => {
  const post = (key: string, body: object) =>
    new Request('http://local/api/x', { method: 'POST', headers: { 'Idempotency-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('replays the stored response for the same key and body instead of running twice', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    let runs = 0;
    const work = async () => Response.json({ id: `r${++runs}` }, { status: 201 });
    const first = await withIdempotency(post('key-aaaaaaaaaaaaaaaa', { a: 1 }), user.id, 's', work);
    const second = await withIdempotency(post('key-aaaaaaaaaaaaaaaa', { a: 1 }), user.id, 's', work);
    expect(runs).toBe(1);
    expect(await first.json()).toEqual({ id: 'r1' });
    expect(second.headers.get('Idempotent-Replay')).toBe('true');
    expect(await second.json()).toEqual({ id: 'r1' });
  });

  it('refuses the same key with a DIFFERENT body instead of replaying someone else’s result', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    const work = async () => Response.json({ ok: true }, { status: 201 });
    await withIdempotency(post('key-bbbbbbbbbbbbbbbb', { name: 'first' }), user.id, 's', work);
    expect(await caught(() => withIdempotency(post('key-bbbbbbbbbbbbbbbb', { name: 'edited' }), user.id, 's', work))).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('keys are per user: another user with the same key is unaffected (no cross-user replay)', async () => {
    const a = await makeUser({ role: unprivilegedRole() });
    const b = await makeUser({ role: unprivilegedRole() });
    let runs = 0;
    const work = async () => Response.json({ owner: runs++ }, { status: 201 });
    await withIdempotency(post('key-cccccccccccccccc', {}), a.id, 's', work);
    const other = await withIdempotency(post('key-cccccccccccccccc', {}), b.id, 's', work);
    expect(runs).toBe(2);
    expect(other.headers.get('Idempotent-Replay')).toBeNull();
  });

  it('concurrent identical submits run the work exactly once', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    let runs = 0;
    const work = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return Response.json({ ok: true }, { status: 201 });
    };
    const results = await Promise.allSettled([1, 2, 3].map(() => withIdempotency(post('key-dddddddddddddddd', {}), user.id, 's', work)));
    expect(runs).toBe(1);
    const refused = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    for (const r of refused) expect(r.reason).toMatchObject({ code: 'DUPLICATE_REQUEST' });
  });

  it('releases the key when the attempt fails, and recovers a claim abandoned by a crashed request', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    await expect(withIdempotency(post('key-eeeeeeeeeeeeeeee', {}), user.id, 's', async () => { throw new Error('boom'); })).rejects.toThrow();
    expect((await withIdempotency(post('key-eeeeeeeeeeeeeeee', {}), user.id, 's', async () => Response.json({}, { status: 201 }))).status).toBe(201);

    // A claim left pending (process died before responding).
    await db.idempotencyRecord.create({ data: { key: 'key-ffffffffffffffff', userId: user.id, scope: 's', createdAt: new Date(Date.now() - ABANDONED_AFTER_MS - 1000) } });
    const retried = await withIdempotency(post('key-ffffffffffffffff', {}), user.id, 's', async () => Response.json({ ok: 1 }, { status: 201 }));
    expect(retried.status).toBe(201);
  });

  it('never stores responses containing credentials', async () => {
    const user = await makeUser({ role: topRole() });
    const response = await withIdempotency(post('key-gggggggggggggggg', {}), user.id, 's', async () =>
      Response.json({ user: { id: 'u' }, temporaryPassword: 'abcd-efgh-jkmn' }, { status: 201 }),
    );
    expect(response.status).toBe(201);
    expect(await db.idempotencyRecord.count()).toBe(0);
  });
});

describe('settings', () => {
  const registry: SettingRegistry = {
    'test.threshold': defineSetting({
      label: 'סף',
      description: 'בדיקה',
      schema: z.number().int().min(1).max(10),
      defaultValue: 3,
      input: { kind: 'integer', min: 1, max: 10 },
    }) as never,
  };

  it('defaults without a row, validates writes, audits changes, and falls back when a stored value no longer validates', async () => {
    const admin = await makeUser({ role: topRole() });
    expect(await readSettingFrom(registry, db, 'test.threshold')).toBe(3);
    await updateSetting(db, admin, 'test.threshold', 7, registry);
    expect(await readSettingFrom(registry, db, 'test.threshold')).toBe(7);
    expect(await caught(() => updateSetting(db, admin, 'test.threshold', 99, registry))).toMatchObject({ category: 'validation' });
    expect(await caught(() => updateSetting(db, admin, '__proto__', 1, registry))).toMatchObject({ status: 404 });
    expect(await db.auditEvent.count({ where: { action: 'setting.changed' } })).toBe(1);

    await db.setting.update({ where: { key: 'test.threshold' }, data: { value: 'garbage' } });
    expect(await readSettingFrom(registry, db, 'test.threshold')).toBe(3);
  });

  it('are admin-only', async () => {
    const staff = await makeUser({ role: unprivilegedRole() });
    expect(await caught(() => listSettings(db, staff, registry))).toMatchObject({ status: 403 });
    expect(await caught(() => updateSetting(db, staff, 'test.threshold', 5, registry))).toMatchObject({ status: 403 });
  });

  it('a value changed by one test does not leak into the next (no cache; tables emptied per test)', async () => {
    expect(await db.setting.count()).toBe(0);
    expect(await readSettingFrom(registry, db, 'test.threshold')).toBe(3);
  });
});

describe('password change throttling', () => {
  it('a stolen session cannot brute-force the current password; the lock also protects sign-in', async () => {
    const user = await makeUser({ role: unprivilegedRole(), username: 'stolen' });
    const session = await createSession(db, user.id);
    for (let i = 0; i < 5; i += 1) {
      await caught(() => changeOwnPassword(user, session.id, { currentPassword: `guess-${i}-xxxxx`, newPassword: 'whatever phrase 1' }));
    }
    expect(await caught(() => changeOwnPassword(user, session.id, { currentPassword: TEST_PASSWORD, newPassword: 'whatever phrase 1' }))).toMatchObject({ status: 429 });
    expect(await caught(() => signIn({ username: 'stolen', password: TEST_PASSWORD, clientAddress: 'z' }))).toMatchObject({ status: 429 });
  });

  it('an unknown client address never becomes a shared lock for everyone', async () => {
    await makeUser({ role: unprivilegedRole(), username: 'innocent' });
    for (let i = 0; i < 60; i += 1) {
      await caught(() => signIn({ username: `spray-${i}`, password: 'wrong-password-x', clientAddress: 'unknown' }));
    }
    const { actor } = await signIn({ username: 'innocent', password: TEST_PASSWORD, clientAddress: 'unknown' });
    expect(actor.username).toBe('innocent');
  });
});

describe('housekeeping', () => {
  it('removes only expired sessions, stale throttle rows and old idempotency keys', async () => {
    const user = await makeUser({ role: unprivilegedRole() });
    await createSession(db, user.id, new Date(Date.now() - SESSION_ABSOLUTE_TTL_MS - 60_000));
    const live = await createSession(db, user.id);
    await db.loginThrottle.create({ data: { key: 'u:old', failures: 1, windowStart: new Date(0), updatedAt: new Date(Date.now() - 2 * 86_400_000) } });
    await db.idempotencyRecord.create({ data: { key: 'k'.repeat(20), userId: user.id, scope: 's', createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await recordAudit(db, { actor: user, action: 'user.updated', entityType: 'user', entityId: user.id });

    expect(await runHousekeeping(db)).toEqual({ sessions: 1, throttleRows: 1, idempotencyRecords: 1 });
    expect(await db.session.findMany({ select: { id: true } })).toEqual([{ id: live.id }]);
    expect(await db.auditEvent.count()).toBe(1);
    expect(await db.user.count()).toBe(1);
  });
});

describe('follow-ups', () => {
  // A synthetic target: "profile" records are reachable only by their owner (id === actor.id).
  const targets = defineFollowUpTargets({
    kinds: { check: 'לבדוק' },
    entities: { profile: { label: 'פרופיל', canReach: async (_client, actor, id) => id === actor.id, href: (id) => `/p/${id}` } },
  });

  it('can be raised only on reachable records with known kinds, and closed only by those involved', async () => {
    const a = await makeUser({ role: unprivilegedRole() });
    const b = await makeUser({ role: unprivilegedRole() });

    expect(await caught(() => createFollowUp(db, a, { entityType: 'profile', entityId: b.id, kind: 'check' }, targets))).toMatchObject({ status: 404 });
    expect(await caught(() => createFollowUp(db, a, { entityType: 'unknown', entityId: a.id, kind: 'check' }, targets))).toMatchObject({ status: 404 });
    expect(await caught(() => createFollowUp(db, a, { entityType: 'profile', entityId: a.id, kind: 'nope' }, targets))).toMatchObject({ category: 'validation' });
    expect(await caught(() => createFollowUp(db, a, { entityType: 'profile', entityId: a.id, kind: 'check', assigneeId: b.id }, targets))).toMatchObject({ status: 403 });

    const item = await createFollowUp(db, a, { entityType: 'profile', entityId: a.id, kind: 'check', note: 'לבדוק כתובת' }, targets);
    expect(await listOpenFollowUps(db, b)).toEqual([]);
    expect(await caught(() => closeFollowUp(db, b, item.id, 'RESOLVED', null))).toMatchObject({ status: 404 });

    await closeFollowUp(db, a, item.id, 'RESOLVED', 'טופל');
    expect(await caught(() => closeFollowUp(db, a, item.id, 'DISMISSED', null))).toMatchObject({ code: 'FOLLOW_UP_CLOSED' });
    expect(await db.auditEvent.count({ where: { entityType: 'follow_up' } })).toBe(2);
  });

  it('cannot be assigned to someone who cannot see the record (their note would leak to them)', async () => {
    const manager = await makeUser({ role: topRole() });
    const outsider = await makeUser({ role: unprivilegedRole() });
    // A synthetic record reachable only by the manager.
    const privateTargets = defineFollowUpTargets({
      kinds: { check: 'לבדוק' },
      entities: { file: { label: 'תיק', canReach: async (_client, actor, id) => id === 'private-file' && actor.id === manager.id, href: (id) => `/f/${id}` } },
    });
    const refused = await caught(() =>
      createFollowUp(db, manager, { entityType: 'file', entityId: 'private-file', kind: 'check', note: 'פרט רגיש', assigneeId: outsider.id }, privateTargets),
    );
    expect(refused.fieldErrors?.assigneeId).toBeDefined();
    expect(await db.followUp.count()).toBe(0);
    expect(await listOpenFollowUps(db, outsider)).toEqual([]);
  });
});
