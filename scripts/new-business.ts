/**
 * Turn a fresh clone of the foundation into a new business project.
 *
 *   npm run foundation:new-business -- --name "מרפאת שיניים גבעון" --slug givon-dental
 *
 * Options:
 *   --db-port <port>   local Postgres port (default 5434); use a different one per project
 *   --keep-sample      keep the sample service-business domain (for learning)
 *   --skip-rename      only replace the sample domain (used by CI to test the blank foundation)
 *   --dry-run          print what would change, change nothing
 *   --force            run even if the git working tree has uncommitted changes
 *
 * What it does (all local file changes; review with `git diff`):
 *   1. Renames local infrastructure so two projects never share a database or
 *      container: docker container/volume, database user and names, port —
 *      in docker-compose, SQL init, .env/.env.example, test/E2E configs, CI.
 *   2. Sets package.json name, the app and legal name in src/brand/brand.ts, and clears placeholder contact details.
 *   3. Removes the sample domain (code, routes, schema, migration, tests) and
 *      installs the blank domain from templates/blank-domain.
 *   4. Creates BUSINESS_BRIEF.md and BUSINESS_RULES.md from their templates.
 *
 * It never touches a database, never deletes core code, and refuses to run
 * twice on the same checkout.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const dryRun = flag('dry-run');
const changes: string[] = [];

function fail(message: string): never {
  console.error(`\n✋ ${message}\n`);
  process.exit(1);
}

function write(path: string, content: string) {
  changes.push(`write   ${path}`);
  if (!dryRun) writeFileSync(join(root, path), content);
}

function remove(path: string) {
  if (!existsSync(join(root, path))) return;
  changes.push(`remove  ${path}`);
  if (!dryRun) rmSync(join(root, path), { recursive: true, force: true });
}

/** Paths owned by the sample domain. Deleted by --remove-sample (the default). */
export const SAMPLE_PATHS = [
  'src/domain/sample',
  'src/app/(app)/(sample)',
  'src/app/api/(sample)',
  'src/app/print/(sample)',
  'tests/unit/sample',
  'tests/integration/sample',
  'e2e/sample',
];

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function removeSample() {
  for (const path of SAMPLE_PATHS) remove(path);
  for (const migration of readdirSync(join(root, 'prisma/migrations')).filter((name) => name.endsWith('_sample_domain'))) {
    remove(`prisma/migrations/${migration}`);
  }

  const templateRoot = join(root, 'templates/blank-domain');
  for (const file of listFiles(templateRoot)) {
    const target = relative(templateRoot, file).replace(/\\/g, '/');
    changes.push(`install ${target}`);
    if (!dryRun) cpSync(file, join(root, target));
  }

  // Domain back-relations on User live between two marker lines in core.prisma.
  const corePath = 'prisma/schema/core.prisma';
  const core = readFileSync(join(root, corePath), 'utf8');
  const start = core.indexOf('  // ── Domain back-relations (edit per project)');
  const end = core.indexOf('  // ─────', start + 10);
  if (start < 0 || end < 0) fail(`Could not find the domain back-relations markers in ${corePath}.`);
  const header = core.slice(start, core.indexOf('\n', core.indexOf('to User. Keep them', start)) + 1);
  write(corePath, core.slice(0, start) + header + core.slice(end));
}

function renameInfrastructure(slug: string, port: string) {
  const prefix = slug.replace(/-/g, '_');
  const files = [
    'docker-compose.yml',
    'scripts/sql/init-local-databases.sql',
    '.env.example',
    '.env',
    'tests/support/test-database.ts',
    'playwright.config.ts',
    'e2e/global-setup.ts',
    '.github/workflows/ci.yml',
    'README.md',
  ];
  for (const path of files) {
    if (!existsSync(join(root, path))) continue;
    const before = readFileSync(join(root, path), 'utf8');
    const after = before
      .replace(/\bbpf_(dev|test|e2e)\b/g, `${prefix}_$1`)
      .replace(/bpf-local-only/g, `${prefix}-local-only`)
      .replace(/\/\/bpf:/g, `//${prefix}:`)
      .replace(/bpf-postgres/g, `${slug}-postgres`)
      .replace(/bpf-pgdata/g, `${slug}-pgdata`)
      .replace(/POSTGRES_USER: bpf\b/g, `POSTGRES_USER: ${prefix}`)
      .replace(/-U bpf\b/g, `-U ${prefix}`)
      .replace(/OWNER bpf\b/g, `OWNER ${prefix}`)
      .replace(/\b5434\b/g, port);
    if (after !== before) write(path, after);
  }
}

