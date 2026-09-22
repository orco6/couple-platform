import type { Actor } from '@/core/auth/actor';
import type { Database } from '@/core/db/create-client';

/**
 * The users every dev/QA/E2E dataset starts with, derived from the domain's
 * roles (scripts/lib/fixtures.ts). Domain seeders receive them.
 */
export interface DevUsers {
  /** Two active users per role, in declaration order: "<role>" and "<role>2". */
  byRole: Record<string, [Actor, Actor]>;
  /** First user of the top role (can manage everyone). */
  top: Actor;
  pending: Actor;
  disabled: Actor;
}

/** Implemented by src/domain/dev-data.ts. Runs only against guarded local databases. */
export type DomainSeeder = (db: Database, users: DevUsers) => Promise<void>;
