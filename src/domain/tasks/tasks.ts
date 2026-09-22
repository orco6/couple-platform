/**
 * THE SHARED LIST — שנינו. BUSINESS_RULES.md §2, §3, §4.
 *
 * R-TASK-01: the list is genuinely shared. Both partners see every task and
 * either may tick one off — that is the point of a shared list, not an
 * oversight. `ownerId` names *responsibility*, never permission.
 *
 * What ownership buys is the rating: the partner who does NOT own a task is the
 * one who says how it went (R-RATE-01, src/domain/tasks/task-ratings.ts). So a
 * task's owner is load-bearing for the product's signature interaction, while
 * still not restricting who can complete it.
 *
 * WHO THE LIST BELONGS TO. "Shared" means shared between the two people in the
 * link, and nobody else. The deployment is not the boundary (ADR 0009 is about
 * where the data lives, not about who may read it) and it cannot be: the
 * default role for a new account is PARTNER, so a third account would
 * otherwise read the household's errands and their notes. `taskScope` is
 * therefore a real scope — rows owned by the people in MY couple — ANDed into
 * every query, so if D-1 ever becomes "many couples" this one function already
 * says the right thing and the compiler will not let a query forget it.
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
import { coupleIds, isInCouple, requireCouple, PARTNERSHIP_ID } from '../partners';
import { taskLifecycle, taskStateOf, type TaskState } from './task-lifecycle';

/* ── Scope ─────────────────────────────────────────────────────────────── */

/**
 * Rows this actor may reach: the ones owned by the two people in their couple.
 *
 * A task's owner is always one of the two (`assertIsPartner` on every write),
 * so owner-in-couple is an exact description of "our list" rather than a
 * proxy for it. Someone who is not in the couple — or a deployment where
 * nobody has been linked yet — matches nothing: `in: []` is an empty set, not
 * an absent filter, and that difference is the whole point of this function.
 */
export async function taskScope(
  client: DbClient,
  actor: Pick<Actor, 'id' | 'role'>,
): Promise<Prisma.DailyTaskWhereInput> {
  const link = await coupleIds(client);
  const mine = isInCouple(link, actor.id);
  return { ownerId: { in: mine && link ? [link.partnerAId, link.partnerBId] : [] } };
}

/* ── Request schemas ───────────────────────────────────────────────────── */

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
    .transform((value) => value as LocalTime | null | undefined)
    // The trailing .optional() is what makes the KEY optional rather than
    // "present but possibly undefined". Core's own optionalCalendarDate ends
    // the same way; without it every caller has to pass `dueTime: null`.
    .optional();
}

export const createTaskSchema = z
  .object({
    title: fields.text({ label: copy.tasks.titleLabel, max: 200 }),
    // The responsible partner, chosen from the two. Validated for shape here
    // and for existence by the service.
    ownerId: fields.id(),
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
    ownerId: fields.id().optional(),
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
  ownerId: string;
  ownerName: string;
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

  /** How the other partner said it went. Null until they rate it. */
  rating: { value: number; ratedByName: string } | null;
  /**
   * The owner finished it and the other partner has not rated it yet. Shown to
   * the owner as "waiting", never as a chase: it is the other person's turn.
   */
  awaitingPartnerRating: boolean;
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
    /** Only the non-owner, only once it is finished (R-RATE-01). */
    rate: boolean;
  };
}

const TASK_SELECT = {
  id: true,
  title: true,
  ownerId: true,
  owner: { select: { name: true } },
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
  rating: { select: { value: true, ratedById: true, ratedBy: { select: { name: true } } } },
} as const;

type TaskRow = Prisma.DailyTaskGetPayload<{ select: typeof TASK_SELECT }>;

