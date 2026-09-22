/**
 * R-RATE-01..04 — who may rate a completed task, and who may not.
 *
 * The asymmetry is the product's feature, so it is tested from both sides and
 * through the authority-carrying field (`ownerId`) that decides it.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/core/db/client';
import { rateTask } from '@/domain/tasks/task-ratings';
import { getTask, transitionTask, updateTask } from '@/domain/tasks/tasks';

import { caught, makeUser } from '../../support/factories';
import { makeCompletedTask, makeCouple, makeTask, type Couple } from './factories';

let couple: Couple;

beforeEach(async () => {
  couple = await makeCouple();
});

describe('R-RATE-01 the partner who does not own the task rates it', () => {
  it('the non-owner may rate a completed task', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id, completedBy: couple.partner });

    const rating = await rateTask(db, couple.owner, { taskId: task.id, value: 4 });

    expect(rating.value).toBe(4);
    expect(rating.ratedById).toBe(couple.owner.id);
  });

  it('the owner may NOT rate their own task', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });

    const error = await caught(() => rateTask(db, couple.owner, { taskId: task.id, value: 5 }));

    expect(error.code).toBe('TASK_IS_MINE');
    expect(error.category).toBe('business_rule');
  });

  it('a task that is not finished cannot be rated', async () => {
    const task = await makeTask(couple, { ownerId: couple.partner.id });

    const error = await caught(() => rateTask(db, couple.owner, { taskId: task.id, value: 3 }));

    expect(error.code).toBe('TASK_NOT_COMPLETED');
  });

  it('somebody outside the couple cannot rate, even holding the permission', async () => {
    // A spare account with the PARTNER role: it holds task_ratings.rate and it
    // is not the owner, so a "not mine" check would have let it through. The
    // gate is "owned by MY partner", read from the link.
    const outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });

    const error = await caught(() => rateTask(db, outsider, { taskId: task.id, value: 1 }));

    // An account outside the link has no partner at all, which is the more
    // accurate thing to say than "not your partner's task". Either refusal is
    // correct; what matters is that nothing was written.
    expect(error.code).toBe('NO_PARTNERSHIP');
    expect(error.category).toBe('business_rule');
    expect(await db.taskRating.count()).toBe(0);
  });
});

describe('R-RATE-03 a rating can be changed by its author, never removed', () => {
  it('the same partner may change their rating', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id, completedBy: couple.partner });
    await rateTask(db, couple.owner, { taskId: task.id, value: 2 });

    const changed = await rateTask(db, couple.owner, { taskId: task.id, value: 5 });

    expect(changed.value).toBe(5);
    const rows = await db.taskRating.findMany({ where: { taskId: task.id } });
    expect(rows).toHaveLength(1);
  });

  it('a rating survives an outsider trying to overwrite it', async () => {
    const outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });
    await rateTask(db, couple.partner, { taskId: task.id, value: 4 });

    const error = await caught(() => rateTask(db, outsider, { taskId: task.id, value: 1 }));

    expect(error.category).toBe('business_rule');
    const rows = await db.taskRating.findMany({ where: { taskId: task.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(4);
  });
});

describe('R-RATE-04 a task owner must be one of the two linked partners', () => {
  it('creating a task owned by an outsider is refused', async () => {
    const outsider = await makeUser({ role: 'PARTNER', name: 'זר' });

    const error = await caught(() => makeTask(couple, { ownerId: outsider.id }));

    expect(error.category).toBe('validation');
    expect(error.fieldErrors?.ownerId).toBeTruthy();
  });

  it('reassigning a task to an outsider is refused', async () => {
    const outsider = await makeUser({ role: 'PARTNER', name: 'זר' });
    const task = await makeTask(couple, { ownerId: couple.owner.id });

    const error = await caught(() =>
      updateTask(db, couple.owner, { id: task.id, version: task.version, ownerId: outsider.id }),
    );

    expect(error.category).toBe('validation');
  });
});

describe('the rate flag on the view matches what the service accepts', () => {
  it('open task: nobody may rate', async () => {
    const task = await makeTask(couple, { ownerId: couple.partner.id });

    expect((await getTask(db, couple.owner, task.id)).permissions.rate).toBe(false);
    expect((await getTask(db, couple.partner, task.id)).permissions.rate).toBe(false);
  });

  it('completed task: the non-owner may, the owner may not', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id, completedBy: couple.partner });

    expect((await getTask(db, couple.owner, task.id)).permissions.rate).toBe(true);
    expect((await getTask(db, couple.partner, task.id)).permissions.rate).toBe(false);
  });

  it('the owner sees it as waiting for the other partner', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });

    expect((await getTask(db, couple.owner, task.id)).awaitingPartnerRating).toBe(true);
    // The person who has to act does not see their own turn as "waiting".
    expect((await getTask(db, couple.partner, task.id)).awaitingPartnerRating).toBe(false);
  });

  it('once rated, the rater may change it and the owner still may not rate', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.owner.id });
    await rateTask(db, couple.partner, { taskId: task.id, value: 3 });

    const asRater = await getTask(db, couple.partner, task.id);
    const asOwner = await getTask(db, couple.owner, task.id);

    expect(asRater.permissions.rate).toBe(true);
    expect(asOwner.permissions.rate).toBe(false);
    expect(asOwner.rating).toEqual({ value: 3, ratedByName: couple.partner.name });
    expect(asOwner.awaitingPartnerRating).toBe(false);
  });

  it('reopening a completed task withdraws the ability to rate', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id, completedBy: couple.partner });
    const reopened = await transitionTask(db, couple.owner, { id: task.id, version: task.version, to: 'OPEN' });

    expect(reopened.permissions.rate).toBe(false);
    const error = await caught(() => rateTask(db, couple.owner, { taskId: task.id, value: 4 }));
    expect(error.code).toBe('TASK_NOT_COMPLETED');
  });
});

describe('R-DAY-30 the audit log holds the rating but never a private value', () => {
  it('a task rating is auditable — it is feedback about a chore, not a diary', async () => {
    const task = await makeCompletedTask(couple, { ownerId: couple.partner.id, completedBy: couple.partner });
    await rateTask(db, couple.owner, { taskId: task.id, value: 4 });

    const events = await db.auditEvent.findMany({ where: { entityType: 'task_rating' } });

    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe('task_rating.given');
    expect(JSON.stringify(events[0]?.after)).toContain('4');
  });
});
