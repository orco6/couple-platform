import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { linkPartner, linkPartnerSchema } from '@/domain/partners';

export const POST = apiRoute('partnership.link', async ({ request }) => {
  const actor = await requireActor();
  const input = await readBody(request, linkPartnerSchema);
  return linkPartner(db, actor, input);
});
