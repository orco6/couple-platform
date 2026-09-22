/**
 * THE SHARED LIST — שנינו. BUSINESS_RULES.md §2, §3, §4.
 *
 * R-TASK-01: the list is genuinely shared. There is no owner column and no
 * per-row scope, because either partner may act on any task — that is the
 * point of a shared list, not an oversight. `forWhom` is information printed
 * on the row, never a permission.
 *
 * The isolation boundary for this data is therefore the DEPLOYMENT (ADR 0009,
 * one database per business), not a where-clause. `taskScope` exists anyway,
 * returns `{}`, and is ANDed into every query — so if D-1 ever becomes "many
 * couples", there is exactly one function to change and the compiler will not
 * let a query forget it.
 */

import { z } from 'zod';

import { assertCan, permissionChecker } from '@/core/access/can';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from '@/core/auth/actor';
import { fromDbDate, toDbDate, type CalendarDate } from '@/core/dates/calendar-date';
import { localToInstant, parseLocalTime, type LocalTime } from '@/core/dates/local-time';
import { copy as coreCopy } from '@/core/copy';
import { fields } from '@/core/validation/fields';
import { activeOnly, archivedOnly, archiveFields, restoreFields } from '@/core/db/history';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import type { Prisma } from '@/generated/prisma/client';

import { copy } from '../copy';
import { taskLifecycle, taskStateOf, type TaskState } from './task-lifecycle';

/* ── Scope ─────────────────────────────────────────────────────────────── */

/**
 * Rows this actor may reach. Everything, by design — see the file header.
 * Returned as a typed empty filter so every call site reads the same as a
 * scoped one and gains a real filter the day the product needs one.
 */
export function taskScope(_actor: Pick<Actor, 'id' | 'role'>): Prisma.DailyTaskWhereInput {
  return {};
}

/* ── Request schemas ───────────────────────────────────────────────────── */

const TASK_FOR = ['ME', 'PARTNER', 'BOTH'] as const;

/**
 * "HH:MM" or cleared. Mirrors the shape of core's `optionalCalendarDate`:
 * absent = unchanged, null or "" = cleared, a value = that value.
 */
function optionalLocalTime() {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value === null ? '' : value.trim();
      return trimmed === '' ? null : trimmed;
    })
    .refine(
      (value) => value == null || (/^\d{2}:\d{2}$/.test(value) && parseLocalTime(value) !== null),
      coreCopy.validation.invalidTime,
    )
    .transform((value) => value as LocalTime | null | undefined);
}

export const createTaskSchema = z
  .object({
    title: fields.text({ label: copy.tasks.titleLabel, max: 200 }),
    forWhom: fields.oneOf(TASK_FOR),
    taskDate: fields.calendarDate(),
    dueTime: optionalLocalTime(),
    note: fields.optionalText({ label: copy.tasks.noteLabel, max: 500, multiline: true }),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    id: fields.id(),
    version: fields.version(),
    title: fields.text({ label: copy.tasks.titleLabel, max: 200 }).optional(),
    forWhom: fields.oneOf(TASK_FOR).optional(),
    taskDate: fields.optionalCalendarDate(),
    dueTime: optionalLocalTime(),
    note: fields.optionalText({ label: copy.tasks.noteLabel, max: 500, multiline: true }),
  })
  .strict();

