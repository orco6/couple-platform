/**
 * Exceptions and follow-up: records that are VALID but NEED ATTENTION.
 *
 * Two different failures, two different tools:
 *
 *   HARD VALIDATION FAILURE  The data is wrong or impossible. The write is
 *                            refused (errors.validation / errors.businessRule).
 *   SOFT BUSINESS EXCEPTION  The data is acceptable, but somebody should look:
 *                            a missing document, a delayed payment, a suspected
 *                            duplicate. The write succeeds; attention is raised.
 *
 * Soft exceptions come from two places:
 *
 *   DERIVED  Computed from current data every time (see attention.ts). Fix the
 *            data and the item disappears by itself — nothing to mark done.
 *            Styled calmly: an exception is not an error.
 *   MANUAL   A person raises a FollowUp on a record ("call about the invoice"),
 *            optionally with a due date and an assignee, and later resolves or
 *            dismisses it with a note. Stored, audited.
 */

import { z } from 'zod';
import { assertCan, can } from '@/core/access/can';
import { ACTOR_SELECT, type Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import { fromDbDateOrNull, toDbDate, type CalendarDate } from '@/core/dates/calendar-date';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { copy } from '@/core/copy';
import { errors } from '@/core/errors/errors';
import type { FollowUpTargets } from './targets';
import { fields } from '@/core/validation/fields';

export const createFollowUpSchema = z
  .object({
    entityType: z.string().regex(/^[a-z_]{2,40}$/),
    entityId: fields.id(),
    kind: z.string().regex(/^[a-z_]{2,40}$/),
    note: fields.optionalText({ label: 'הערה', max: 1000, multiline: true }),
    dueDate: fields.optionalCalendarDate(),
    assigneeId: fields.optionalId(),
  })
  .strict();

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

export interface FollowUpView {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  note: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  dueDate: CalendarDate | null;
  assigneeName: string | null;
  createdByName: string;
  createdAt: string;
  resolution: string | null;
}

const VIEW_INCLUDE = {
  assignee: { select: { name: true } },
  createdBy: { select: { name: true } },
} as const;

type Row = {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  note: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  dueDate: Date | null;
  createdAt: Date;
  resolution: string | null;
  assignee: { name: string } | null;
  createdBy: { name: string };
};

function toView(row: Row): FollowUpView {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    kind: row.kind,
    note: row.note,
    status: row.status,
    dueDate: fromDbDateOrNull(row.dueDate),
    assigneeName: row.assignee?.name ?? null,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    resolution: row.resolution,
  };
}

/** Structural scope: your own (created or assigned) unless you may read all. */
export function followUpScope(actor: Actor) {
  return can(actor, 'follow_ups.read_all') ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] };
}

/**
 * Raise a follow-up on a record the actor can see. Entity types, kinds and the
 * scoped reachability check come from the domain (src/domain/follow-ups.ts).
 */
export async function createFollowUp(
  client: DbClient,
  actor: Actor,
  input: CreateFollowUpInput,
  targets: FollowUpTargets,
): Promise<FollowUpView> {
  if (!Object.hasOwn(targets.kinds, input.kind)) throw errors.validation(undefined, { kind: copy.validation.invalidChoice });
  const entity = Object.hasOwn(targets.entities, input.entityType) ? targets.entities[input.entityType] : undefined;
  // Unknown type and unreachable record give the same answer: nothing reveals that a record exists.
  if (!entity || !(await entity.canReach(client, actor, input.entityId))) throw errors.notFound();

  if (input.assigneeId && input.assigneeId !== actor.id) {
    assertCan(actor, 'follow_ups.manage_all');
    const assignee = await client.user.findFirst({ where: { id: input.assigneeId, status: 'ACTIVE' }, select: ACTOR_SELECT });
    if (!assignee) throw errors.validation(undefined, { assigneeId: 'המשתמש לא נמצא' });
    // The assignee will read the note and follow the link: they must be able to see the record too,
    // otherwise assigning becomes a way to show private notes to the wrong colleague.
    if (!(await entity.canReach(client, assignee, input.entityId))) {
      throw errors.validation(undefined, { assigneeId: 'למשתמש הזה אין גישה לרשומה' });
    }
  }

  return inTransaction(client, async (tx) => {
    const row = await tx.followUp.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        note: input.note,
        dueDate: input.dueDate ? toDbDate(input.dueDate) : null,
        assigneeId: input.assigneeId ?? actor.id,
        createdById: actor.id,
      },
      include: VIEW_INCLUDE,
    });
    await recordAudit(tx, {
      actor,
      action: 'follow_up.created',
      entityType: 'follow_up',
      entityId: row.id,
      after: { kind: row.kind, note: row.note, dueDate: input.dueDate },
      metadata: { onEntityType: row.entityType, onEntityId: row.entityId },
    });
    return toView(row);
  });
}

export async function closeFollowUp(
  client: DbClient,
  actor: Actor,
  id: string,
  outcome: 'RESOLVED' | 'DISMISSED',
  resolution: string | null,
): Promise<FollowUpView> {
  const scope = can(actor, 'follow_ups.manage_all') ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] };
  const existing = await client.followUp.findFirst({ where: { AND: [{ id }, scope] }, select: { id: true, status: true } });
  if (!existing) throw errors.notFound();
  if (existing.status !== 'OPEN') throw errors.businessRule('FOLLOW_UP_CLOSED', 'הפריט הזה כבר טופל.');

  return inTransaction(client, async (tx) => {
    const row = await tx.followUp.update({
      where: { id },
      data: { status: outcome, resolution, resolvedAt: new Date(), resolvedById: actor.id },
      include: VIEW_INCLUDE,
    });
    await recordAudit(tx, {
      actor,
      action: outcome === 'RESOLVED' ? 'follow_up.resolved' : 'follow_up.dismissed',
      entityType: 'follow_up',
      entityId: id,
      before: { status: 'OPEN' },
      after: { status: outcome, resolution },
    });
    return toView(row);
  });
}

export async function listOpenFollowUps(
  client: DbClient,
  actor: Actor,
  filter: { entityType?: string; entityId?: string; limit?: number } = {},
): Promise<FollowUpView[]> {
  const rows = await client.followUp.findMany({
    where: {
      AND: [
        followUpScope(actor),
        { status: 'OPEN' },
        filter.entityType ? { entityType: filter.entityType } : {},
        filter.entityId ? { entityId: filter.entityId } : {},
      ],
    },
    include: VIEW_INCLUDE,
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    take: Math.min(filter.limit ?? 100, 200),
  });
  return rows.map(toView);
}
