/**
 * The permission model and lifecycle helper, tested with SYNTHETIC definitions
 * so these tests hold for any business. The domain's actual role file is only
 * checked for the invariants core depends on.
 */

import { describe, expect, it } from 'vitest';
import { defineAccess } from '@/core/access/define-access';
import { topRoles } from '@/core/access/role-queries';
import { defineLifecycle } from '@/core/lifecycle/lifecycle';
import { access } from '@/domain/contract';

const model = defineAccess<'CHIEF' | 'ADMIN' | 'CLERK', 'records.read_all' | 'records.close'>({
  domainPermissions: { 'records.read_all': 'all records', 'records.close': 'close' },
  roles: {
    CHIEF: { label: 'chief', description: '', permissions: 'all' },
    ADMIN: { label: 'admin', description: '', permissions: ['users.read', 'users.manage', 'records.read_all'] },
    CLERK: { label: 'clerk', description: '', permissions: [] },
  },
  defaultRole: 'CLERK',
});

describe('permission model (synthetic)', () => {
  it('grants by permission; unknown roles get nothing', () => {
    expect(model.roleHas('CHIEF', 'periods.close')).toBe(true);
    expect(model.roleHas('ADMIN', 'records.close')).toBe(false);
    expect(model.roleHas('CLERK', 'records.read_all')).toBe(false);
    expect(model.roleHas('SUPERUSER', 'users.read')).toBe(false);
    expect(model.roleHas('', 'users.read')).toBe(false);
  });

  it('prevents escalation: a role manages only roles it fully covers', () => {
    expect(model.roleCovers('CHIEF', 'ADMIN')).toBe(true);
    expect(model.roleCovers('ADMIN', 'CHIEF')).toBe(false);
    expect(model.roleCovers('ADMIN', 'ADMIN')).toBe(true);
    expect(model.roleCovers('ADMIN', 'CLERK')).toBe(true);
    expect(model.roleCovers('ADMIN', 'NOPE')).toBe(false);
  });

  it('rejects misconfigured definitions at startup', () => {
    expect(() =>
      defineAccess({ domainPermissions: { 'users.read': 'dup' }, roles: { A: { label: 'a', description: '', permissions: [] } }, defaultRole: 'A' }),
    ).toThrow(/collides/);
    expect(() =>
      defineAccess({ domainPermissions: {}, roles: { A: { label: 'a', description: '', permissions: ['nope' as never] } }, defaultRole: 'A' }),
    ).toThrow(/unknown permission/);
  });
});

describe('the domain role file satisfies what core requires', () => {
  it('has a top role that can manage users (needed by bootstrap and emergency access)', () => {
    const top = topRoles()[0];
    expect(top, 'declare a role that covers every other role').toBeDefined();
    expect(access.roleHas(top!, 'users.manage')).toBe(true);
  });

  it('has a valid default role for new users', () => {
    expect(access.isRole(access.defaultRole)).toBe(true);
  });
});

describe('lifecycle (synthetic)', () => {
  const lifecycle = defineLifecycle<'DRAFT' | 'SUBMITTED' | 'APPROVED', 'records.close'>({
    initial: 'DRAFT',
    states: { DRAFT: { label: 'draft' }, SUBMITTED: { label: 'submitted' }, APPROVED: { label: 'approved', terminal: true } },
    transitions: [
      { name: 'submit', from: ['DRAFT'], to: 'SUBMITTED' },
      { name: 'approve', from: ['SUBMITTED'], to: 'APPROVED', permission: 'records.close' },
      { name: 'reopen', from: ['APPROVED'], to: 'DRAFT', permission: 'records.close', requiresReason: true },
    ],
  });
  const allow = () => true;
  const deny = () => false;

  it('allows only listed transitions', () => {
    expect(lifecycle.canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(lifecycle.canTransition('DRAFT', 'APPROVED')).toBe(false);
    expect(() => lifecycle.assertTransition('DRAFT', 'APPROVED', { can: allow })).toThrow();
  });

  it('enforces transition permission, and denies when no checker is supplied', () => {
    expect(() => lifecycle.assertTransition('SUBMITTED', 'APPROVED', { can: deny })).toThrow();
    expect(() => lifecycle.assertTransition('SUBMITTED', 'APPROVED')).toThrow();
    expect(lifecycle.assertTransition('SUBMITTED', 'APPROVED', { can: allow }).name).toBe('approve');
  });

  it('requires a non-blank reason where declared', () => {
    expect(() => lifecycle.assertTransition('APPROVED', 'DRAFT', { can: allow, reason: '   ' })).toThrow();
    expect(lifecycle.assertTransition('APPROVED', 'DRAFT', { can: allow, reason: 'wrong figures' }).name).toBe('reopen');
  });

  it('lists only transitions the actor may perform', () => {
    expect(lifecycle.available('APPROVED', { can: deny })).toHaveLength(0);
    expect(lifecycle.available('APPROVED', { can: allow }).map((t) => t.name)).toEqual(['reopen']);
  });

  it('rejects definitions referencing unknown states', () => {
    expect(() =>
      defineLifecycle({ initial: 'A', states: { A: { label: 'a' } }, transitions: [{ name: 'x', from: ['A'], to: 'B' as 'A' }] }),
    ).toThrow();
  });
});
