/**
 * Create the FIRST account in a fresh deployment (including production).
 *
 *   DATABASE_URL=<target> npm run db:bootstrap-owner -- --name "שם" --username owner --confirm <database-name>
 *
 * Safe by construction rather than by guard:
 *   • refuses if ANY user already exists — it can never overwrite, reset or
 *     add to an existing installation (use the admin screen for that);
 *   • requires --confirm with the exact database name;
 *   • generates the temporary password (the operator never chooses one),
 *     prints it once, and the owner must replace it on first sign-in.
 *
 * Emergency access to an installation that has users but no working
 * administrator is a different, deliberate procedure: see DISASTER_RECOVERY in
 * PRODUCTION_READINESS.md.
 */

import { access } from '@/domain/contract';
import { topRoles } from '@/core/access/role-queries';
import { hashPassword } from '@/core/auth/password-hash';
import { generateTemporaryPassword } from '@/core/auth/temporary-password';
import { isValidUsername, normalizeUsername } from '@/core/auth/username';
import { recordAudit } from '@/core/audit/record';
import { connect, printTarget, requireDatabaseUrl } from './lib/database';

function argument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const url = requireDatabaseUrl();
  printTarget(url);
  const database = new URL(url).pathname.replace(/^\//, '');

  const name = argument('name')?.trim();
  const username = normalizeUsername(argument('username') ?? '');
  const role = argument('role') ?? topRoles()[0] ?? '';

  if (argument('confirm') !== database) {
    console.error(`Refusing: pass --confirm ${database}`);
    process.exit(2);
  }
  if (!name || !isValidUsername(username) || !access.isRole(role) || !access.roleHas(role, 'users.manage')) {
    console.error('Usage: --name "<display name>" --username <latin username> [--role OWNER] --confirm <db>');
    console.error('The role must be allowed to manage users.');
    process.exit(1);
  }

  const db = connect(url);
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      console.error(`Refusing: this database already has ${existing} user(s). Bootstrap only runs on an empty installation.`);
      process.exit(2);
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await db.user.create({
      data: { name, username, role, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
    });
    await recordAudit(db, {
      actor: null,
      action: 'user.bootstrapped',
      entityType: 'user',
      entityId: user.id,
      subjectUserId: user.id,
      after: { name, username, role },
    });

    console.log(`\nCreated ${access.roleLabel(role)} "${name}" (${username}).`);
    console.log(`Temporary password (shown once): ${temporaryPassword}`);
    console.log('Sign in and choose a personal password immediately.\n');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
