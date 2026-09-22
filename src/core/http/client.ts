/**
 * Browser-side API requests.
 *
 * Every failure becomes an ApiError with a user-facing sentence and field
 * errors the form can attach to inputs — callers never interpret status codes
 * or stacks, so the text a person reads is written in one place (the server).
 */

import { copy } from '@/core/copy';
import { navigateAfterSessionChange } from './navigation';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly category: string,
    readonly userMessage: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as Idempotency-Key; reuse the same key for retries of one logical submit. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** Dispatched on window when a write is refused because the session ended. */
export const SESSION_ENDED_EVENT = 'app:session-ended';

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'unexpected', copy.errors.offline);
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; category?: string; message?: string }; fieldErrors?: Record<string, string> }
    | null;

  if (!response.ok) {
    const code = payload?.error?.code ?? 'UNKNOWN';
    if (typeof window !== 'undefined') {
      if (response.status === 401 && code === 'UNAUTHENTICATED') {
        if (method === 'GET') {
          // Loading data: nothing typed is at stake. Sign in, then come back here.
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          navigateAfterSessionChange(`/login?next=${next}`);
        } else {
          // A SAVE failed because the session ended. Navigating away would throw away
          // what the person typed. Stay on the page, keep the form, and let the app
          // shell offer sign-in in a new tab (SessionNotice); the retry keeps working.
          window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
          throw new ApiError(401, code, 'authentication', copy.errors.sessionEndedKeepInput);
        }
      }
      if (code === 'PASSWORD_CHANGE_REQUIRED') navigateAfterSessionChange('/change-password');
    }
    throw new ApiError(
      response.status,
      code,
      payload?.error?.category ?? 'unexpected',
      payload?.error?.message ?? copy.errors.unexpected,
      payload?.fieldErrors ?? {},
    );
  }

  return payload as T;
}
