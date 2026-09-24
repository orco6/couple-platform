/**
 * A PARTNER'S OWN PHOTO — the face next to their name, wherever the two of
 * them appear (the home header, whose task it is, the summary).
 *
 *   • Only its owner sets or removes it.
 *   • Only the two people in the couple see it: anyone else (another account,
 *     an administrator who is not one of the two) is "not found".
 *   • The bytes are checked like a task photo's: JPEG, PNG or WebP by their
 *     signature, at most MAX_PHOTO_BYTES (the client shrinks it first).
 *   • Setting and removing are audited; the image never enters the log.
 */

import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import type { DbClient } from '@/core/db/types';
import { inTransaction } from '@/core/db/transaction';
import { errors } from '@/core/errors/errors';

import { copy } from './copy';
import { coupleIds, isInCouple } from './partners';
import { MAX_PHOTO_BYTES, sniffImage } from './tasks/task-photos';

export async function setProfilePhoto(
  client: DbClient,
  actor: Actor,
  input: { bytes: Uint8Array; declaredType: string | null },
): Promise<{ version: string }> {
  assertCan(actor, 'profile.photo');
  if (input.bytes.length === 0) throw errors.validation(copy.tasks.photoNotImage, { photo: copy.tasks.photoNotImage });
  if (input.bytes.length > MAX_PHOTO_BYTES) throw errors.validation(copy.tasks.photoTooBig, { photo: copy.tasks.photoTooBig });
  const mime = sniffImage(input.bytes);
  if (!mime || (input.declaredType && input.declaredType !== mime)) {
    throw errors.validation(copy.tasks.photoNotImage, { photo: copy.tasks.photoNotImage });
  }
  return inTransaction(client, async (tx) => {
    const data = { mimeType: mime, bytes: Buffer.from(input.bytes), sizeBytes: input.bytes.length };
    const saved = await tx.profilePhoto.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, ...data },
      update: data,
      select: { updatedAt: true },
    });
    await recordAudit(tx, { actor, action: 'profile.photo_set', entityType: 'profile', entityId: actor.id });
    return { version: String(saved.updatedAt.getTime()) };
  });
}

export async function removeProfilePhoto(client: DbClient, actor: Actor): Promise<{ removed: boolean }> {
  assertCan(actor, 'profile.photo');
  return inTransaction(client, async (tx) => {
    const removed = await tx.profilePhoto.deleteMany({ where: { userId: actor.id } });
    if (removed.count > 0) {
      await recordAudit(tx, { actor, action: 'profile.photo_removed', entityType: 'profile', entityId: actor.id });
    }
    return { removed: removed.count > 0 };
  });
}

/** Mine, or my partner's. Anyone else's — or a photo that is not there — is not found. */
export async function getProfilePhoto(
  client: DbClient,
  actor: Actor,
  userId: string,
): Promise<{ mimeType: string; bytes: Uint8Array }> {
  assertCan(actor, 'tasks.read');
  if (userId !== actor.id) {
    const link = await coupleIds(client);
    if (!isInCouple(link, actor.id) || !isInCouple(link, userId)) throw errors.notFound();
  }
  const photo = await client.profilePhoto.findUnique({ where: { userId }, select: { mimeType: true, bytes: true } });
  if (!photo) throw errors.notFound();
  return { mimeType: photo.mimeType, bytes: new Uint8Array(photo.bytes) };
}