function toView(row: TaskRow, actor: Pick<Actor, 'id' | 'role'>): TaskView {
  const state = taskStateOf(row);
  const can = permissionChecker(actor);
  const allowed = new Set(taskLifecycle.available(state, { can }).map((transition) => transition.name));

  const rated = row.rating;
  const isMine = row.ownerId === actor.id;

  return {
    id: row.id,
    title: row.title,
    ownerId: row.ownerId,
    ownerName: row.owner.name,
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
    rating: rated ? { value: rated.value, ratedByName: rated.ratedBy.name } : null,
    awaitingPartnerRating: state === 'COMPLETED' && rated === null && isMine,
    permissions: {
      complete: allowed.has('complete'),
      reopen: allowed.has('reopen'),
      edit: state !== 'ARCHIVED' && can('tasks.edit'),
      archive: allowed.has('archive'),
      restore: allowed.has('restore'),
      // The flag the UI renders from must match what rateTask() accepts, or
      // the screen offers an action the server refuses.
      rate:
        state === 'COMPLETED' &&
        !isMine &&
        can('task_ratings.rate') &&
        (rated === null || rated.ratedById === actor.id),
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
    where: { AND: [await taskScope(client, actor), { taskDate: toDbDate(date) }, activeOnly] },
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
    where: { AND: [await taskScope(client, actor), archivedOnly] },
    select: TASK_SELECT,
    orderBy: [{ archivedAt: 'desc' }, { id: 'asc' }],
    take: 100,
  });

  return rows.map((row) => toView(row, actor));
}

/** What a summary needs from a task. Deliberately small. */
export interface TaskSummaryRow {
  taskDate: CalendarDate;
  title: string;
  ownerId: string;
  completedById: string | null;
  /** The other partner's 1–5, or null while it is still waiting. */
  ratingValue: number | null;
}

/** Non-archived tasks whose day falls in [from, toExclusive) — for summaries. */
export async function listTasksInRange(
  client: DbClient,
  actor: Actor,
  from: CalendarDate,
  toExclusive: CalendarDate,
): Promise<TaskSummaryRow[]> {
  assertCan(actor, 'summaries.read');

  const rows = await client.dailyTask.findMany({
    where: {
      AND: [await taskScope(client, actor), activeOnly, { taskDate: { gte: toDbDate(from), lt: toDbDate(toExclusive) } }],
    },
    select: {
      taskDate: true,
      title: true,
      ownerId: true,
      completedById: true,
      rating: { select: { value: true } },
    },
    orderBy: [{ taskDate: 'asc' }, { id: 'asc' }],
  });

  return rows.map((row) => ({
    taskDate: fromDbDate(row.taskDate),
    title: row.title,
    ownerId: row.ownerId,
    completedById: row.completedById,
    ratingValue: row.rating?.value ?? null,
  }));
}

export async function getTask(client: DbClient, actor: Actor, id: string): Promise<TaskView> {
  assertCan(actor, 'tasks.read');

  const row = await client.dailyTask.findFirst({
    where: { AND: [await taskScope(client, actor), { id }] },
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
    // Two different questions, and both have to be asked. Is the person
    // writing one of the two? And is the person they are making responsible?
    await requireCouple(tx, actor);
    await assertIsPartner(tx, input.ownerId);

    const created = await tx.dailyTask.create({
      // Explicit field list: never spread request input into `data`.
      data: {
        title,
        ownerId: input.ownerId,
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
      after: { title, taskDate },
    });

    return toView(created, actor);
  });
}

export async function updateTask(client: DbClient, actor: Actor, input: UpdateTaskInput): Promise<TaskView> {
  assertCan(actor, 'tasks.edit');

  return inTransaction(client, async (tx) => {
    const existing = await tx.dailyTask.findFirst({
      where: { AND: [await taskScope(tx, actor), { id: input.id }] },
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
    if (input.ownerId !== undefined) {
      // Authority-carrying field: who owns a task decides who may rate it, so
      // it is checked on its own rather than trusted from the body.
      await assertIsPartner(tx, input.ownerId);
      data.ownerId = input.ownerId;
      after.ownerId = input.ownerId;
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
      where: { AND: [await taskScope(tx, actor), { id: input.id }] },
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

/**
 * A task's owner must be one of the two linked partners.
 *
 * Without this, a stale or hostile client could own a task to a disabled
 * account or to a spare user, and the rating rule ("the partner who is not the
 * owner rates it") would have nobody on the other side.
 */
async function assertIsPartner(client: DbClient, userId: string): Promise<void> {
  const link = await client.partnership.findUnique({
    where: { id: PARTNERSHIP_ID },
    select: { partnerAId: true, partnerBId: true },
  });
  if (!link) throw errors.businessRule('NO_PARTNERSHIP', copy.errors.noPartnerYet);
  if (userId !== link.partnerAId && userId !== link.partnerBId) {
    throw errors.validation(undefined, { ownerId: copy.errors.ownerMustBePartner });
  }
}
