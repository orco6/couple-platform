/**
 * Permission checks and structural scoping.
 *
 * PRIVACY IS STRUCTURAL: the database query itself must only return what the
 * actor may see. `scopeWhere` builds that filter; services AND it into every
 * list and every by-id lookup. A record outside scope is indistinguishable
 * from a record that does not exist (404, never 403).
 *
 *   const where = { AND: [scopeWhere(actor, { all: 'customers.read_all', own: { ownerId: actor.id } }), { id }] };
 *   const customer = await db.customer.findFirst({ where });
 *   if (!customer) throw errors.notFound();
 *
 * Hiding a button in React is UX. These checks are security.
 */

import { access, type Permission } from '@/domain/contract';
import { errors } from '@/core/errors/errors';
import type { Actor } from '@/core/auth/actor';

export type { Permission };

export function can(actor: Pick<Actor, 'role'>, permission: Permission): boolean {
  return access.roleHas(actor.role, permission);
}

export function assertCan(actor: Pick<Actor, 'role'>, permission: Permission): void {
  if (!can(actor, permission)) throw errors.authorization();
}

/** Bound helper for lifecycle checks and UI flags. */
export function permissionChecker(actor: Pick<Actor, 'role'>) {
  return (permission: Permission) => can(actor, permission);
}

/**
 * A where-clause fragment limiting rows to what the actor may reach.
 * With the `all` permission: no restriction. Otherwise: the `own` filter.
 */
export function scopeWhere<W extends object>(
  actor: Pick<Actor, 'role'>,
  rule: { all: Permission; own: W },
): W | Record<string, never> {
  return can(actor, rule.all) ? {} : rule.own;
}

/**
 * Whether the actor may manage a user holding `targetRole` — the escalation
 * rule from define-access.ts, plus the base permission.
 */
export function canManageRole(actor: Pick<Actor, 'role'>, targetRole: string): boolean {
  return can(actor, 'users.manage') && access.roleCovers(actor.role, targetRole);
}
