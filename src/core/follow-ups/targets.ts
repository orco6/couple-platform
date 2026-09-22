/**
 * Which records can carry a manual follow-up, declared by the domain.
 *
 * For each entity type: a label, a SCOPED reachability check (a person may only
 * flag or see follow-ups on records they can see), and the record's URL.
 * `kinds` is the domain's vocabulary of follow-up reasons.
 *
 *   export const followUpTargets = defineFollowUpTargets({
 *     kinds: { missing_document: 'חסר מסמך' },
 *     entities: {
 *       order: {
 *         label: 'הזמנה',
 *         canReach: async (db, actor, id) => Boolean(await db.order.findFirst({ where: { AND: [orderScope(actor), { id }] }, select: { id: true } })),
 *         href: (id) => `/orders/${id}`,
 *       },
 *     },
 *   });
 */

import type { Actor } from '@/core/auth/actor';
import type { DbClient } from '@/core/db/types';

export interface FollowUpEntity {
  label: string;
  canReach: (client: DbClient, actor: Actor, entityId: string) => Promise<boolean>;
  href: (entityId: string) => string;
}

export interface FollowUpTargets {
  kinds: Record<string, string>;
  entities: Record<string, FollowUpEntity>;
}

export function defineFollowUpTargets<const T extends FollowUpTargets>(targets: T): T {
  for (const kind of Object.keys(targets.kinds)) {
    if (!/^[a-z_]{2,40}$/.test(kind)) throw new Error(`Follow-up kind "${kind}" must be snake_case`);
  }
  for (const entity of Object.keys(targets.entities)) {
    if (!/^[a-z_]{2,40}$/.test(entity)) throw new Error(`Follow-up entity "${entity}" must be snake_case`);
  }
  return targets;
}
