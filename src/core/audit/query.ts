/**
 * Reading the audit log (requires audit.read) and describing entries in words.
 *
 * The log stores raw values, which is right for evidence. Showing
 * "priceAgorot: 150000" to a business owner is not — so known fields get a
 * label and a value formatted the way the business writes it, and unknown
 * fields are left out of the summary rather than dumped raw.
 */

import { z } from 'zod';
import { access, auditVocabulary } from '@/domain/contract';
import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { formatCalendarDate, isCalendarDate } from '@/core/dates/calendar-date';
import { formatDateTime } from '@/core/dates/instant';
import type { DbClient } from '@/core/db/types';
import { formatMoney, formatRate } from '@/core/money/format';
import { copy } from '@/core/copy';

export const auditQuerySchema = z
  .object({
    entityType: z.string().regex(/^[a-z_]{2,40}$/).optional(),
    entityId: z.string().max(64).optional(),
    actorId: z.string().max(64).optional(),
    action: z.string().max(80).optional(),
    cursor: z.string().max(64).optional(),
  })
  .strict();

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntryView {
  id: string;
  occurredAt: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  entityId: string;
  actorLabel: string;
  reason: string | null;
  summary: string;
}

const PAGE_SIZE = 50;

export async function listAuditEvents(
  client: DbClient,
  actor: Actor,
  query: AuditQuery,
): Promise<{ entries: AuditEntryView[]; nextCursor: string | null }> {
  assertCan(actor, 'audit.read');

  const rows = await client.auditEvent.findMany({
    where: {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, PAGE_SIZE);
  return {
    entries: page.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      action: row.action,
      actionLabel: labelOfAction(row.action),
      entityType: row.entityType,
      entityLabel: (auditVocabulary.entityTypes as Record<string, string>)[row.entityType] ?? row.entityType,
      entityId: row.entityId,
      actorLabel: row.actorLabel,
      reason: row.reason,
      summary: describeChange(row.before, row.after),
    })),
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

function labelOfAction(action: string): string {
  return (auditVocabulary.actions as Record<string, { label: string }>)[action]?.label ?? action;
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return copy.common.empty;
  const definition = (auditVocabulary.fields as Record<string, { label: string; format?: string; values?: Record<string, string> }>)[field];

  switch (definition?.format) {
    case 'money':
      return typeof value === 'number' && Number.isSafeInteger(value) ? formatMoney(value) : String(value);
    case 'rate':
      return typeof value === 'number' ? formatRate(value) : String(value);
    case 'boolean':
      return value ? copy.common.yes : copy.common.no;
    case 'calendar_date':
      return typeof value === 'string' && isCalendarDate(value.slice(0, 10)) ? formatCalendarDate(value.slice(0, 10) as never) : String(value);
    case 'instant':
      return typeof value === 'string' ? formatDateTime(value) : String(value);
    case 'enum':
      if (field === 'role' && typeof value === 'string') return access.roleLabel(value);
      return definition.values?.[String(value)] ?? String(value);
    case 'reference':
      return 'שונה';
    default:
      return typeof value === 'object' ? '…' : String(value);
  }
}

/** One readable line: "מחיר לפני מע״מ: ₪1,200 ← ₪1,500 · כותרת: …" */
export function describeChange(before: unknown, after: unknown, limit = 4): string {
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const next = isObject(after) ? after : isObject(before) ? before : null;
  if (!next) return '';
  const previous = isObject(after) && isObject(before) ? before : null;

  const parts: string[] = [];
  for (const [field, definition] of Object.entries(auditVocabulary.fields)) {
    if (parts.length >= limit) break;
    if (!(field in next)) continue;
    const value = next[field];
    if (!previous && (value === null || value === '' || value === undefined)) continue;
    const label = (definition as { label: string }).label;
    parts.push(
      previous && field in previous
        ? `${label}: ${formatAuditValue(field, previous[field])} ← ${formatAuditValue(field, value)}`
        : `${label}: ${formatAuditValue(field, value)}`,
    );
  }
  return parts.join(' · ');
}
