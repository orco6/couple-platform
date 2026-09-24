import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { getTaskPhoto, removeTaskPhoto } from '@/domain/tasks/task-photos';

/** One photo of a task: the image (only to the couple), or its removal. */
export const GET = apiRoute<{ id: string; photoId: string }>('tasks.photos.read', async ({ params }) => {
  const actor = await requireActor();
  const photo = await getTaskPhoto(db, actor, params.id, params.photoId);
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      'Content-Type': photo.mimeType,
      // The URL carries the photo's version, so it can be cached for good —
      // but only by this person's browser.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});

export const DELETE = apiRoute<{ id: string; photoId: string }>('tasks.photos.remove', async ({ params }) => {
  const actor = await requireActor();
  return removeTaskPhoto(db, actor, params.id, params.photoId);
});
