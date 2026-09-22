/**
 * Couple-domain test factories. Everything goes through the services, so a
 * fixture can never reach a state the product cannot.
 */

import type { Actor } from '@/core/auth/actor';
import { todayIn, type CalendarDate } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { linkPartner } from '@/domain/partners';
import { createTask, transitionTask, type TaskView } from '@/domain/tasks/tasks';
import { makeUser } from '../../support/factories';

export interface Couple {
  owner: Actor;
  partner: Actor;
  today: CalendarDate;
}

/** Two linked partners: the owner (side A) and the invited partner (side B). */
export async function makeCouple(): Promise<Couple> {
  const owner = await makeUser({ role: 'OWNER', name: 'נועה' });
  const partner = await makeUser({ role: 'PARTNER', name: 'איתי' });
  await linkPartner(db, owner, { partnerId: partner.id });
  return { owner, partner, today: todayIn() };
}

/** A task on the shared list, owned by whoever is given. */
export async function makeTask(
  couple: Couple,
  options: { ownerId: string; title?: string; date?: CalendarDate },
): Promise<TaskView> {
  return createTask(db, couple.owner, {
    title: options.title ?? 'משימה לבדיקה',
    ownerId: options.ownerId,
    taskDate: options.date ?? couple.today,
    dueTime: null,
    note: null,
  });
}

/** A task that has been completed, so it can be rated. */
export async function makeCompletedTask(
  couple: Couple,
  options: { ownerId: string; title?: string; date?: CalendarDate; completedBy?: Actor },
): Promise<TaskView> {
  const task = await makeTask(couple, options);
  return transitionTask(db, options.completedBy ?? couple.owner, {
    id: task.id,
    version: task.version,
    to: 'COMPLETED',
  });
}
