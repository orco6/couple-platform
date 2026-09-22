/**
 * RATING A COMPLETED TASK — שנינו. BUSINESS_RULES.md §3, §5.
 *
 * R-RATE-01 — a task is rated by the partner who does NOT own it.
 *
 * That asymmetry is the whole feature. Rating your own work is a self-
 * assessment, and the product already has one of those in the daily entry.
 * This is the small piece of feedback that otherwise never gets said out loud:
 * the person who asked for the thing says how it went. One rating per task,
 * one tap, five steps.
 *
 * R-RATE-03 — a rating can be changed by its author but never removed.
 * Changing your mind about yesterday's dishes is normal; a disappearing rating
 * would move the week's average with nothing on screen to explain it.
 */

import { z } from 'zod';

import { assertCan } from '@/core/access/can';
import { recordAudit } from '@/core/audit/record';
import type { Actor } from '@/core/auth/actor';
import { toDbDate, type CalendarDate } from '@/core/dates/calendar-date';
import { activeOnly } from '@/core/db/history';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';

import { copy } from '../copy';
import { partnersOf } from '../partners';
import { taskScope } from './tasks';

export const rateTaskSchema = z
  .object({
    taskId: z.string(),
    value: z.number().int().min(1).max(5),
  })
  .strict();

export type RateTaskInput = z.infer<typeof rateTaskSchema>;

export interface TaskRatingView {
  value: number;
  ratedById: string;
  ratedByName: string;
}

/**
 * Record or change how the other partner's completed task went.
 *
 * The gate is positive rather than negative: the task must be owned by **my
 * partner**, read from the `Partnership` link. Checking only "not mine" would
 * have let a third account — a spare, a fixture, one never disabled — rate a
 * couple's tasks, because it is not the owner either. Single-tenant
 * deployments have exactly two people (D-1), but that is a deployment fact, not
 * a control, and this is a control.
 *
 * Four refusals, all business rules rather than validation, because each is a
 * thing a person could reasonably try:
 *   • the task is not finished yet → nothing to rate;
 *   • the task is mine → I do not rate my own work;
 *   • I am not in this couple → there is no pair I am the other half of;
 *   • someone else already rated it → only the non-owner rates, and there is
 *     only one of them, so this can only mean a stale client.
 */
export async function rateTask(client: DbClient, actor: Actor, input: RateTaskInput): Promise<TaskRatingView> {
  assertCan(actor, 'task_ratings.rate');

  return inTransaction(client, async (tx) => {
    const { other } = await partnersOf(tx, actor);
    if (!other) throw errors.businessRule('NO_PARTNERSHIP', copy.errors.noPartnerYet);

    const task = await tx.dailyTask.findFirst({
      where: { AND: [taskScope(actor), { id: input.taskId }, activeOnly] },
      select: { id: true, title: true, ownerId: true, completedAt: true, rating: { select: { ratedById: true } } },
    });
    if (!task) throw errors.notFound();

    if (!task.completedAt) {
      throw errors.businessRule('TASK_NOT_COMPLETED', copy.errors.rateOnlyCompleted);
    }
    if (task.ownerId === actor.id) {
      throw errors.businessRule('TASK_IS_MINE', copy.errors.rateNotOwnTask);
    }
    if (task.ownerId !== other.id) {
      // Not my task and not my partner's: I am not part of this pair.
      throw errors.businessRule('NOT_MY_PARTNERS_TASK', copy.errors.rateNotOwnTask);
    }
    if (task.rating && task.rating.ratedById !== actor.id) {
      throw errors.conflict(copy.errors.rateAlreadyRated, 'TASK_ALREADY_RATED');
    }

    const saved = await tx.taskRating.upsert({
      where: { taskId: task.id },
      create: { taskId: task.id, ratedById: actor.id, value: input.value },
      update: { value: input.value },
      select: { value: true, ratedById: true, ratedBy: { select: { name: true } } },
    });

    await recordAudit(tx, {
      actor,
      action: task.rating ? 'task_rating.changed' : 'task_rating.given',
      entityType: 'task_rating',
      entityId: task.id,
      // The value is ordinary feedback about a chore, not the private
      // self-assessment the daily entry holds, so it is safe in the log.
      after: { title: task.title, ratingValue: input.value },
    });

    return { value: saved.value, ratedById: saved.ratedById, ratedByName: saved.ratedBy.name };
  });
}

/** Ratings given in a date range, for the weekly and monthly averages. */
export async function listTaskRatingsInRange(
  client: DbClient,
  actor: Actor,
  from: CalendarDate,
  toExclusive: CalendarDate,
): Promise<Array<{ value: number; ownerId: string }>> {
  assertCan(actor, 'summaries.read');

  const rows = await client.taskRating.findMany({
    where: {
      task: {
        AND: [taskScope(actor), activeOnly, { taskDate: { gte: toDbDate(from), lt: toDbDate(toExclusive) } }],
      },
    },
    select: { value: true, task: { select: { ownerId: true } } },
  });

  return rows.map((row) => ({ value: row.value, ownerId: row.task.ownerId }));
}
