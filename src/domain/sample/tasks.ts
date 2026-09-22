/**
 * SAMPLE DOMAIN — tasks.
 *
 * Demonstrates:
 *   • scope with two ownership paths (assigned to me OR on my customer)
 *   • lifecycle transitions with permission and reason
 *   • money: integer agorot, VAT rate frozen on the row when priced
 *   • business date (completedOn) distinct from updatedAt
 *   • period lock: a DONE task in a closed revenue month cannot change
 *   • optimistic concurrency (version) → 409 STALE_WRITE on a stale edit
 */

import { z } from 'zod';
import { assertCan, can, permissionChecker } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import { diffForAudit } from '@/core/audit/redact';
import {
  compareCalendarDates,
  fromDbDateOrNull,
  todayIn,
  toDbDate,
  type CalendarDate,
} from '@/core/dates/calendar-date';
import { formatPeriod, periodOf } from '@/core/dates/period';
import { activeOnly, archivedOnly, archiveFields, restoreFields } from '@/core/db/history';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import { vatFromNet, type VatBreakdown } from '@/core/money/vat';
import { assertPeriodOpen, getPeriodState } from '@/core/periods/periods';
import { getSetting } from '@/core/settings/settings';
import { fields } from '@/core/validation/fields';
import type { Prisma } from '@/generated/prisma/client';
import { customerScope } from './customers';
import { taskLifecycle, type TaskStatus } from './task-lifecycle';

export const REVENUE_SCOPE = 'revenue';

export function taskScope(actor: Actor): Prisma.TaskWhereInput {
  if (can(actor, 'tasks.read_all')) return {};
  return { OR: [{ assigneeId: actor.id }, { customer: { ownerId: actor.id } }] };
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueDate: true,
  completedOn: true,
  priceAgorot: true,
  vatRateBps: true,
  version: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  assigneeId: true,
  assignee: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, ownerId: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  statusLabel: string;
  dueDate: CalendarDate | null;
  /** Open work whose due date is before today in the business timezone. Computed here, not in JSX. */
  overdue: boolean;
  completedOn: CalendarDate | null;
  price: VatBreakdown | null;
  version: number;
  archivedAt: string | null;
  assignee: { id: string; name: string } | null;
  customer: { id: string; name: string };
  updatedAt: string;
  /**
   * The closed revenue month this completed task belongs to, if any. The UI shows
   * why status, price and assignee cannot change instead of offering actions the
   * server will refuse (assertPeriodOpen remains the authority).
   */
  lockedPeriod: string | null;
  permissions: {
    edit: boolean;
    setPrice: boolean;
    reassign: boolean;
    archive: boolean;
    transitions: Array<{ to: TaskStatus; label: string; requiresReason: boolean }>;
  };
}

function toView(row: TaskRow, actor: Actor, lockedPeriod: string | null = null): TaskView {
  const status = row.status as TaskStatus;
  const active = !row.archivedAt;
  const open = active && lockedPeriod === null;
  const check = permissionChecker(actor);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    statusLabel: taskLifecycle.label(status),
    dueDate: fromDbDateOrNull(row.dueDate),
    overdue:
      (status === 'OPEN' || status === 'IN_PROGRESS') &&
      row.dueDate !== null &&
      compareCalendarDates(fromDbDateOrNull(row.dueDate)!, todayIn()) < 0,
    completedOn: fromDbDateOrNull(row.completedOn),
    price: row.priceAgorot !== null && row.vatRateBps !== null ? vatFromNet(row.priceAgorot, row.vatRateBps) : null,
    version: row.version,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    assignee: row.assignee,
    customer: { id: row.customer.id, name: row.customer.name },
    updatedAt: row.updatedAt.toISOString(),
    lockedPeriod,
    permissions: {
      edit: active,
      setPrice: open && can(actor, 'tasks.set_price'),
      reassign: open && can(actor, 'tasks.edit_all'),
      archive: active && can(actor, 'tasks.archive'),
      transitions: open
        ? taskLifecycle.available(status, { can: check }).map((t) => ({
            to: t.to,
            label: t.label ?? taskLifecycle.label(t.to),
            requiresReason: t.requiresReason === true,
          }))
        : [],
    },
  };
}

export const taskListQuerySchema = z
  .object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'active']).optional(),
    assignee: z.enum(['me', 'all']).optional(),
    q: z.string().max(100).optional(),
    cursor: z.string().max(40).optional(),
  })
  .strict();

const PAGE_SIZE = 50;

export async function listTasks(client: DbClient, actor: Actor, query: z.infer<typeof taskListQuerySchema>) {
  const status = query.status ?? 'active';
  const search = query.q?.trim();
  const rows = await client.task.findMany({
    where: {
      AND: [
        taskScope(actor),
        activeOnly,
        status === 'active' ? { status: { in: ['OPEN', 'IN_PROGRESS'] } } : { status },
        query.assignee === 'me' ? { assigneeId: actor.id } : {},
        search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }] } : {},
      ],
    },
    select: TASK_SELECT,
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
    take: PAGE_SIZE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, PAGE_SIZE);
  return { tasks: page.map((row) => toView(row, actor)), nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null };
}

