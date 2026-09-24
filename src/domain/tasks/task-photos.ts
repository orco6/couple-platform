/**
 * PHOTOS ON A TASK — up to MAX_PHOTOS each (sixth edition: several).
 *
 * The same guarantees as every other task write:
 *   • the couple is the scope: a task outside it is "not found", for reading
 *     a photo as much as for adding or removing one;
 *   • the bytes are checked, not trusted: only JPEG, PNG or WebP, recognised
 *     by their signature (the declared type must agree), and at most
 *     MAX_PHOTO_BYTES — the client shrinks a camera photo to ~1600px first;
 *   • adding and removing are audited in the same transaction (the audit row
 *     names the task, never the image).
 * Photos leave with their task (onDelete: Cascade).
 */

import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import type { DbClient } from '@/core/db/types';
import { inTransaction } from '@/core/db/transaction';
import { errors } from '@/core/errors/errors';
import { recordAudit } from '@/core/audit/record';
import { copy } from '../copy';

import { MAX_PHOTOS } from './photo-limits';
import { taskScope } from './tasks';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export { MAX_PHOTOS };

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** What the first bytes say the file is — or null if it is not one of the three. */
export function sniffImage(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

async function taskInScope(client: DbClient, actor: Actor, taskId: string) {
  const task = await client.dailyTask.findFirst({
    where: { AND: [await taskScope(client, actor), { id: taskId }] },
    select: { id: true, title: true },
  });
  if (!task) throw errors.notFound();
  return task;
}

export async function addTaskPhoto(
  client: DbClient,
  actor: Actor,
  input: { taskId: string; bytes: Uint8Array; declaredType: string | null },
): Promise<{ id: string; version: string }> {
  assertCan(actor, 'tasks.edit');
  if (input.bytes.length === 0) throw errors.validation(copy.tasks.photoNotImage, { photo: copy.tasks.photoNotImage });
  if (input.bytes.length > MAX_PHOTO_BYTES) throw errors.validation(copy.tasks.photoTooBig, { photo: copy.tasks.photoTooBig });
  const mime = sniffImage(input.bytes);
  if (!mime || (input.declaredType && input.declaredType !== mime)) {
    throw errors.validation(copy.tasks.photoNotImage, { photo: copy.tasks.photoNotImage });
  }

  return inTransaction(client, async (tx) => {
    const task = await taskInScope(tx, actor, input.taskId);
    const count = await tx.taskPhoto.count({ where: { taskId: task.id } });
    if (count >= MAX_PHOTOS) throw errors.validation(copy.tasks.photosFull(MAX_PHOTOS), { photo: copy.tasks.photosFull(MAX_PHOTOS) });
    const saved = await tx.taskPhoto.create({
      data: { taskId: task.id, mimeType: mime, bytes: Buffer.from(input.bytes), sizeBytes: input.bytes.length, createdById: actor.id },
      select: { id: true, createdAt: true },
    });
    await recordAudit(tx, {
      actor,
      action: 'task.photo_set',
      entityType: 'daily_task',
      entityId: task.id,
      after: { title: task.title },
    });
    return { id: saved.id, version: String(saved.createdAt.getTime()) };
  });
}

export async function getTaskPhoto(
  client: DbClient,
  actor: Actor,
  taskId: string,
  photoId: string,
): Promise<{ mimeType: string; bytes: Uint8Array }> {
  assertCan(actor, 'tasks.read');
  await taskInScope(client, actor, taskId);
  const photo = await client.taskPhoto.findFirst({ where: { id: photoId, taskId }, select: { mimeType: true, bytes: true } });
  if (!photo) throw errors.notFound();
  return { mimeType: photo.mimeType, bytes: new Uint8Array(photo.bytes) };
}

export async function removeTaskPhoto(
  client: DbClient,
  actor: Actor,
  taskId: string,
  photoId: string,
): Promise<{ id: string; removed: boolean }> {
  assertCan(actor, 'tasks.edit');
  return inTransaction(client, async (tx) => {
    const task = await taskInScope(tx, actor, taskId);
    const removed = await tx.taskPhoto.deleteMany({ where: { id: photoId, taskId: task.id } });
    if (removed.count > 0) {
      await recordAudit(tx, {
        actor,
        action: 'task.photo_removed',
        entityType: 'daily_task',
        entityId: task.id,
        before: { title: task.title },
      });
    }
    return { id: photoId, removed: removed.count > 0 };
  });
}
