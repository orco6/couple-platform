/**
 * SAMPLE DOMAIN — customers.
 *
 * Demonstrates the core patterns a real entity needs:
 *   • structural scoping (staff see only customers they own)
 *   • field-level permission (reassigning the owner needs customers.edit_all)
 *   • strict input schemas (unknown fields rejected → no mass assignment)
 *   • archive / restore with reason, audited in the same transaction
 */

import { z } from 'zod';
import { assertCan, can, scopeWhere } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import { diffForAudit } from '@/core/audit/redact';
import { activeOnly, archivedOnly, archiveFields, restoreFields } from '@/core/db/history';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import { fields } from '@/core/validation/fields';
import type { SortState } from '@/core/ui/sorting';
import type { Prisma } from '@/generated/prisma/client';

export function customerScope(actor: Actor): Prisma.CustomerWhereInput {
  return scopeWhere(actor, { all: 'customers.read_all', own: { ownerId: actor.id } });
}

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  city: true,
  ownerId: true,
  archivedAt: true,
  archiveReason: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
} satisfies Prisma.CustomerSelect;

type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;

export interface CustomerView {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  owner: { id: string; name: string };
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: { edit: boolean; reassign: boolean; archive: boolean };
}

function toView(row: CustomerRow, actor: Actor): CustomerView {
  const editable = can(actor, 'customers.edit_all') || row.ownerId === actor.id;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    owner: row.owner,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archiveReason: row.archiveReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissions: {
      edit: editable && !row.archivedAt,
      reassign: can(actor, 'customers.edit_all'),
      archive: can(actor, 'customers.archive'),
    },
  };
}

/** Sortable list columns. The mapping to orderBy stays here, next to the scoped query. */
export const CUSTOMER_SORT_KEYS = ['name', 'city', 'createdAt'] as const;
export const CUSTOMER_DEFAULT_SORT: SortState<(typeof CUSTOMER_SORT_KEYS)[number]> = { key: 'name', dir: 'asc' };

function customerOrderBy(key: (typeof CUSTOMER_SORT_KEYS)[number], dir: 'asc' | 'desc'): Prisma.CustomerOrderByWithRelationInput {
  switch (key) {
    case 'name':
      return { name: dir };
    case 'city':
      return { city: { sort: dir, nulls: 'last' } };
    case 'createdAt':
      return { createdAt: dir };
  }
}

export const customerListQuerySchema = z
  .object({
    q: z.string().max(100).optional(),
    owner: z.enum(['mine', 'all']).optional(),
    cursor: z.string().max(40).optional(),
    sort: z.enum(CUSTOMER_SORT_KEYS).optional(),
    dir: z.enum(['asc', 'desc']).optional(),
  })
  .strict();

const PAGE_SIZE = 50;

export async function listCustomers(
  client: DbClient,
  actor: Actor,
  query: z.infer<typeof customerListQuerySchema>,
): Promise<{ customers: CustomerView[]; nextCursor: string | null }> {
  const search = query.q?.trim();
  const rows = await client.customer.findMany({
    where: {
      AND: [
        customerScope(actor),
        activeOnly,
        query.owner === 'mine' ? { ownerId: actor.id } : {},
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    select: CUSTOMER_SELECT,
    // Unique tie-breaker last: stable cursor pagination under any sort.
    orderBy: [customerOrderBy(query.sort ?? CUSTOMER_DEFAULT_SORT.key, query.dir ?? CUSTOMER_DEFAULT_SORT.dir), { id: 'asc' }],
    take: PAGE_SIZE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE);
  return {
    customers: page.map((row) => toView(row, actor)),
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

/** By id, within scope. Out of scope and nonexistent are the same answer: 404. */
export async function getCustomer(
  client: DbClient,
  actor: Actor,
  id: string,
  options: { includeArchived?: boolean } = {},
): Promise<CustomerView> {
  const row = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id }, options.includeArchived ? {} : activeOnly] },
    select: CUSTOMER_SELECT,
  });
  if (!row) throw errors.notFound('הלקוח לא נמצא.');
  return toView(row, actor);
}

export const createCustomerSchema = z
  .object({
    name: fields.text({ label: 'שם הלקוח', min: 2, max: 120 }),
    phone: fields.optionalPhone(),
    email: fields.optionalEmail(),
    city: fields.optionalText({ label: 'עיר', max: 80 }),
    ownerId: fields.optionalId(),
  })
  .strict();

