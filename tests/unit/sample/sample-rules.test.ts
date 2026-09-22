/**
 * SAMPLE DOMAIN unit tests — delete with the sample.
 */

import { describe, expect, it } from 'vitest';
import { can } from '@/core/access/can';
import { updateCustomerSchema } from '@/domain/sample/customers';
import { calculateRevenue } from '@/domain/sample/revenue';
import { taskLifecycle } from '@/domain/sample/task-lifecycle';
import { transitionTaskSchema, updateTaskSchema } from '@/domain/sample/tasks';

const as = (role: string) => ({ id: 'u1', name: 'x', username: 'x', role, mustChangePassword: false });
const check = (role: string) => (permission: Parameters<typeof can>[1]) => can(as(role), permission);

describe('sample request schemas', () => {
  it('cannot smuggle a status or completion date through the edit endpoint', () => {
    expect(updateTaskSchema.safeParse({ version: 1, status: 'DONE' }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ version: 1, completedOn: '2026-01-01' }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ name: 'x y', createdById: 'someone' }).success).toBe(false);
  });

  it('rejects an impossible completion date', () => {
    expect(transitionTaskSchema.safeParse({ version: 1, to: 'DONE', completedOn: '2026-04-31' }).success).toBe(false);
  });
});

describe('sample task lifecycle and roles', () => {
  it('staff cannot reopen finished work; managers can, with a reason', () => {
    expect(() => taskLifecycle.assertTransition('DONE', 'IN_PROGRESS', { can: check('STAFF'), reason: 'טעות' })).toThrow();
    expect(() => taskLifecycle.assertTransition('DONE', 'IN_PROGRESS', { can: check('MANAGER') })).toThrow();
    expect(taskLifecycle.assertTransition('DONE', 'IN_PROGRESS', { can: check('MANAGER'), reason: 'טעות בסימון' }).name).toBe('reopen');
  });

  it('ADMIN cannot manage OWNER (lacks periods.close)', async () => {
    const { access } = await import('@/domain/access');
    expect(access.roleCovers('ADMIN', 'OWNER')).toBe(false);
    expect(access.roleCovers('OWNER', 'ADMIN')).toBe(true);
  });
});

describe('revenue calculation', () => {
  it('groups by assignee, applies each task’s own VAT rate, and counts unpriced work separately', () => {
    const lines = calculateRevenue([
      { id: 't1', assigneeId: 'a', assigneeName: 'דנה', priceAgorot: 100_000, vatRateBps: 1700 },
      { id: 't2', assigneeId: 'a', assigneeName: 'דנה', priceAgorot: 100_000, vatRateBps: 1800 },
      { id: 't3', assigneeId: 'a', assigneeName: 'דנה', priceAgorot: null, vatRateBps: null },
      { id: 't4', assigneeId: null, assigneeName: null, priceAgorot: 50_000, vatRateBps: 1800 },
    ]);
    expect(lines[0]).toMatchObject({ assigneeId: 'a', taskCount: 3, unpricedCount: 1, net: 200_000, vat: 35_000, gross: 235_000 });
    expect(lines[1]).toMatchObject({ assigneeId: null, assigneeName: 'ללא מבצע', gross: 59_000 });
    expect(calculateRevenue([])).toEqual([]);
  });
});
