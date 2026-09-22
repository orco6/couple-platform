import { requireActor } from '@/core/auth/guards';
import { db } from '@/core/db/client';
import { apiRoute, created, readBody, readQuery } from '@/core/http/handler';
import { withIdempotency } from '@/core/http/idempotency';
import { createCustomer, createCustomerSchema, customerListQuerySchema, listCustomers } from '@/domain/sample/customers';

export const GET = apiRoute('customers.list', async ({ request }) => {
  const actor = await requireActor();
  return listCustomers(db, actor, readQuery(request, customerListQuerySchema));
});

export const POST = apiRoute('customers.create', async ({ request }) => {
  const actor = await requireActor();
  return withIdempotency(request, actor.id, 'customers.create', async () => {
    const input = await readBody(request, createCustomerSchema);
    return created(await createCustomer(db, actor, input));
  });
});