export async function listTasksForCustomer(client: DbClient, actor: Actor, customerId: string) {
  const rows = await client.task.findMany({
    where: { AND: [taskScope(actor), activeOnly, { customerId }] },
    select: TASK_SELECT,
    orderBy: [{ status: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
    take: 200,
  });
  return rows.map((row) => toView(row, actor));
}

async function findInScope(client: DbClient, actor: Actor, id: string, archived = false) {
  const row = await client.task.findFirst({
    where: { AND: [taskScope(actor), { id }, archived ? archivedOnly : activeOnly] },
    select: TASK_SELECT,
  });
  if (!row) throw errors.notFound('המשימה לא נמצאה.');
  return row;
}

/** Detail view: also reports a closed revenue month, so the screen offers only what the server will accept. */
export async function getTask(client: DbClient, actor: Actor, id: string): Promise<TaskView> {
  const row = await findInScope(client, actor, id);
  const completedOn = fromDbDateOrNull(row.completedOn);
  const period = completedOn ? await getPeriodState(client, REVENUE_SCOPE, periodOf(completedOn)) : null;
  return toView(row, actor, period?.isClosed ? formatPeriod(period.period) : null);
}

export const createTaskSchema = z
  .object({
    customerId: fields.id(),
    title: fields.text({ label: 'כותרת', min: 2, max: 160 }),
    description: fields.optionalText({ label: 'תיאור', max: 4000, multiline: true }),
    dueDate: fields.optionalCalendarDate(),
    assigneeId: fields.optionalId(),
    priceAgorot: fields.optionalMoney(),
  })
  .strict();

export async function createTask(client: DbClient, actor: Actor, input: z.infer<typeof createTaskSchema>): Promise<TaskView> {
  assertCan(actor, 'tasks.create');

  const customer = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id: input.customerId }, activeOnly] },
    select: { id: true },
  });
  if (!customer) throw errors.validation(undefined, { customerId: 'הלקוח לא נמצא' });

  const assigneeId = input.assigneeId ?? actor.id;
  if (assigneeId !== actor.id) {
    assertCan(actor, 'tasks.edit_all');
    const assignee = await client.user.findFirst({ where: { id: assigneeId, status: 'ACTIVE' }, select: { id: true } });
    if (!assignee) throw errors.validation(undefined, { assigneeId: 'המשתמש לא נמצא או שאינו פעיל' });
  }
  if (input.priceAgorot != null) assertCan(actor, 'tasks.set_price');

  return inTransaction(client, async (tx) => {
    const vatRateBps = input.priceAgorot != null ? await getSetting(tx, 'vat.default_rate_bps') : null;
    const row = await tx.task.create({
      data: {
        customerId: input.customerId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
        assigneeId,
        priceAgorot: input.priceAgorot,
        vatRateBps,
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: TASK_SELECT,
    });
    await recordAudit(tx, {
      actor,
      action: 'task.created',
      entityType: 'task',
      entityId: row.id,
      after: { title: row.title, dueDate: input.dueDate, assigneeId, priceAgorot: row.priceAgorot, vatRateBps },
      metadata: { customerId: input.customerId },
    });
    return toView(row, actor);
  });
}

export const updateTaskSchema = z
  .object({
    version: fields.version(),
    title: fields.text({ label: 'כותרת', min: 2, max: 160 }).optional(),
    description: fields.optionalText({ label: 'תיאור', max: 4000, multiline: true }),
    dueDate: fields.optionalCalendarDate(),
    assigneeId: fields.optionalId(),
    priceAgorot: fields.optionalMoney(),
  })
  .strict();

