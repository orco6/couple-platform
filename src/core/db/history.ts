/**
 * History conventions: archive and soft delete.
 *
 * Two different things, used for different records:
 *
 *   ARCHIVE      archivedAt / archivedById / (archiveReason)
 *                A business decision: "this customer is no longer active".
 *                Reversible with restore. Archived records stay visible in
 *                history screens and reports about the past.
 *
 *   SOFT DELETE  deletedAt / deletedById
 *                "This should not have existed" — a mistaken note, a duplicate.
 *                Hidden from every working list. Still in the database, still
 *                in the audit log (who, when, why). There is no in-app undelete:
 *                recovering one is a deliberate, recorded database operation.
 *
 * HARD DELETE is not a normal operation for anything financial or historical.
 * Sessions, throttle rows and expired idempotency keys are the exceptions.
 *
 * Every list query for an archivable model filters with `activeOnly` unless it
 * is explicitly an archive screen. Every query for a soft-deletable model
 * filters with `notDeleted`, always.
 */

export const activeOnly = { archivedAt: null } as const;
export const archivedOnly = { archivedAt: { not: null } } as const;
export const notDeleted = { deletedAt: null } as const;

export function archiveFields(actorId: string, reason: string | null, now = new Date()) {
  return { archivedAt: now, archivedById: actorId, archiveReason: reason };
}

export function restoreFields() {
  return { archivedAt: null, archivedById: null, archiveReason: null };
}

export function softDeleteFields(actorId: string, now = new Date()) {
  return { deletedAt: now, deletedById: actorId };
}
