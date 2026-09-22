import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created, readBody } from '@/core/http/handler';
import { withIdempotency } from '@/core/http/idempotency';
import { createNote, createNoteSchema } from '@/domain/sample/notes';

export const POST = apiRoute<{ id: string }>('notes.create', async ({ request, params }) => {
  const actor = await requireActor();
  return withIdempotency(request, actor.id, 'notes.create', async () => {
    const input = await readBody(request, createNoteSchema);
    return created(await createNote(db, actor, params.id, input));
  });
});
