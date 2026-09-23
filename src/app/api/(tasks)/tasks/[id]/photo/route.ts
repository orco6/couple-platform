import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { errors } from '@/core/errors/errors';
import { copy } from '@/domain/copy';
import { getTaskPhoto, MAX_PHOTO_BYTES, removeTaskPhoto, setTaskPhoto } from '@/domain/tasks/task-photos';

/**
 * A task's photo. The body is the image itself (not JSON): the platform's JSON
 * body limit is for forms, and a photo has its own, larger one. The service
 * checks the scope, the signature and the size; the proxy has already refused
 * any cross-origin write.
 */

export const GET = apiRoute<{ id: string }>('tasks.photo.read', async ({ params }) => {
  const actor = await requireActor();
  const photo = await getTaskPhoto(db, actor, params.id);
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

export const PUT = apiRoute<{ id: string }>('tasks.photo.set', async ({ request, params }) => {
  const actor = await requireActor();
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_PHOTO_BYTES) throw errors.validation(copy.tasks.photoTooBig, { photo: copy.tasks.photoTooBig });
  const bytes = new Uint8Array(await request.arrayBuffer());
  return setTaskPhoto(db, actor, {
    taskId: params.id,
    bytes,
    declaredType: request.headers.get('content-type'),
  });
});

export const DELETE = apiRoute<{ id: string }>('tasks.photo.remove', async ({ params }) => {
  const actor = await requireActor();
  return removeTaskPhoto(db, actor, params.id);
});
