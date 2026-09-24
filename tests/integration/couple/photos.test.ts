/**
 * Photos on a task: the couple is the scope, the bytes are checked (not the
 * name or the declared type), the size and the count are capped, and the
 * photos leave with their task.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { addTaskPhoto, getTaskPhoto, MAX_PHOTO_BYTES, MAX_PHOTOS, removeTaskPhoto, sniffImage } from '@/domain/tasks/task-photos';
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

describe('photos on a task', () => {
  it('either partner can add them, the other can read them, and the task lists them in order', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const first = await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    const second = await addTaskPhoto(db, couple.partner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });

    const photo = await getTaskPhoto(db, couple.partner, task.id, first.id);
    expect(photo.mimeType).toBe('image/jpeg');
    expect(photo.bytes.length).toBe(204);
    expect((await getTask(db, couple.partner, task.id)).photos.map((p) => p.id)).toEqual([first.id, second.id]);
  });

  it('an outsider can neither read nor add one — not found', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const photo = await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });

    expect((await caught(() => getTaskPhoto(db, outsider, task.id, photo.id))).status).toBe(404);
    expect((await caught(() => addTaskPhoto(db, outsider, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' }))).status).toBe(404);
    expect((await caught(() => removeTaskPhoto(db, outsider, task.id, photo.id))).status).toBe(404);
  });

  it('a photo is read only through its own task', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const other = await makeTask(couple, { ownerId: couple.owner.id });
    const photo = await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    expect((await caught(() => getTaskPhoto(db, couple.owner, other.id, photo.id))).status).toBe(404);
  });

  it('refuses what is not an image, whatever it claims to be', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const html = new TextEncoder().encode('<script>alert(1)</script>');
    const error = await caught(() => addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: html, declaredType: 'image/jpeg' }));
    expect(error.status).toBe(400);
    // A real JPEG declared as PNG is refused too: the two must agree.
    const mismatch = await caught(() => addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/png' }));
    expect(mismatch.status).toBe(400);
  });

  it('refuses a file over the size limit', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect((await caught(() => addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: big, declaredType: 'image/jpeg' }))).status).toBe(400);
  });

  it(`refuses a photo beyond ${MAX_PHOTOS}`, async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    for (let i = 0; i < MAX_PHOTOS; i++) {
      await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    }
    expect((await caught(() => addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' }))).status).toBe(400);
    expect(await db.taskPhoto.count({ where: { taskId: task.id } })).toBe(MAX_PHOTOS);
  });

  it('one is removed on request, the rest stay; all leave with their task', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });
    const gone = await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    const kept = await addTaskPhoto(db, couple.owner, { taskId: task.id, bytes: jpeg(), declaredType: 'image/jpeg' });
    expect((await removeTaskPhoto(db, couple.partner, task.id, gone.id)).removed).toBe(true);
    expect((await caught(() => getTaskPhoto(db, couple.owner, task.id, gone.id))).status).toBe(404);
    expect((await getTask(db, couple.owner, task.id)).photos.map((p) => p.id)).toEqual([kept.id]);

    const current = await getTask(db, couple.owner, task.id);
    await deleteTask(db, couple.owner, { id: task.id, version: current.version });
    expect(await db.taskPhoto.count({ where: { taskId: task.id } })).toBe(0);
  });

  it('recognises the three formats by their bytes', () => {
    expect(sniffImage(jpeg())).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBeNull();
  });
});
