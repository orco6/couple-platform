import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, readBody } from '@/core/http/handler';
import { getCustomer, updateCustomer, updateCustomerSchema } from '@/domain/sample/customers';

type Params = { id: string };

export const GET = apiRoute<Params>('customers.get', async ({ params }) => {
  const actor = await requireActor();
  return getCustomer(db, actor, params.id);
});

export const PATCH = apiRoute<Params>('customers.update', async ({ request, params }) => {
  const actor = await requireActor();
  const input = await readBody(request, updateCustomerSchema);
  return updateCustomer(db, actor, params.id, input);
});
