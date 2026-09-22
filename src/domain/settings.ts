/**
 * BUSINESS SETTINGS — שנינו.
 *
 * Exactly one, because a couple should not have a preferences screen.
 *
 * R-SET-01 — the review time is read with `getSetting` on every submission and
 * never cached, and the "can we close the day yet" flag on the view is computed
 * from the same read the service enforces with. A stale copy would let the UI
 * offer an action the server refuses.
 *
 * R-SET-02 — only `settings.manage` (OWNER) may change it. A shared ritual time
 * that one partner can move silently is a trust problem, so the other partner
 * sees it read-only with a line saying who changes it.
 *
 * It does NOT affect history: an entry records its own `submittedAt`, so moving
 * the time never invalidates a day that was already closed.
 *
 * `input.kind` is 'text' because core's setting inputs are integer / rate_bps /
 * text / boolean — there is no time kind. Rather than widen core for one
 * business, the schema below is strict about "HH:MM" and the product's own
 * settings screen renders a proper `TimeInput` over the same `updateSetting`.
 * The core admin screen shows a validated text field, which is acceptable for
 * a surface only the owner sees and rarely uses.
 */

import { z } from 'zod';

import { parseLocalTime, type LocalTime } from '@/core/dates/local-time';
import { defineSetting } from '@/core/settings/define-setting';

import { copy } from './copy';

export const REVIEW_TIME_KEY = 'review.daily_time';

/** "HH:MM" in the business timezone, two-digit hours, strictly parsed. */
const localTimeSchema = z
  .string()
  .refine((value) => /^\d{2}:\d{2}$/.test(value) && parseLocalTime(value) !== null, {
    message: 'שעה בפורמט HH:MM',
  })
  .transform((value) => value as LocalTime);

export const settingDefinitions = {
  [REVIEW_TIME_KEY]: defineSetting<LocalTime>({
    label: copy.settings.reviewTimeLabel,
    description: copy.settings.reviewTimeDescription,
    schema: localTimeSchema,
    // Late enough that the day is genuinely over, early enough that nobody has
    // to stay awake for it.
    defaultValue: '21:30' as LocalTime,
    input: { kind: 'text', maxLength: 5 },
  }),
} as const;
