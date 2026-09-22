/**
 * SAMPLE DOMAIN — notes: soft delete (deletedAt/deletedById), author ownership.
 */

import { z } from 'zod';
import { can } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import { activeOnly, notDeleted, softDeleteFields } from '@/core/db/history';
import { inTransaction } from '@/core/db/transaction';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import { fields } from '@/core/validation/fields';
import { customerScope } from './customers';

export interface NoteView {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  canDelete: boolean;
}

export async function listNotes(client: DbClient, actor: Actor, customerId: string): Promise<NoteView[]> {
  const rows = await client.note.findMany({
    where: { AND: [notDeleted, { customerId }, { customer: customerScope(actor) }] },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: row.author.name,
    createdAt: row.createdAt.toISOString(),
    canDelete: row.authorId === actor.id || can(actor, 'notes.delete_any'),
  }));
}

export const createNoteSchema = z.object({ body: fields.text({ label: 'הערה', max: 4000, multiline: true }) }).strict();

export async function createNote(client: DbClient, actor: Actor, customerId: string, input: z.infer<typeof createNoteSchema>) {
  const customer = await client.customer.findFirst({
    where: { AND: [customerScope(actor), { id: customerId }, activeOnly] },
    select: { id: true },
  });
  if (!customer) throw errors.notFound('הלקוח לא נמצא.');

  return inTransaction(client, async (tx) => {
    const row = await tx.note.create({ data: { customerId, body: input.body, authorId: actor.id } });
    await recordAudit(tx, {
      actor,
      action: 'note.created',
      entityType: 'note',
      entityId: row.id,
      after: { body: row.body },
      metadata: { customerId },
    });
    return { id: row.id };
  });
}

export async function deleteNote(client: DbClient, actor: Actor, id: string): Promise<void> {
  const note = await client.note.findFirst({
    where: { AND: [notDeleted, { id }, { customer: customerScope(actor) }] },
    select: { id: true, authorId: true, body: true, customerId: true },
  });
  if (!note) throw errors.notFound('ההערה לא נמצאה.');
  if (note.authorId !== actor.id && !can(actor, 'notes.delete_any')) throw errors.authorization();

  await inTransaction(client, async (tx) => {
    await tx.note.update({ where: { id }, data: softDeleteFields(actor.id) });
    await recordAudit(tx, {
      actor,
      action: 'note.deleted',
      entityType: 'note',
      entityId: id,
      before: { body: note.body },
      metadata: { customerId: note.customerId },
    });
  });
}
