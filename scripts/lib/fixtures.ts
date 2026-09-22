/**
 * Development, QA and E2E fixtures — GENERIC part.
 *
 * Users are derived from whatever roles the domain declares
 * (src/domain/access.ts), so this file never changes per business:
 *
 *   for every role R:   "<r>" and "<r>2"      (two people, for "other owner" tests)
 *   "pending"           default role, must change password on first sign-in
 *   "disabled"          default role, status DISABLED
 *
 * Business data comes from src/domain/dev-data.ts (seedDomainData), created
 * THROUGH THE DOMAIN SERVICES so fixtures obey the same validation, lifecycle
 * and audit rules as real use.
 *
 * Only ever called by scripts that have already passed `guard(...)`.
 */

import { access } from '@/domain/contract';
import { seedDomainData } from '@/domain/dev-data';
import { hashPassword } from '@/core/auth/password-hash';
import type { DevUsers } from '@/core/dev-data/types';
import { topRoles } from '@/core/access/role-queries';
import type { Database } from '@/core/db/create-client';
import { connect, truncateAll } from './database';

/** Local development credentials. Never valid anywhere else: the seed refuses non-local databases. */
export const DEV_PASSWORD = 'yesod-dev-password';

const FIRST_NAMES = ['נועה', 'איתי', 'מיכל', 'דני', 'שירה', 'יואב', 'רותם', 'עומר', 'הדס', 'אורי', 'טל', 'ליאת', 'גיל', 'מאיה'];
const LAST_NAMES = ['ברק', 'שגיא', 'רון', 'לוי', 'כהן', 'אדלר', 'גל', 'פרץ', 'אזולאי', 'מזרחי', 'ביטון', 'דהן', 'אברהם', 'פרידמן'];

export type { DevUsers };

export async function createDevUsers(db: Database): Promise<DevUsers> {
  const passwordHash = await hashPassword(DEV_PASSWORD);
  let index = 0;
  const create = async (username: string, role: string, extra: { mustChangePassword?: boolean; status?: 'ACTIVE' | 'DISABLED' } = {}) => {
    const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 5) % LAST_NAMES.length]}`;
    index += 1;
    const user = await db.user.create({
      data: {
        name,
        username,
        role,
        passwordHash,
        mustChangePassword: extra.mustChangePassword ?? false,
        status: extra.status ?? 'ACTIVE',
        passwordChangedAt: new Date(),
      },
    });
    return { id: user.id, name: user.name, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword };
  };

  const byRole: DevUsers['byRole'] = {};
  for (const role of access.roles) {
    const key = role.toLowerCase().replace(/_/g, '-');
    byRole[role] = [await create(key, role), await create(`${key}2`, role)];
  }
  const top = byRole[topRoles()[0] ?? access.roles[0]!]![0];
  const pending = await create('pending', access.defaultRole, { mustChangePassword: true });
  const disabled = await create('disabled', access.defaultRole, { status: 'DISABLED' });
  return { byRole, top, pending, disabled };
}

export async function seedDevData(url: string, scenario: 'minimal' | 'realistic' = 'realistic'): Promise<void> {
  const db = connect(url);
  try {
    await truncateAll(db);
    const users = await createDevUsers(db);
    if (scenario === 'realistic') await seedDomainData(db, users);
    const usernames = Object.values(users.byRole).flatMap((pair) => pair.map((user) => user.username));
    console.log(`\nSeeded "${scenario}" data. Local sign-in (password "${DEV_PASSWORD}"): ${usernames.join(', ')}`);
    console.log('  "pending" must choose a new password on first sign-in; "disabled" cannot sign in.\n');
  } finally {
    await db.$disconnect();
  }
}
