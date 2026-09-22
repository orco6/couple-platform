/**
 * ATTENTION RULES FOR THIS BUSINESS — replace per project.
 *
 * Each rule is a SCOPED query for records that are valid but need a look
 * (missing document, late payment). See src/core/follow-ups/attention.ts.
 */

import type { AttentionRule } from '@/core/follow-ups/attention';

export const attentionRules: AttentionRule[] = [];
