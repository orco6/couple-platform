/**
 * Roles and permissions.
 *
 * MODEL
 *   • A PERMISSION is a capability: "customers.read_all", "users.manage".
 *     Code checks permissions, never role names. `if (role === 'ADMIN')` does
 *     not appear anywhere outside role definitions.
 *   • A ROLE is a named bundle of permissions, defined per business in
 *     src/domain/access.ts. Roles are stored on User as a string.
 *   • Core permissions (users, audit, settings, periods…) are fixed here.
 *     The domain adds its own and maps roles to both.
 *
 * ESCALATION RULE
 *   An actor may assign or manage a role only if that role's permissions are a
 *   subset of the actor's own. An ADMIN without "periods.close" therefore can
 *   never create an OWNER, reset an OWNER's password, or disable one.
 */

export const CORE_PERMISSIONS = {
  'users.read': 'צפייה במשתמשים',
  'users.manage': 'ניהול משתמשים ואיפוס סיסמאות',
  'audit.read': 'צפייה ביומן הפעולות',
  'settings.manage': 'ניהול הגדרות העסק',
  'archive.read': 'צפייה בארכיון ושחזור',
  'follow_ups.read_all': 'צפייה בכל פריטי המעקב',
  'follow_ups.manage_all': 'טיפול בכל פריטי המעקב',
  'periods.close': 'סגירה ופתיחה מחדש של תקופות',
} as const;

export type CorePermission = keyof typeof CORE_PERMISSIONS;

export interface RoleDefinition<P extends string> {
  label: string;
  description: string;
  /** 'all' grants every core and domain permission. */
  permissions: readonly P[] | 'all';
}

export interface AccessConfig<R extends string, DP extends string> {
  domainPermissions: Record<DP, string>;
  roles: Record<R, RoleDefinition<CorePermission | DP>>;
  /** Role pre-selected when an administrator creates a user. */
  defaultRole: NoInfer<R>;
}

export function defineAccess<const R extends string, const DP extends string>(config: AccessConfig<R, DP>) {
  type P = CorePermission | DP;

  const permissionLabels = { ...CORE_PERMISSIONS, ...config.domainPermissions } as Record<P, string>;
  const allPermissions = Object.keys(permissionLabels) as P[];
  const roleKeys = Object.keys(config.roles) as R[];

  for (const permission of Object.keys(config.domainPermissions)) {
    if (permission in CORE_PERMISSIONS) {
      throw new Error(`Domain permission "${permission}" collides with a core permission`);
    }
  }

  const grants = new Map<R, ReadonlySet<P>>(
    roleKeys.map((role) => {
      const definition = config.roles[role];
      const list = definition.permissions === 'all' ? allPermissions : definition.permissions;
      for (const permission of list) {
        if (!allPermissions.includes(permission)) {
          throw new Error(`Role "${role}" references unknown permission "${permission}"`);
        }
      }
      return [role, new Set(list)];
    }),
  );

  function isRole(value: unknown): value is R {
    return typeof value === 'string' && grants.has(value as R);
  }

  function permissionsOf(role: string): ReadonlySet<P> {
    return isRole(role) ? grants.get(role)! : new Set<P>();
  }

  function roleHas(role: string, permission: P): boolean {
    return permissionsOf(role).has(permission);
  }

  /** True when every permission of `targetRole` is also held by `actorRole`. */
  function roleCovers(actorRole: string, targetRole: string): boolean {
    if (!isRole(actorRole) || !isRole(targetRole)) return false;
    const actor = permissionsOf(actorRole);
    for (const permission of permissionsOf(targetRole)) {
      if (!actor.has(permission)) return false;
    }
    return true;
  }

  return {
    roles: roleKeys,
    permissions: allPermissions,
    defaultRole: config.defaultRole,
    isRole,
    isPermission: (value: unknown): value is P => typeof value === 'string' && allPermissions.includes(value as P),
    roleLabel: (role: string) => (isRole(role) ? config.roles[role].label : role),
    roleDescription: (role: string) => (isRole(role) ? config.roles[role].description : ''),
    permissionLabel: (permission: P) => permissionLabels[permission],
    permissionsOf,
    roleHas,
    roleCovers,
  };
}

export type AccessControl = ReturnType<typeof defineAccess>;
