/**
 * Deleting a task, for good (fifth edition — the owner asked for a real delete
 * instead of the archive). The same four guarantees as every other write:
 * the couple is the scope, the version guards against the other phone, the
 * rating goes with its task, and the audit row is written in the same
 * transaction.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { rateTask } from '@/domain/tasks/task-ratings';
import { deleteTask, getTask, listTasksForDay, updateTask } from '@/domain/tasks/tasks';

import { caught, makeUser } from '../../support/factories';
import { makeCompletedTask, makeCouple, makeTask, type Couple } from './factories';

let couple: Couple;
let outsider: Actor;

beforeEach(async () => {
  couple = await makeCouple();
  outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
});

describe('deleting a task', () => {
  it('either partner may delete any task on the list, and it is gone', async () => {
    const mine = await makeTask(couple, { ownerId: couple.owner.id, title: 'לקנות חלב' });
    const theirs = await makeTask(couple, { ownerId: couple.owner.id, title: 'לשלם חשבון' });

    await deleteTask(db, couple.owner, { id: mine.id, version: mine.version });
    // The partner deletes a task the owner owns: the list is shared.
    await deleteTask(db, couple.partner, { id: theirs.id, version: theirs.version });

    expect(await listTasksForDay(db, couple.owner, couple.today)).toEqual([]);
    expect((await caught(() => getTask(db, couple.owner, mine.id))).status).toBe(404);
  });

  it('an outsider cannot delete the couple’s task — it is not found, and it stays', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });

    const error = await caught(() => deleteTask(db, outsider, { id: task.id, version: task.version }));
    expect(error.status).toBe(404);
    expect(await listTasksForDay(db, couple.owner, couple.today)).toHaveLength(1);
  });

  it('a task changed on the other phone meanwhile is not deleted blind', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id, title: 'ישן' });
    await updateTask(db, couple.partner, { id: task.id, version: task.version, title: 'חדש' });

    const error = await caught(() => deleteTask(db, couple.owner, { id: task.id, version: task.version }));
    expect(error.status).toBe(409);
    expect(await listTasksForDay(db, couple.owner, couple.today)).toHaveLength(1);
  });

  it('a rated task takes its rating with it', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });
    await rateTask(db, couple.partner, { taskId: task.id, value: 4 });
    const rated = await getTask(db, couple.owner, task.id);

    await deleteTask(db, couple.owner, { id: task.id, version: rated.version });

    expect(await db.taskRating.count({ where: { taskId: task.id } })).toBe(0);
    expect(await db.dailyTask.count({ where: { id: task.id } })).toBe(0);
  });

  it('is audited, with the title and who deleted it', async () => {
    const task = await makeTask(couple, { ownerId: couple.partner.id, title: 'להוציא את הזבל' });
    await deleteTask(db, couple.partner, { id: task.id, version: task.version });

    const row = await db.auditEvent.findFirst({ where: { action: 'task.deleted', entityId: task.id } });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(couple.partner.id);
    expect(JSON.stringify(row!.before)).toContain('להוציא את הזבל');
  });
});
