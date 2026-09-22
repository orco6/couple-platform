/**
 * Application errors.
 *
 * One class, eight categories. Every error that can reach a user carries a
 * sentence written for that user (Hebrew by default, see core/copy.ts), a
 * stable machine code the client can branch on, and optionally per-field
 * messages for forms.
 *
 * Stack traces, Prisma messages and SQL never leave the server. Anything that
 * is not an AppError becomes a generic `unexpected` response; the real cause
 * is logged server-side only (core/http/handler.ts).
 */

import { copy } from '@/core/copy';

export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'business_rule'
  | 'rate_limited'
  | 'unexpected';

const STATUS: Record<ErrorCategory, number> = {
  validation: 400,
  authentication: 401,
  authorization: 403,
  not_found: 404,
  conflict: 409,
  business_rule: 422,
  rate_limited: 429,
  unexpected: 500,
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly category: ErrorCategory,
    readonly code: string,
    readonly userMessage: string,
    readonly fieldErrors?: FieldErrors,
    readonly details?: { retryAfterSeconds?: number },
  ) {
    super(`${category}/${code}: ${userMessage}`);
    this.name = 'AppError';
    this.status = STATUS[category];
  }

  toResponseBody() {
    return {
      error: { category: this.category, code: this.code, message: this.userMessage },
      ...(this.fieldErrors && Object.keys(this.fieldErrors).length > 0
        ? { fieldErrors: this.fieldErrors }
        : {}),
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const errors = {
  validation: (message: string = copy.errors.validation, fieldErrors?: FieldErrors) =>
    new AppError('validation', 'VALIDATION_FAILED', message, fieldErrors),

  authentication: (message: string = copy.errors.authentication) =>
    new AppError('authentication', 'UNAUTHENTICATED', message),

  authorization: (message: string = copy.errors.authorization) =>
    new AppError('authorization', 'FORBIDDEN', message),

  passwordChangeRequired: () =>
    new AppError('authorization', 'PASSWORD_CHANGE_REQUIRED', copy.errors.passwordChangeRequired),

  /**
   * Used both for "does not exist" and "exists but is outside your scope".
   * Answering 403 for someone else's record would confirm that it exists.
   */
  notFound: (message: string = copy.errors.notFound) => new AppError('not_found', 'NOT_FOUND', message),

  conflict: (message: string = copy.errors.conflict, code = 'CONFLICT') =>
    new AppError('conflict', code, message),

  /** The record changed since the client read it (optimistic concurrency). */
  staleWrite: () => new AppError('conflict', 'STALE_WRITE', copy.errors.staleWrite),

  businessRule: (code: string, message: string, fieldErrors?: FieldErrors) =>
    new AppError('business_rule', code, message, fieldErrors),

  rateLimited: (message: string, retryAfterSeconds?: number) =>
    new AppError('rate_limited', 'RATE_LIMITED', message, undefined, { retryAfterSeconds }),
};