export const taskTransitionSchema = z
  .object({
    id: fields.id(),
    version: fields.version(),
    to: fields.oneOf(['OPEN', 'COMPLETED', 'ARCHIVED']),
    // The lifecycle decides whether a reason is required; the schema only
    // decides what a reason may look like.
    reason: fields.optionalText({ label: copy.common.reason, max: 500, multiline: true }),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskTransitionInput = z.infer<typeof taskTransitionSchema>;

/* ── Views ─────────────────────────────────────────────────────────────── */

export interface TaskView {
  id: string;
  title: string;
  forWhom: (typeof TASK_FOR)[number];
  taskDate: CalendarDate;
  /** "HH:MM" in the business timezone, or null. */
  dueTime: LocalTime | null;
  note: string | null;
  state: TaskState;
  completedByName: string | null;
  completedById: string | null;
  createdByName: string;
  archiveReason: string | null;
  version: number;
  /**
   * What the server will actually accept for this row in this state. An
   * archived task offers no complete/reopen/edit, because those would be
   * refused — offering them would be false confidence (SECURITY_CHECKLIST →
   * "Capability flags match the server").
   */
  permissions: {
    complete: boolean;
    reopen: boolean;
    edit: boolean;
    archive: boolean;
    restore: boolean;
  };
}

const TASK_SELECT = {
  id: true,
  title: true,
  forWhom: true,
  taskDate: true,
  dueTime: true,
  note: true,
  completedAt: true,
  completedById: true,
  completedBy: { select: { name: true } },
  createdBy: { select: { name: true } },
  archivedAt: true,
  archiveReason: true,
  version: true,
} as const;

type TaskRow = Prisma.DailyTaskGetPayload<{ select: typeof TASK_SELECT }>;

function toView(row: TaskRow, actor: Pick<Actor, 'id' | 'role'>): TaskView {
  const state = taskStateOf(row);
  const can = permissionChecker(actor);
  const allowed = new Set(taskLifecycle.available(state, { can }).map((transition) => transition.name));

  return {
    id: row.id,
    title: row.title,
    forWhom: row.forWhom,
    taskDate: fromDbDate(row.taskDate),
    // Stored as an instant; the form and the row both want the wall clock back.
    dueTime: row.dueTime ? instantToLocalTime(row.dueTime) : null,
    note: row.note,
    state,
    completedById: row.completedById,
    completedByName: row.completedBy?.name ?? null,
    createdByName: row.createdBy.name,
    archiveReason: row.archiveReason,
    version: row.version,
    permissions: {
      complete: allowed.has('complete'),
      reopen: allowed.has('reopen'),
      edit: state !== 'ARCHIVED' && can('tasks.edit'),
      archive: allowed.has('archive'),
      restore: allowed.has('restore'),
    },
  };
}

function instantToLocalTime(instant: Date): LocalTime {
  // instantToLocal is the core helper, but it returns date + time; only the
  // time is wanted here and importing the pair keeps this one-liner honest.
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(instant) as LocalTime;
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

/** The working list for one business day, open first, then closed. */
export async function listTasksForDay(client: DbClient, actor: Actor, date: CalendarDate): Promise<TaskView[]> {
  assertCan(actor, 'tasks.read');

  const rows = await client.dailyTask.findMany({
    where: { AND: [taskScope(actor), { taskDate: toDbDate(date) }, activeOnly] },
    select: TASK_SELECT,
    orderBy: [
      // Open before closed, then by the time hint, then stable by id.
      { completedAt: { sort: 'asc', nulls: 'first' } },
      { dueTime: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((row) => toView(row, actor));
}

export async function listArchivedTasks(client: DbClient, actor: Actor): Promise<TaskView[]> {
  assertCan(actor, 'archive.read');

  const rows = await client.dailyTask.findMany({
    where: { AND: [taskScope(actor), archivedOnly] },
    select: TASK_SELECT,
    orderBy: [{ archivedAt: 'desc' }, { id: 'asc' }],
    take: 100,
  });

  return rows.map((row) => toView(row, actor));
}

/** Non-archived tasks whose day falls in [from, toExclusive) — for summaries. */
export async function listTasksInRange(
  client: DbClient,
  actor: Actor,
  from: CalendarDate,
  toExclusive: CalendarDate,
): Promise<Array<{ completedById: string | null }>> {
  assertCan(actor, 'summaries.read');

  return client.dailyTask.findMany({
    where: {
      AND: [taskScope(actor), activeOnly, { taskDate: { gte: toDbDate(from), lt: toDbDate(toExclusive) } }],
    },
    select: { completedById: true },
  });
}

export async function getTask(client: DbClient, actor: Actor, id: string): Promise<TaskView> {
  assertCan(actor, 'tasks.read');

  const row = await client.dailyTask.findFirst({
    where: { AND: [taskScope(actor), { id }] },
    select: TASK_SELECT,
  });
  // Out of scope is indistinguishable from nonexistent.
  if (!row) throw errors.notFound();

  return toView(row, actor);
}

/* ── Writes ────────────────────────────────────────────────────────────── */

function dueInstant(date: CalendarDate, time: LocalTime | null | undefined): Date | null {
  if (!time) return null;
  const instant = localToInstant(date, time);
  if (!instant) {
    // A time inside the spring-forward gap does not exist. Refused as a field
    // error rather than silently shifted by an hour.
    throw errors.validation(coreCopy.validation.invalidTime, { dueTime: coreCopy.validation.invalidTime });
  }
  return instant;
}

export async function createTask(client: DbClient, actor: Actor, input: CreateTaskInput): Promise<TaskView> {
  assertCan(actor, 'tasks.create');

  // `fields` already normalised and bounded these; the service's job is to
  // choose which columns to write, not to re-validate.
  const taskDate = input.taskDate;
  const title = input.title;
  const note = input.note ?? null;

  return inTransaction(client, async (tx) => {
    const created = await tx.dailyTask.create({
      // Explicit field list: never spread request input into `data`.
      data: {
        title,
        forWhom: input.forWhom,
        taskDate: toDbDate(taskDate),
        dueTime: dueInstant(taskDate, input.dueTime),
        note,
        // The acting person comes from the session, never from the body.
        createdById: actor.id,
      },
      select: TASK_SELECT,
    });

    await recordAudit(tx, {
      actor,
      action: 'task.created',
      entityType: 'daily_task',
      entityId: created.id,
      after: { title, forWhom: input.forWhom, taskDate },
    });

    return toView(created, actor);
  });
}

export async function updateTask(client: DbClient, actor: Actor, input: UpdateTaskInput): Promise<TaskView> {
  assertCan(actor, 'tasks.edit');

  return inTransaction(client, async (tx) => {
    const existing = await tx.dailyTask.findFirst({
      where: { AND: [taskScope(actor), { id: input.id }] },
      select: { ...TASK_SELECT, taskDate: true },
    });
    if (!existing) throw errors.notFound();
    if (existing.archivedAt) {
      throw errors.businessRule('TASK_ARCHIVED', copy.tasks.archived);
    }

    const taskDate = input.taskDate ?? fromDbDate(existing.taskDate);

    const data: Prisma.DailyTaskUncheckedUpdateManyInput = { version: { increment: 1 } };
    const after: Record<string, unknown> = {};

    if (input.title !== undefined) {
      data.title = input.title;
      after.title = input.title;
    }
    if (input.forWhom !== undefined) {
      data.forWhom = input.forWhom;
      after.forWhom = input.forWhom;
    }
    if (input.taskDate !== undefined) {
      data.taskDate = toDbDate(taskDate);
      after.taskDate = taskDate;
    }
    // The time hint depends on the date, so it is recomputed whenever either
    // moves — otherwise changing the day would leave yesterday's instant.
    if (input.dueTime !== undefined || input.taskDate !== undefined) {
      const time = input.dueTime === undefined ? existingLocalTime(existing.dueTime) : input.dueTime;
      data.dueTime = dueInstant(taskDate, time);
      after.dueTime = data.dueTime;
    }
    if (input.note !== undefined) {
      data.note = input.note;
      after.note = input.note;
    }

    // Optimistic concurrency: both partners edit this list from two phones.
    const updated = await tx.dailyTask.updateMany({
      where: { id: input.id, version: input.version, archivedAt: null },
      data,
    });
    if (updated.count === 0) throw errors.staleWrite();

    const row = await tx.dailyTask.findUniqueOrThrow({ where: { id: input.id }, select: TASK_SELECT });

    await recordAudit(tx, {
      actor,
      action: 'task.updated',
      entityType: 'daily_task',
      entityId: input.id,
      before: { title: existing.title },
      after,
    });

    return toView(row, actor);
  });
}

function existingLocalTime(instant: Date | null): LocalTime | null {
  return instant ? instantToLocalTime(instant) : null;
}

/**
 * Every state change goes through here, so the lifecycle is the only thing
 * that decides what is allowed and the audit action always matches the move.
 */
export async function transitionTask(
  client: DbClient,
  actor: Actor,
  input: TaskTransitionInput,
): Promise<TaskView> {
  const can = permissionChecker(actor);
  const reason = input.reason ?? null;

  return inTransaction(client, async (tx) => {
    const existing = await tx.dailyTask.findFirst({
      where: { AND: [taskScope(actor), { id: input.id }] },
      select: { id: true, title: true, completedAt: true, archivedAt: true, version: true },
    });
    if (!existing) throw errors.notFound();

    const from = taskStateOf(existing);
    const to = input.to as TaskState;
    // Permission, legality and the reason requirement in one call.
    const transition = taskLifecycle.assertTransition(from, to, { can, reason });

    const data: Prisma.DailyTaskUncheckedUpdateManyInput = { version: { increment: 1 } };
    switch (transition.name) {
      case 'complete':
        // Both columns together, or the CHECK that keeps them consistent
        // (R-TASK-10) rejects the row.
        data.completedAt = new Date();
        data.completedById = actor.id;
        break;
      case 'reopen':
        data.completedAt = null;
        data.completedById = null;
        break;
      case 'archive':
        Object.assign(data, archiveFields(actor.id, reason));
        break;
      case 'restore':
        // Restored as OPEN: a task coming back is work again, not history.
        Object.assign(data, restoreFields());
        data.completedAt = null;
        data.completedById = null;
        break;
    }

    const updated = await tx.dailyTask.updateMany({ where: { id: input.id, version: input.version }, data });
    if (updated.count === 0) throw errors.staleWrite();

    const row = await tx.dailyTask.findUniqueOrThrow({ where: { id: input.id }, select: TASK_SELECT });

    const action = (
      {
        complete: 'task.completed',
        reopen: 'task.reopened',
        archive: 'task.archived',
        restore: 'task.restored',
      } as const
    )[transition.name as 'complete' | 'reopen' | 'archive' | 'restore'];

    await recordAudit(tx, {
      actor,
      action,
      entityType: 'daily_task',
      entityId: input.id,
      after: { title: existing.title },
      reason,
    });

    return toView(row, actor);
  });
}
