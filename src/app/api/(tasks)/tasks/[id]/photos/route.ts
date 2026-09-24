import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created } from '@/core/http/handler';
import { errors } from '@/core/errors/errors';
import { copy } from '@/domain/copy';
import { addTaskPhoto, MAX_PHOTO_BYTES } from '@/domain/tasks/task-photos';

/**
 * Add a photo to a task. The body is the image itself (not JSON): the
 * platform's JSON body limit is for forms, and a photo has its own, larger
 * one. The service checks the scope, the signature, the size and the count;
 * the proxy has already refused any cross-origin write.
 */
export const POST = apiRoute<{ id: string }>('tasks.photos.add', async ({ request, params }) => {
  const actor = await requireActor();
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_PHOTO_BYTES) throw errors.validation(copy.tasks.photoTooBig, { photo: copy.tasks.photoTooBig });
  const bytes = new Uint8Array(await request.arrayBuffer());
  return created(await addTaskPhoto(db, actor, { taskId: params.id, bytes, declaredType: request.headers.get('content-type') }));
});
