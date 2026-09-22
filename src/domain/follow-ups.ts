/**
 * FOLLOW-UP TARGETS — שנינו.
 *
 * Deliberately none.
 *
 * A manual follow-up is "someone should look at this record, and here is a
 * note about it". That is a useful idea in an office with colleagues and a
 * queue. Inside a couple there is nobody to assign one to: the only other
 * person is the partner, and leaving them an assigned ticket about a task or
 * about yesterday's rating is exactly the tone this product must not have
 * (BUSINESS_RULES.md §8).
 *
 * The one thing worth surfacing — a day neither of them closed — is a derived
 * attention rule instead (src/domain/attention.ts), because it resolves itself
 * when the data changes and needs no note.
 *
 * Follow-up notes are also stored in the audit log, which the OWNER can read;
 * a couple's follow-up note would be the wrong thing in the wrong place.
 */

import { defineFollowUpTargets } from '@/core/follow-ups/targets';

export const followUpTargets = defineFollowUpTargets({
  kinds: {},
  entities: {},
});
