/** SAMPLE DOMAIN factories — delete with the sample. */

import type { Actor } from '@/core/auth/actor';
import { db } from '@/core/db/client';
import { createCustomer } from '@/domain/sample/customers';
import { createTask } from '@/domain/sample/tasks';

export async function makeCustomer(owner: Actor, creator: Actor = owner, name = 'לקוח בדיקה') {
  return createCustomer(db, creator, { name, phone: '050-1234567', email: null, city: 'חיפה', ownerId: owner.id });
}

export async function makeTask(customerId: string, creator: Actor, extra: { assigneeId?: string; priceAgorot?: number | null } = {}) {
  return createTask(db, creator, {
    customerId,
    title: 'משימת בדיקה',
    description: null,
    dueDate: null,
    assigneeId: extra.assigneeId,
    priceAgorot: extra.priceAgorot ?? null,
  });
}
