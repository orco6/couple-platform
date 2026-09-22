import { requireActor } from '@/core/auth/guards';
import { auditQuerySchema, listAuditEvents } from '@/core/audit/query';
import { db } from '@/core/db/client';
import { apiRoute, readQuery } from '@/core/http/handler';

export const GET = apiRoute('admin.audit.list', async ({ request }) => {
  const actor = await requireActor();
  return listAuditEvents(db, actor, readQuery(request, auditQuerySchema));
});
