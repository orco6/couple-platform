import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute } from '@/core/http/handler';
import { getProfilePhoto } from '@/domain/profile-photos';

/** One partner's photo — only to the two of them. */
export const GET = apiRoute<{ userId: string }>('profile.photo.read', async ({ params }) => {
  const actor = await requireActor();
  const photo = await getProfilePhoto(db, actor, params.userId);
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      'Content-Type': photo.mimeType,
      // The URL carries the photo's version: cached for good, by this browser only.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});