function main() {
  const name = option('name');
  const slug = option('slug');
  const port = option('db-port') ?? '5434';
  const skipRename = flag('skip-rename');

  if (!skipRename) {
    if (!name || !slug) fail('Usage: npm run foundation:new-business -- --name "<business name>" --slug <latin-slug> [--db-port 5435] [--keep-sample] [--dry-run]');
    if (!/^[a-z][a-z0-9-]{2,30}$/.test(slug)) fail('--slug must be lowercase latin letters, digits and hyphens (3-31 chars), starting with a letter.');
    if (!/^\d{4,5}$/.test(port)) fail('--db-port must be a port number.');
  }
  if (existsSync(join(root, 'BUSINESS_BRIEF.md')) && !flag('force')) {
    fail('BUSINESS_BRIEF.md already exists: this checkout looks already converted. Use --force to run anyway.');
  }
  if (!flag('force') && !dryRun) {
    const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
    if (status) fail('The git working tree has uncommitted changes. Commit or stash them first (or pass --force).');
  }

  if (!skipRename) {
    renameInfrastructure(slug!, port);

    const pkgPath = 'package.json';
    const pkg = JSON.parse(readFileSync(join(root, pkgPath), 'utf8'));
    pkg.name = slug;
    pkg.version = '0.1.0';
    pkg.description = `${name} — built on business-platform-foundation.`;
    write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

    const brandPath = 'src/brand/brand.ts';
    const brand = readFileSync(join(root, brandPath), 'utf8');
    const quoted = `'${name!.replace(/'/g, "\\'")}'`;
    // Placeholder identity must never reach a printed document: the legal name starts as the
    // business name; contact details start empty (left out of print until filled in).
    write(
      brandPath,
      brand
        .replace(/appName: '[^']*'/, `appName: ${quoted}`)
        .replace(/legalName: '[^']*'/, `legalName: ${quoted}`)
        // The template tagline is generic ("a management system for a business"); a business writes its own or none.
        .replace(/tagline: '[^']*'/, "tagline: ''")
        .replace(/businessId: '[^']*'/, "businessId: ''")
        .replace(/address: '[^']*'/, "address: ''")
        .replace(/phone: '[^']*'/, "phone: ''")
        .replace(/email: '[^']*'/, "email: ''"),
    );
  }

  if (!flag('keep-sample')) removeSample();

  for (const [target, template] of [
    ['BUSINESS_BRIEF.md', 'BUSINESS_BRIEF_TEMPLATE.md'],
    ['BUSINESS_RULES.md', 'BUSINESS_RULES_TEMPLATE.md'],
  ] as const) {
    if (!existsSync(join(root, target))) write(target, readFileSync(join(root, template), 'utf8'));
  }

  console.log(`\n${dryRun ? 'Would change' : 'Changed'}:\n  ${changes.join('\n  ')}\n`);
  if (dryRun) return;
  console.log(`Next steps:
  1. git diff                       review what changed
  2. docker compose up -d --wait    (a NEW container/volume for this project)
  3. cp .env.example .env           if you have no .env yet
  4. npm run db:reset:local         migrate the core schema + create role users
  5. npm run check                  typecheck, lint, unit, integration — must be green
  6. Fill BUSINESS_BRIEF.md, then tell Claude Code:
     "Read NEW_BUSINESS_PROJECT_PROMPT.md and follow it for BUSINESS_BRIEF.md."
`);
}

main();
