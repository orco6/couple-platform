/**
 * CORE test factories — independent of any business domain.
 * Sample-domain factories live in tests/integration/sample/factories.ts.
 */

import { randomBytes } from 'node:crypto';
import type { Actor } from '@/core/auth/actor';
import { hashPassword } from '@/core/auth/password-hash';
import { db } from '@/core/db/client';

export const TEST_PASSWORD = 'correct-horse-battery';

/** scrypt at log2N=10: fast for tests, same code path as production. */
const FAST = { log2N: 10, r: 8, p: 1 };

export async function makeUser(options: {
  role: string;
  name?: string;
  username?: string;
  status?: 'ACTIVE' | 'DISABLED';
  mustChangePassword?: boolean;
  password?: string;
}): Promise<Actor> {
  const suffix = randomBytes(3).toString('hex');
  const user = await db.user.create({
    data: {
      name: options.name ?? `משתמש ${suffix}`,
      username: options.username ?? `user-${suffix}`,
      role: options.role,
      status: options.status ?? 'ACTIVE',
      mustChangePassword: options.mustChangePassword ?? false,
      passwordHash: await hashPassword(options.password ?? TEST_PASSWORD, FAST),
    },
  });
  return { id: user.id, name: user.name, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword };
}

export interface RefusedError {
  category: string;
  code: string;
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

/** Run `work` and return the AppError it throws (fails the test if it does not throw). */
export async function caught(work: () => Promise<unknown>): Promise<RefusedError> {
  try {
    await work();
  } catch (error) {
    return error as RefusedError;
  }
  throw new Error('Expected the operation to be refused, but it succeeded');
}
