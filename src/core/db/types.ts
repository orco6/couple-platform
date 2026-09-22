import type { Prisma } from '@/generated/prisma/client';
import type { Database } from './create-client';

/** A client usable inside or outside a transaction. Services accept this. */
export type DbClient = Database | Prisma.TransactionClient;

/** Prisma error codes the platform translates into user-facing categories. */
export function prismaErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null;
  }
  return null;
}

export const isUniqueViolation = (error: unknown) => prismaErrorCode(error) === 'P2002';
export const isRecordNotFound = (error: unknown) => prismaErrorCode(error) === 'P2025';
export const isForeignKeyViolation = (error: unknown) => prismaErrorCode(error) === 'P2003';
