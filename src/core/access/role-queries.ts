/**
 * Questions about the domain's roles that generic code (fixtures, bootstrap,
 * core tests) must answer without knowing role names.
 */

import { access, type Permission } from '@/domain/contract';

/** Roles holding a permission. */
export function rolesWith(permission: Permission): string[] {
  return access.roles.filter((role) => access.roleHas(role, permission));
}

/** Roles lacking a permission. */
export function rolesWithout(permission: Permission): string[] {
  return access.roles.filter((role) => !access.roleHas(role, permission));
}

/** Roles that cover every other role (can manage anyone). Usually exactly one: the owner. */
export function topRoles(): string[] {
  return access.roles.filter((candidate) => access.roles.every((other) => access.roleCovers(candidate, other)));
}

/** The role with the fewest permissions (ties: first declared). */
export function leastPrivilegedRole(): string {
  return [...access.roles].sort((a, b) => access.permissionsOf(a).size - access.permissionsOf(b).size)[0]!;
}
