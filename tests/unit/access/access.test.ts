/**
 * The access model of a couple — BUSINESS_RULES.md §1.
 *
 * These assert the *shape* of a two-person product: both partners can do
 * everything about the shared day, only the owner administers, and no
 * permission anywhere opens the reveal rule.
 */

import { describe, expect, it } from 'vitest';

import { access } from '@/domain/access';
import { copy } from '@/domain/copy';

describe('R-ACC-01 both partners hold the whole shared day', () => {
  const shared = [
    'tasks.read',
    'tasks.create',
    'tasks.edit',
    'tasks.complete',
    'tasks.archive',
    'day_entries.submit',
    'day_entries.read',
    'summaries.read',
  ] as const;

  it.each(shared)('OWNER and PARTNER both hold %s', (permission) => {
    expect(access.roleHas('OWNER', permission)).toBe(true);
    expect(access.roleHas('PARTNER', permission)).toBe(true);
  });
});

describe('R-ACC-02 the owner administers, the partner does not', () => {
  it('only OWNER manages users', () => {
    expect(access.roleHas('OWNER', 'users.manage')).toBe(true);
    expect(access.roleHas('PARTNER', 'users.manage')).toBe(false);
  });

  it('only OWNER changes the shared settings', () => {
    expect(access.roleHas('OWNER', 'settings.manage')).toBe(true);
    expect(access.roleHas('PARTNER', 'settings.manage')).toBe(false);
  });

  it('the management hierarchy runs one way only', () => {
    expect(access.roleCovers('OWNER', 'PARTNER')).toBe(true);
    expect(access.roleCovers('PARTNER', 'OWNER')).toBe(false);
  });

  it('a newly invited person is a partner, not an owner', () => {
    expect(access.defaultRole).toBe('PARTNER');
  });
});

describe('R-ACC-03 the audit log is the owner-only surface', () => {
  it('PARTNER cannot read the audit log', () => {
    // The log records that a day was closed. Even without ratings in the
    // payload (R-DAY-30), the list of who closed what when is not something
    // one partner should be able to read about the other.
    expect(access.roleHas('PARTNER', 'audit.read')).toBe(false);
    expect(access.roleHas('OWNER', 'audit.read')).toBe(true);
  });
});

describe('R-ACC-04 no permission opens the reveal rule', () => {
  it('there is no permission for reading another partner’s entries', () => {
    // If this fails, someone added a permission that the service could be
    // tempted to check instead of the reveal state. Read R-DAY-05 first: the
    // gate is symmetric and deliberately not grantable.
    const suspicious = access.permissions.filter(
      (permission) => permission.startsWith('day_entries.') && permission.endsWith('_all'),
    );
    expect(suspicious).toEqual([]);
  });

  it('the roles are exactly the two partners', () => {
    expect([...access.roles].sort()).toEqual(['OWNER', 'PARTNER']);
  });
});

describe('D-8 the domain copy is a complete dictionary', () => {
  it('every permission has a Hebrew label', () => {
    for (const permission of access.permissions) {
      expect(access.permissionLabel(permission)).toMatch(/\S/);
    }
  });

  it('both roles have a label and a description', () => {
    for (const role of access.roles) {
      expect(access.roleLabel(role)).toMatch(/\S/);
      expect(access.roleDescription(role)).toMatch(/\S/);
    }
  });

  it('the five rating steps are all worded', () => {
    // The scale is learned once and reused for both ratings, so a missing
    // step would silently render "undefined" on the dial.
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(copy.day.scale[step]).toMatch(/\S/);
    }
  });

  it('copy carries no banned filler', () => {
    // The playbook's copy rules. Checked structurally so a later edit cannot
    // quietly reintroduce marketing voice into a two-person app.
    const banned = ['ברוכים הבאים', 'Welcome back', 'כל מה שצריך במקום אחד', '!', '🎉', '👋'];
    const flat = JSON.stringify(copy);
    for (const phrase of banned) {
      expect(flat).not.toContain(phrase);
    }
  });
});
