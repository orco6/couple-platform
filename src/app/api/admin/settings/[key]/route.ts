import { z } from 'zod';
import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { updateSetting } from '@/core/settings/settings';

const schema = z.object({ value: z.unknown() }).strict();

export const PUT = apiRoute<{ key: string }>('admin.settings.update', async ({ request, params }) => {
  const actor = await requireActor();
  const { value } = await readBody(request, schema);
  await updateSetting(db, actor, params.key, value);
  return { ok: true };
});
