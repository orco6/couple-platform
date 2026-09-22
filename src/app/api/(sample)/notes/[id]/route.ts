import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { deleteNote } from '@/domain/sample/notes';

export const DELETE = apiRoute<{ id: string }>('notes.delete', async ({ params }) => {
  const actor = await requireActor();
  await deleteNote(db, actor, params.id);
  return { ok: true };
});
