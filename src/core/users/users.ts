/**
 * User administration.
 *
 * RULES ENFORCED HERE (not in the UI):
 *   • Reading users requires users.read; changing them requires users.manage.
 *   • Escalation: an actor can only create, edit, disable or reset a user whose
 *     role is covered by the actor's own permissions, and can only assign such
 *     roles (core/access/define-access.ts).
 *   • Nobody changes their own role or disables themselves.
 *   • The last active user able to manage users cannot be demoted or disabled.
 *   • Administrators never see or set a password. Creation and reset generate a
 *     temporary password on the server, return it once, and force a change.
 *   • Disabling, resetting and role changes end the target's sessions at once.
 *   • Password hashes never leave this module: every read is an explicit select.
 */

import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { access } from '@/domain/contract';
import { assertCan, can, canManageRole } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { hashPassword } from '@/core/auth/password-hash';
import { revokeUserSessions } from '@/core/auth/session';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';
import { clearFailures, usernameThrottleKey } from '@/core/auth/throttle';
import { isValidUsername, normalizeUsername } from '@/core/auth/username';
import { recordAudit } from '@/core/audit/record';
import { diffForAudit } from '@/core/audit/redact';
import { copy } from '@/core/copy';
import { inTransaction } from '@/core/db/transaction';
import { isUniqueViolation, type DbClient } from '@/core/db/types';
import { errors, type FieldErrors } from '@/core/errors/errors';
import { fields } from '@/core/validation/fields';

const USER_VIEW_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export interface UserView {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  roleLabel: string;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Whether the viewing actor may manage this user (UX hint; enforced again on write). */
  manageable: boolean;
}

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function toView(row: UserRow, actor: Actor): UserView {
  return {
    ...row,
    roleLabel: access.roleLabel(row.role),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    manageable: row.id !== actor.id && canManageRole(actor, row.role),
  };
}

export async function listUsers(client: DbClient, actor: Actor): Promise<UserView[]> {
  assertCan(actor, 'users.read');
  const rows = await client.user.findMany({
    select: USER_VIEW_SELECT,
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });
  return rows.map((row) => toView(row, actor));
}

export async function getUser(client: DbClient, actor: Actor, id: string): Promise<UserView> {
  assertCan(actor, 'users.read');
  const row = await client.user.findUnique({ where: { id }, select: USER_VIEW_SELECT });
  if (!row) throw errors.notFound(copy.users.notFound);
  return toView(row, actor);
}

/** Roles this actor may assign — drives the role picker and is re-checked on write. */
export function assignableRoles(actor: Actor) {
  if (!can(actor, 'users.manage')) return [];
  return access.roles
    .filter((role) => access.roleCovers(actor.role, role))
    .map((role) => ({ value: role, label: access.roleLabel(role), description: access.roleDescription(role) }));
}

