/**
 * Derived attention rules.
 *
 * A rule is a scoped query over current data that finds records needing a look.
 * The domain declares them; the "attention" screen and the home page run them.
 * Each rule receives the actor and MUST scope its query — an attention list is
 * a data view like any other.
 */

import type { Actor } from '@/core/auth/actor';
import type { DbClient } from '@/core/db/types';

export type AttentionSeverity = 'info' | 'attention' | 'urgent';

export interface AttentionItem {
  id: string;
  title: string;
  detail?: string;
  href: string;
}

export interface AttentionRule {
  key: string;
  label: string;
  /** One sentence: why this matters and what to do. Calm, not alarming. */
  description: string;
  severity: AttentionSeverity;
  list: (client: DbClient, actor: Actor, options: { limit: number }) => Promise<{ items: AttentionItem[]; total: number }>;
}

export function defineAttentionRule(rule: AttentionRule): AttentionRule {
  return rule;
}

export interface AttentionGroup {
  key: string;
  label: string;
  description: string;
  severity: AttentionSeverity;
  items: AttentionItem[];
  total: number;
}

export async function runAttentionRules(
  client: DbClient,
  actor: Actor,
  rules: readonly AttentionRule[],
  limit = 20,
): Promise<AttentionGroup[]> {
  const results = await Promise.all(
    rules.map(async (rule) => ({
      key: rule.key,
      label: rule.label,
      description: rule.description,
      severity: rule.severity,
      ...(await rule.list(client, actor, { limit })),
    })),
  );
  return results.filter((group) => group.total > 0);
}
