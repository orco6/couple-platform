import 'server-only';

import { cache } from 'react';
import { db } from '@/core/db/client';
import { readSessionToken } from './cookies';
import { resolveSessionToken, type ResolvedSession } from './session';

/**
 * The session for the current request, resolved at most once per request
 * (React `cache`), however many components and guards ask for it.
 */
export const getCurrentSession = cache(async (): Promise<ResolvedSession | null> => {
  return resolveSessionToken(db, await readSessionToken());
});