export const createUserSchema = z
  .object({
    name: fields.text({ label: 'שם', min: 2, max: 80 }),
    username: z.string().max(64),
    email: fields.optionalEmail(),
    role: z.string().max(40),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUser(
  client: DbClient,
  actor: Actor,
  input: CreateUserInput,
): Promise<{ user: UserView; temporaryPassword: string }> {
  assertCan(actor, 'users.manage');

  const fieldErrors: FieldErrors = {};
  const username = normalizeUsername(input.username);
  if (!isValidUsername(username)) fieldErrors.username = copy.users.usernameFormat;
  if (!access.isRole(input.role)) fieldErrors.role = copy.users.unknownRole;
  if (Object.keys(fieldErrors).length > 0) throw errors.validation(undefined, fieldErrors);
  if (!canManageRole(actor, input.role)) throw errors.authorization(copy.users.cannotManageHigherRole);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const row = await inTransaction(client, async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          username,
          email: input.email,
          role: input.role,
          passwordHash,
          mustChangePassword: true,
        },
        select: USER_VIEW_SELECT,
      });
      await recordAudit(tx, {
        actor,
        action: 'user.created',
        entityType: 'user',
        entityId: created.id,
        subjectUserId: created.id,
        after: { name: created.name, username: created.username, email: created.email, role: created.role },
      });
      return created;
    });
    return { user: toView(row, actor), temporaryPassword };
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export const updateUserSchema = z
  .object({
    name: fields.text({ label: 'שם', min: 2, max: 80 }).optional(),
    email: fields.optionalEmail().optional(),
    role: z.string().max(40).optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

async function loadManageableTarget(client: DbClient, actor: Actor, id: string) {
  assertCan(actor, 'users.manage');
  const target = await client.user.findUnique({ where: { id }, select: USER_VIEW_SELECT });
  if (!target) throw errors.notFound(copy.users.notFound);
  if (!access.roleCovers(actor.role, target.role)) throw errors.authorization(copy.users.cannotManageHigherRole);
  return target;
}

export async function updateUser(client: DbClient, actor: Actor, id: string, input: UpdateUserInput): Promise<UserView> {
  const target = await loadManageableTarget(client, actor, id);

  if (input.role !== undefined && input.role !== target.role) {
    if (id === actor.id) throw errors.businessRule('CANNOT_CHANGE_OWN_ROLE', copy.users.cannotChangeOwnRole);
    if (!access.isRole(input.role)) throw errors.validation(undefined, { role: copy.users.unknownRole });
    if (!canManageRole(actor, input.role)) throw errors.authorization(copy.users.cannotManageHigherRole);
  }

  try {
    const row = await inTransaction(client, async (tx) => {
      if (input.role !== undefined && input.role !== target.role && access.roleHas(target.role, 'users.manage') && !access.roleHas(input.role, 'users.manage')) {
        await assertAnotherManagerRemains(tx, id);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { name: input.name, email: input.email, role: input.role },
        select: USER_VIEW_SELECT,
      });
      const changes = diffForAudit(
        { name: target.name, email: target.email, role: target.role },
        { name: updated.name, email: updated.email, role: updated.role },
      );
      if (changes) {
        const roleChanged = target.role !== updated.role;
        await recordAudit(tx, {
          actor,
          action: roleChanged ? 'user.role_changed' : 'user.updated',
          entityType: 'user',
          entityId: id,
          subjectUserId: id,
          ...changes,
        });
        // New permissions must apply from the next request, not the next sign-in.
        if (roleChanged) await revokeUserSessions(tx, id);
      }
      return updated;
    });
    return toView(row, actor);
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export async function setUserStatus(
  client: DbClient,
  actor: Actor,
  id: string,
  status: 'ACTIVE' | 'DISABLED',
): Promise<UserView> {
  const target = await loadManageableTarget(client, actor, id);
  if (id === actor.id && status === 'DISABLED') {
    throw errors.businessRule('CANNOT_DISABLE_SELF', copy.users.cannotDisableSelf);
  }
  if (target.status === status) return toView(target, actor);

  const row = await inTransaction(client, async (tx) => {
    if (status === 'DISABLED' && access.roleHas(target.role, 'users.manage')) {
      await assertAnotherManagerRemains(tx, id);
    }
    const updated = await tx.user.update({ where: { id }, data: { status }, select: USER_VIEW_SELECT });
    if (status === 'DISABLED') await revokeUserSessions(tx, id);
    await recordAudit(tx, {
      actor,
      action: status === 'DISABLED' ? 'user.disabled' : 'user.enabled',
      entityType: 'user',
      entityId: id,
      subjectUserId: id,
      before: { status: target.status },
      after: { status },
    });
    return updated;
  });
  return toView(row, actor);
}

/**
 * Administrator password reset. Returns the new temporary password ONCE.
 * Ends every session of the target (if the reset is because the account was
 * compromised, the attacker's session must die too) and clears a sign-in lock.
 */
export async function resetUserPassword(
  client: DbClient,
  actor: Actor,
  id: string,
): Promise<{ temporaryPassword: string }> {
  const target = await loadManageableTarget(client, actor, id);
  if (id === actor.id) {
    // Use the account screen, which requires the current password.
    throw errors.businessRule('USE_ACCOUNT_SCREEN', copy.errors.authorization);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await inTransaction(client, async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await revokeUserSessions(tx, id);
    await clearFailures(tx, usernameThrottleKey(target.username));
    await recordAudit(tx, {
      actor,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: id,
      subjectUserId: id,
    });
  });

  return { temporaryPassword };
}

/**
 * Refuse any change that would leave nobody able to manage users.
 *
 * The acting administrator always counts as "another", so in a single request
 * this can only trip on unusual data. It exists for concurrency: two
 * administrators disabling each other at the same moment. The row lock makes
 * the second transaction wait for the first and then see its result.
 */
async function assertAnotherManagerRemains(client: DbClient, excludingUserId: string): Promise<void> {
  const managerRoles = access.roles.filter((role) => access.roleHas(role, 'users.manage'));
  await client.$queryRaw`SELECT id FROM "User" WHERE role IN (${Prisma.join(managerRoles)}) AND status = 'ACTIVE' ORDER BY id FOR UPDATE`;
  const remaining = await client.user.count({
    where: { id: { not: excludingUserId }, status: 'ACTIVE', role: { in: managerRoles } },
  });
  if (remaining === 0) throw errors.businessRule('LAST_ADMINISTRATOR', copy.users.lastAdministrator);
}

function translateUniqueViolation(error: unknown): unknown {
  if (!isUniqueViolation(error)) return error;
  const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? '');
  if (target.includes('email')) return errors.validation(undefined, { email: copy.users.emailTaken });
  return errors.validation(undefined, { username: copy.users.usernameTaken });
}
