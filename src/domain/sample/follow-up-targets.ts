/**
 * SAMPLE DOMAIN — which records can carry a manual follow-up.
 */

import { defineFollowUpTargets } from '@/core/follow-ups/targets';
import { customerScope } from './customers';
import { taskScope } from './tasks';

export const sampleFollowUpTargets = defineFollowUpTargets({
  kinds: {
    call_back: 'לחזור ללקוח',
    missing_document: 'חסר מסמך',
    payment_delayed: 'תשלום מתעכב',
    check_details: 'לבדוק פרטים',
  },
  entities: {
    customer: {
      label: 'לקוח',
      canReach: async (client, actor, id) =>
        Boolean(await client.customer.findFirst({ where: { AND: [customerScope(actor), { id }] }, select: { id: true } })),
      href: (id) => `/customers/${id}`,
    },
    task: {
      label: 'משימה',
      canReach: async (client, actor, id) =>
        Boolean(await client.task.findFirst({ where: { AND: [taskScope(actor), { id }] }, select: { id: true } })),
      href: (id) => `/tasks/${id}`,
    },
  },
});
