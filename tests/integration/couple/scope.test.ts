/**
 * R-ACC-02 — THE COUPLE IS THE SCOPE.
 *
 * A third signed-in account is the realistic attacker here: not a stranger,
 * but a correctly-authenticated user holding the default PARTNER role who is
 * not one of the two in the link. Everything they can reach, they reach with a
 * valid session, so the only thing standing between them and the household's
 * list is the scope. Tested at the service layer, where the scope lives.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { rateTask } from '@/domain/tasks/task-ratings';
import {
  createTask,
  getTask,
  listArchivedTasks,
  listTasksForDay,
  listTasksInRange,
  transitionTask,
  updateTask,
} from '@/domain/tasks/tasks';
import { submitDayEntry } from '@/domain/day-entries/day-entries';
import { addDays } from '@/core/dates/calendar-date';

import { caught, makeUser } from '../../support/factories';
import { makeCompletedTask, makeCouple, makeTask, type Couple } from './factories';

let couple: Couple;
let outsider: Actor;

beforeEach(async () => {
  couple = await makeCouple();
  // Same role as a real partner, and active. Only the link is missing.
  outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
});

describe('reads', () => {
  it('an outsider sees an empty list, not the couple’s', async () => {
    await makeTask(couple, { ownerId: couple.owner.id, title: 'לקנות חלב' });

    expect(await listTasksForDay(db, couple.owner, couple.today)).toHaveLength(1);
    expect(await listTasksForDay(db, outsider, couple.today)).toEqual([]);
  });

  it('a single task is not found for an outsider, rather than forbidden', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });

    const error = await caught(() => getTask(db, outsider, task.id));
    expect(error.status).toBe(404);
  });

  it('the archive and the summary ranges are scoped too', async () => {
    const task = await makeTask(couple, { ownerId: couple.partner.id });
    await transitionTask(db, couple.owner, { id: task.id, version: task.version, to: 'ARCHIVED', reason: 'לא רלוונטי' });

    expect(await listArchivedTasks(db, couple.owner)).toHaveLength(1);
    expect(await listArchivedTasks(db, outsider)).toEqual([]);

    const from = addDays(couple.today, -7);
    const to = addDays(couple.today, 1);
    await makeTask(couple, { ownerId: couple.owner.id });
    expect(await listTasksInRange(db, couple.owner, from, to)).toHaveLength(1);
    expect(await listTasksInRange(db, outsider, from, to)).toEqual([]);
  });
});

describe('writes', () => {
  it('an outsider cannot add a task, even naming a real partner as its owner', async () => {
    const error = await caught(() =>
      createTask(db, outsider, {
        title: 'משימה שהושתלה',
        ownerId: couple.partner.id,
        taskDate: couple.today,
        dueTime: null,
        note: null,
      }),
    );

    expect(error.code).toBe('NOT_IN_PARTNERSHIP');
    expect(error.status).toBe(422);
  });

  it('an outsider cannot edit or complete the couple’s task', async () => {
    const task = await makeTask(couple, { ownerId: couple.owner.id });

    const edited = await caught(() =>
      updateTask(db, outsider, { id: task.id, version: task.version, title: 'נכתב בידי זר' }),
    );
    expect(edited.status).toBe(404);

    const moved = await caught(() =>
      transitionTask(db, outsider, { id: task.id, version: task.version, to: 'COMPLETED' }),
    );
    expect(moved.status).toBe(404);

    // And the row is untouched.
    expect((await getTask(db, couple.owner, task.id)).state).toBe('OPEN');
  });

  it('an outsider cannot rate the couple’s completed task', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id });

    const error = await caught(() => rateTask(db, outsider, { taskId: task.id, value: 1 }));

    expect(error.status).toBe(422);
    expect((await getTask(db, couple.owner, task.id)).rating).toBeNull();
  });

  it('an outsider cannot close a day in this couple', async () => {
    const error = await caught(() =>
      submitDayEntry(db, outsider, { entryDate: couple.today, respectRating: 5, note: null }),
    );

    expect(error.code).toBe('NOT_IN_PARTNERSHIP');
  });
});