export async function createCustomer(
  client: DbClient,
  actor: Actor,
  input: z.infer<typeof createCustomerSchema>,
): Promise<CustomerView> {
  assertCan(actor, 'customers.create');
  const ownerId = input.ownerId ?? actor.id;
  if (ownerId !== actor.id) {
    assertCan(actor, 'customers.edit_all');
    await assertActiveUser(client, ownerId);
  }

  return inTransaction(client, async (tx) => {
    const row = await tx.customer.create({
      data: { name: input.name, phone: input.phone, email: input.email, city: input.city, ownerId, createdById: actor.id },
      select: CUSTOMER_SELECT,
    });
    await recordAudit(tx, {
      actor,
      action: 'customer.created',
      entityType: 'customer',
      entityId: row.id,
      after: { name: row.name, phone: row.phone, email: row.email, city: row.city, ownerId: row.ownerId },
    });
    return toView(row, actor);
  });
}

export const updateCustomerSchema = z
  .object({
    name: fields.text({ label: 'שם הלקוח', min: 2, max: 120 }).optional(),
    phone: fields.optionalPhone(),
    email: fields.optionalEmail(),
    city: fields.optionalText({ label: 'עיר', max: 80 }),
    ownerId: fields.id().optional(),
  })
  .strict();

export async function updateCustomer(
  client: DbClient,
  actor: Actor,
  id: string,
  input: z.infer<typeof updateCustomerSchema>,
): Promise<CustomerView> {
  const existing = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id }, activeOnly] },
    select: CUSTOMER_SELECT,
  });
  if (!existing) throw errors.notFound('הלקוח לא נמצא.');
  if (existing.ownerId !== actor.id) assertCan(actor, 'customers.edit_all');
  if (input.ownerId !== undefined && input.ownerId !== existing.ownerId) {
    assertCan(actor, 'customers.edit_all');
    await assertActiveUser(client, input.ownerId);
  }

  return inTransaction(client, async (tx) => {
    const row = await tx.customer.update({
      where: { id },
      data: {
        name: input.name,
        // Optional fields: undefined = not sent (leave unchanged), null = cleared.
        phone: input.phone,
        email: input.email,
        city: input.city,
        ownerId: input.ownerId,
      },
      select: CUSTOMER_SELECT,
    });
    const pick = (r: CustomerRow) => ({ name: r.name, phone: r.phone, email: r.email, city: r.city, ownerId: r.ownerId });
    const changes = diffForAudit(pick(existing), pick(row));
    if (changes) await recordAudit(tx, { actor, action: 'customer.updated', entityType: 'customer', entityId: id, ...changes });
    return toView(row, actor);
  });
}

export async function archiveCustomer(client: DbClient, actor: Actor, id: string, reason: string | null): Promise<void> {
  assertCan(actor, 'customers.archive');
  const existing = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id }, activeOnly] },
    select: { id: true },
  });
  if (!existing) throw errors.notFound('הלקוח לא נמצא.');

  await inTransaction(client, async (tx) => {
    await tx.customer.update({ where: { id }, data: archiveFields(actor.id, reason) });
    await recordAudit(tx, { actor, action: 'customer.archived', entityType: 'customer', entityId: id, reason });
  });
}

export async function restoreCustomer(client: DbClient, actor: Actor, id: string, reason: string): Promise<void> {
  assertCan(actor, 'customers.archive');
  assertCan(actor, 'archive.read');
  const existing = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id }, archivedOnly] },
    select: { id: true },
  });
  if (!existing) throw errors.notFound('הלקוח לא נמצא בארכיון.');

  await inTransaction(client, async (tx) => {
    await tx.customer.update({ where: { id }, data: restoreFields() });
    await recordAudit(tx, { actor, action: 'customer.restored', entityType: 'customer', entityId: id, reason });
  });
}

export async function listArchivedCustomers(client: DbClient, actor: Actor) {
  assertCan(actor, 'archive.read');
  const rows = await client.customer.findMany({
    where: { AND: [customerScope(actor), archivedOnly] },
    select: { ...CUSTOMER_SELECT, archivedBy: { select: { name: true } } },
    orderBy: { archivedAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => ({ ...toView(row, actor), archivedByName: row.archivedBy?.name ?? null }));
}

/** Staff members a customer can be assigned to (for pickers). */
export async function listAssignableUsers(client: DbClient) {
  return client.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

async function assertActiveUser(client: DbClient, userId: string) {
  const user = await client.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { id: true } });
  if (!user) throw errors.validation(undefined, { ownerId: 'המשתמש לא נמצא או שאינו פעיל' });
}
