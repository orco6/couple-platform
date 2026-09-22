/**
 * Role discovery for CORE tests. Core tests must pass for any business's role
 * model, so they never name roles — they ask for roles with the properties a
 * test needs. The sample-domain tests are free to use role names.
 */

import { access } from '@/domain/contract';
import { rolesWith, rolesWithout, topRoles } from '@/core/access/role-queries';

/** A role that can manage every other role (always exists: bootstrap requires it). */
export function topRole(): string {
  const role = topRoles()[0];
  if (!role) throw new Error('The domain must declare a role that covers every other role (see src/domain/access.ts).');
  return role;
}

/** A role that cannot read or manage users — an ordinary member of staff. */
export function unprivilegedRole(): string {
  const role = rolesWithout('users.read').sort((a, b) => access.permissionsOf(a).size - access.permissionsOf(b).size)[0];
  if (!role) throw new Error('Expected at least one role without users.read.');
  return role;
}

/**
 * A pair (manager, protected) where manager holds users.manage but does NOT
 * cover protected. Null when the domain has only one level of user managers
 * (then escalation is covered by the synthetic unit test).
 */
export function escalationPair(): { manager: string; protectedRole: string } | null {
  for (const manager of rolesWith('users.manage')) {
    const protectedRole = access.roles.find((role) => !access.roleCovers(manager, role));
    if (protectedRole) return { manager, protectedRole };
  }
  return null;
}
