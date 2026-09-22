import { z } from 'zod';

import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { parseLocalTime } from '@/core/dates/local-time';
import { apiRoute, readBody } from '@/core/http/handler';
import { updateSetting } from '@/core/settings/settings';
import { REVIEW_TIME_KEY } from '@/domain/settings';

/**
 * The shared review time. A dedicated route rather than the core settings
 * screen because this is the one setting a partner actually changes, and it
 * belongs on the product's own settings page with a real TimeInput.
 *
 * `updateSetting` re-checks `settings.manage` and validates against the
 * setting's own schema, so this handler only shapes the request.
 */
export const reviewTimeSchema = z
  .object({
    time: z
      .string()
      .refine((value) => /^\d{2}:\d{2}$/.test(value) && parseLocalTime(value) !== null, 'שעה בפורמט HH:MM'),
  })
  .strict();

export const PUT = apiRoute('settings.review_time', async ({ request }) => {
  const actor = await requireActor();
  const input = await readBody(request, reviewTimeSchema);
  await updateSetting(db, actor, REVIEW_TIME_KEY, input.time);
  return { ok: true };
});