export async function updateTask(
  client: DbClient,
  actor: Actor,
  id: string,
  input: z.infer<typeof updateTaskSchema>,
): Promise<TaskView> {
  const existing = await findInScope(client, actor, id);

  const priceChanging = input.priceAgorot !== undefined && input.priceAgorot !== existing.priceAgorot;
  const assigneeChanging = input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId;
  if (priceChanging) assertCan(actor, 'tasks.set_price');
  if (assigneeChanging) {
    assertCan(actor, 'tasks.edit_all');
    if (input.assigneeId) {
      const assignee = await client.user.findFirst({ where: { id: input.assigneeId, status: 'ACTIVE' }, select: { id: true } });
      if (!assignee) throw errors.validation(undefined, { assigneeId: 'המשתמש לא נמצא או שאינו פעיל' });
    }
  }

  return inTransaction(client, async (tx) => {
    // A priced, completed task belongs to a revenue month; its money is frozen once that month closes.
    // Price AND assignee both decide the month's figures (revenue is grouped by assignee).
    if ((priceChanging || assigneeChanging) && existing.completedOn) {
      await assertPeriodOpen(tx, REVENUE_SCOPE, periodOf(fromDbDateOrNull(existing.completedOn)!));
    }

    const vatRateBps = priceChanging
      ? input.priceAgorot == null
        ? null
        : await getSetting(tx, 'vat.default_rate_bps')
      : undefined;

    const result = await tx.task.updateMany({
      where: { id, version: input.version },
      data: {
        title: input.title,
        description: input.description,
        dueDate: input.dueDate === undefined ? undefined : input.dueDate ? toDbDate(input.dueDate) : null,
        assigneeId: assigneeChanging ? input.assigneeId : undefined,
        priceAgorot: priceChanging ? input.priceAgorot : undefined,
        vatRateBps,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) throw errors.staleWrite();

    const row = await tx.task.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });
    const pick = (r: TaskRow) => ({
      title: r.title,
      description: r.description,
      dueDate: fromDbDateOrNull(r.dueDate),
      assigneeId: r.assigneeId,
      priceAgorot: r.priceAgorot,
      vatRateBps: r.vatRateBps,
    });
    const changes = diffForAudit(pick(existing), pick(row));
    if (changes) await recordAudit(tx, { actor, action: 'task.updated', entityType: 'task', entityId: id, ...changes });
    return toView(row, actor);
  });
}

export const transitionTaskSchema = z
  .object({
    version: fields.version(),
    to: fields.oneOf(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
    /** Business date of completion; defaults to today in the business timezone. */
    completedOn: fields.optionalCalendarDate(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export async function transitionTask(
  client: DbClient,
  actor: Actor,
  id: string,
  input: z.infer<typeof transitionTaskSchema>,
): Promise<TaskView> {
  const existing = await findInScope(client, actor, id);
  const from = existing.status as TaskStatus;
  const reason = input.reason?.trim() || null;
  const transition = taskLifecycle.assertTransition(from, input.to, { can: permissionChecker(actor), reason });

  let completedOn: CalendarDate | null = fromDbDateOrNull(existing.completedOn);
  if (input.to === 'DONE') {
    const today = todayIn();
    completedOn = input.completedOn ?? today;
    if (compareCalendarDates(completedOn, today) > 0) {
      throw errors.validation(undefined, { completedOn: 'תאריך הביצוע לא יכול להיות בעתיד' });
    }
  } else {
    completedOn = null;
  }

  return inTransaction(client, async (tx) => {
    // Leaving DONE removes revenue from the old month; entering DONE adds it to the new one.
    const previousCompletion = fromDbDateOrNull(existing.completedOn);
    if (previousCompletion) await assertPeriodOpen(tx, REVENUE_SCOPE, periodOf(previousCompletion));
    if (completedOn) await assertPeriodOpen(tx, REVENUE_SCOPE, periodOf(completedOn));

    const result = await tx.task.updateMany({
      where: { id, version: input.version },
      data: {
        status: input.to,
        completedOn: completedOn ? toDbDate(completedOn) : null,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) throw errors.staleWrite();

    await recordAudit(tx, {
      actor,
      action: transition.name === 'reopen' ? 'task.reopened' : 'task.status_changed',
      entityType: 'task',
      entityId: id,
      before: { status: from, completedOn: previousCompletion },
      after: { status: input.to, completedOn },
      reason,
    });
    return toView(await tx.task.findUniqueOrThrow({ where: { id }, select: TASK_SELECT }), actor);
  });
}

export async function archiveTask(client: DbClient, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'tasks.archive');
  await findInScope(client, actor, id);
  await inTransaction(client, async (tx) => {
    const { archiveReason: _unused, ...data } = archiveFields(actor.id, null);
    await tx.task.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    await recordAudit(tx, { actor, action: 'task.archived', entityType: 'task', entityId: id });
  });
}

export async function restoreTask(client: DbClient, actor: Actor, id: string, reason: string): Promise<void> {
  assertCan(actor, 'tasks.archive');
  assertCan(actor, 'archive.read');
  await findInScope(client, actor, id, true);
  await inTransaction(client, async (tx) => {
    const { archiveReason: _unused, ...data } = restoreFields();
    await tx.task.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    await recordAudit(tx, { actor, action: 'task.restored', entityType: 'task', entityId: id, reason });
  });
}

export async function listArchivedTasks(client: DbClient, actor: Actor) {
  assertCan(actor, 'archive.read');
  const rows = await client.task.findMany({
    where: { AND: [taskScope(actor), archivedOnly] },
    select: { ...TASK_SELECT, archivedBy: { select: { name: true } } },
    orderBy: { archivedAt: 'desc' },
    take: 200,
  });
  return rows.map((row) => ({ ...toView(row, actor), archivedByName: row.archivedBy?.name ?? null }));
}
