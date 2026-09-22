/**
 * Writing the audit log.
 *
 * Called explicitly by the services that change something — deliberately not a
 * Prisma extension that logs every write. Only the service knows WHY: the
 * reason, the subject, the business meaning. Those are what make a log worth
 * reading.
 *
 * Pass the transaction client, so the event commits or rolls back together
 * with the change it describes.
 */

import type { Prisma } from '@/generated/prisma/client';
import { auditVocabulary, type AuditAction } from '@/domain/contract';
import type { DbClient } from '@/core/db/types';
import type { Actor } from '@/core/auth/actor';
import { redactForAudit } from './redact';

export interface AuditInput {
  /** Null for system actions (bootstrap scripts). */
  actor: Pick<Actor, 'id' | 'name'> | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  subjectUserId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
}

export class AuditReasonMissingError extends Error {
  constructor(action: string) {
    super(`Audit action "${action}" requires a reason; the service must collect one before writing.`);
    this.name = 'AuditReasonMissingError';
  }
}

function json(value: Record<string, unknown> | null | undefined) {
  if (!value) return undefined;
  return redactForAudit(value) as Prisma.InputJsonValue;
}

export async function recordAudit(client: DbClient, input: AuditInput): Promise<void> {
  const definition = auditVocabulary.actions[input.action];
  if (!definition) throw new Error(`Unknown audit action "${input.action}"`);

  const reason = input.reason?.trim() || null;
  if ('requiresReason' in definition && definition.requiresReason && !reason) {
    // A programming error, not a user error: the service should have demanded a
    // reason already. Throwing keeps an unexplained override out of the log.
    throw new AuditReasonMissingError(input.action);
  }

  await client.auditEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actor?.id ?? null,
      actorLabel: input.actor?.name ?? 'מערכת',
      subjectUserId: input.subjectUserId ?? null,
      before: json(input.before),
      after: json(input.after),
      metadata: json(input.metadata),
      reason,
    },
  });
}
