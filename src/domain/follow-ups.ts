/**
 * FOLLOW-UP TARGETS FOR THIS BUSINESS — replace per project.
 *
 * Which records can carry a manual follow-up, with a SCOPED reachability check
 * for each. See src/core/follow-ups/targets.ts for an example.
 */

import { defineFollowUpTargets } from '@/core/follow-ups/targets';

export const followUpTargets = defineFollowUpTargets({
  kinds: {},
  entities: {},
});
