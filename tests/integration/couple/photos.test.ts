/**
 * A photo on a task: the couple is the scope, the bytes are checked (not the
 * name or the declared type), the size is capped, and the photo leaves with
 * its task.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { getTaskPhoto, MAX_PHOTO_BYTES, removeTaskPhoto, setTaskPhoto, sniffImage } from '@/domain/tasks/task-photos';
import { deleteTask, getTask } from '@/domain/tasks/tasks';

import { caught, makeUser } from '../../support/factories';
import { makeCouple, makeTask, type Couple } from './factories';

/** The smallest valid-looking JPEG header plus some body. */
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(7)]);

let couple: Couple;
let outsider: Actor;

beforeEach(async () => {
  couple = await makeCouple();
  outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
});

describe('a photo on a task', () => {
  it('either partner can set it, the other can read it, and the task says it has one', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    await setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });

    const photo = await getTaskPhoto(db, couple.partner, task.id);
    expect(photo.mimeType).toBe('image/jpeg');
    expect(photo.bytes.length).toBe(204);
    expect((await getTask(db, couple.partner, task.id)).photo).not.toBeNull();
  });

  it('an outsider can neither read nor set it — not found', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    await setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });

    expect((await caught(() => getTaskPhoto(db, outsider, task.id))).status).toBe(404);
    expect((await caught(() => setTaskPhoto(db, outsider, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' }))).status).toBe(404);
  });

  it('refuses what is not an image, whatever it claims to be', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const html = new TextEncoder().encode('<script>alert(1)</script>');
    const error = await caught(() => setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: html, declaredType: 'image/jpeg' }));
    expect(error.status).toBe(400);
    // A real JPEG declared as PNG is refused too: the two must agree.
    const mismatch = await caught(() => setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/png' }));
    expect(mismatch.status).toBe(400);
  });

  it('refuses a file over the size limit', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect((await caught(() => setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: big, declaredType: 'image/jpeg' }))).status).toBe(400);
  });

  it('is removed on request, and with its task', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    await setTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    await removeTaskPhoto(db, couple.partner, task.id);
    expect((await caught(() => getTaskPhoto(db, couple.owner, task.id))).status).toBe(404);

    const other = await makeTask(couple, { ownerId: couple.owner.id });
    await setTaskPhoto(db, couple.owner, { taskId: other.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    const current = await getTask(db, couple.owner, other.id);
    await deleteTask(db, couple.owner, { id: other.id, version: current.version });
    expect(await db.taskPhoto.count({ where: { taskId: other.id } })).toBe(0);
  });

  it('recognises the three formats by their bytes', () => {
    expect(sniffImage(jpeg())).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBeNull();
  });
});
