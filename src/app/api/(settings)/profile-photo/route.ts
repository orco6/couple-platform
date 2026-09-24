import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { errors } from '@/core/errors/errors';
import { apiRoute } from '@/core/http/handler';
import { copy } from '@/domain/copy';
import { removeProfilePhoto, setProfilePhoto } from '@/domain/profile-photos';
import { MAX_PHOTO_BYTES } from '@/domain/tasks/task-photos';

/**
 * My own photo. The body is the image itself (not JSON), like a task photo;
 * the service checks the signature and the size.
 */
export const PUT = apiRoute('profile.photo.set', async ({ request }) => {
  const actor = await requireActor();
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_PHOTO_BYTES) throw errors.validation(copy.tasks.photoTooBig, { photo: copy.tasks.photoTooBig });
  const bytes = new Uint8Array(await request.arrayBuffer());
  return setProfilePhoto(db, actor, { bytes, declaredType: request.headers.get('content-type') });
});

export const DELETE = apiRoute('profile.photo.remove', async () => {
  const actor = await requireActor();
  return removeProfilePhoto(db, actor);
});
