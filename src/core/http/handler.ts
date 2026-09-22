import 'server-only';

import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { copy } from '@/core/copy';
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from '@/core/db/types';
import { AppError, errors } from '@/core/errors/errors';
import { log } from '@/core/log';
import { toFieldErrors } from '@/core/validation/fields';

/**
 * Route handler plumbing. Every API route is written as:
 *
 *   export const POST = apiRoute('customers.create', async ({ request }) => {
 *     const actor = await requireActor();
 *     const input = await readBody(request, createCustomerSchema);
 *     return created(await createCustomer(db, actor, input));
 *   });
 *
 * The wrapper maps AppError to its status and body, maps the Prisma errors that
 * have a safe meaning (unique → conflict, missing → not found), and turns
 * everything else into a generic 500 whose body says nothing about the cause.
 * The real error is logged server-side with the route name. Request bodies are
 * never logged: they carry passwords and financial data.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 256 * 1024;

export interface RouteContext<P> {
  request: Request;
  params: P;
}

type Handler<P> = (context: RouteContext<P>) => Promise<Response | unknown>;

export function apiRoute<P = Record<string, never>>(name: string, handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = context?.params ? await context.params : ({} as P);
      const result = await handler({ request, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { status: 200, headers: NO_STORE });
    } catch (error) {
      return errorResponse(name, error);
    }
  };
}

export function created<T>(data: T): Response {
  return NextResponse.json(data, { status: 201, headers: NO_STORE });
}

export function errorResponse(route: string, error: unknown): Response {
  const appError = toAppError(error);
  if (appError) {
    const headers: Record<string, string> = { ...NO_STORE };
    if (appError.details?.retryAfterSeconds) headers['Retry-After'] = String(appError.details.retryAfterSeconds);
    return NextResponse.json(appError.toResponseBody(), { status: appError.status, headers });
  }

  log.error('api.unexpected_error', { route, error });
  return NextResponse.json(
    { error: { category: 'unexpected', code: 'UNEXPECTED', message: copy.errors.unexpected } },
    { status: 500, headers: NO_STORE },
  );
}

function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (isUniqueViolation(error)) return errors.conflict();
  if (isRecordNotFound(error)) return errors.notFound();
  if (isForeignKeyViolation(error)) return errors.conflict();
  return null;
}

/**
 * Parse and validate a JSON body. The schema must be `.strict()` — unknown keys
 * are rejected, which is what prevents mass assignment.
 */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    throw new AppError('validation', 'PAYLOAD_TOO_LARGE', copy.errors.payloadTooLarge);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new AppError('validation', 'UNSUPPORTED_MEDIA_TYPE', copy.errors.badRequest);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError('validation', 'PAYLOAD_TOO_LARGE', copy.errors.payloadTooLarge);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('validation', 'MALFORMED_JSON', copy.errors.badRequest);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw errors.validation(undefined, toFieldErrors(parsed.error));
  return parsed.data;
}

/** Validate query-string parameters with a schema (all values arrive as strings). */
export function readQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw errors.validation(undefined, toFieldErrors(parsed.error));
  return parsed.data;
}

/** Best-effort client address for rate limiting only — never for authorization. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 64);
  return (request.headers.get('x-real-ip') ?? 'unknown').slice(0, 64);
}
