import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created, readBody } from '@/core/http/handler';
import { withIdempotency } from '@/core/http/idempotency';
import {
  amendDayEntry,
  amendDayEntrySchema,
  submitDayEntry,
  submitDayEntrySchema,
} from '@/domain/day-entries/day-entries';

/**
 * Closing the day. Idempotent on purpose: the submit button is pressed once,
 * at night, on a phone with one bar of signal — a retry must not become a
 * second attempt that then fails on the unique index with a confusing message.
 */
export const POST = apiRoute('day_entries.submit', async ({ request }) => {
  const actor = await requireActor();
  return withIdempotency(request, actor.id, 'day_entries.submit', async () => {
    const input = await readBody(request, submitDayEntrySchema);
    return created(await submitDayEntry(db, actor, input));
  });
});

/** Changing what I wrote, allowed only until the partner closes the day. */
export const PATCH = apiRoute('day_entries.amend', async ({ request }) => {
  const actor = await requireActor();
  const input = await readBody(request, amendDayEntrySchema);
  return amendDayEntry(db, actor, input);
});
