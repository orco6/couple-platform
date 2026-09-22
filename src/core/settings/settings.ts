/**
 * Business settings — typed, defaulted, audited.
 *
 * Each setting is declared in code with a schema and a default
 * (src/domain/settings.ts). The database only holds overrides; a fresh database
 * behaves correctly before anyone opens the settings screen.
 *
 * TEST ISOLATION: there is no in-memory cache. Every read goes to the database,
 * which the test suites reset between tests — so a test that changes a setting
 * cannot leak it into the next one (a real Koma failure mode).
 *
 * The registry defaults to the domain's definitions and can be passed
 * explicitly, which is how core tests exercise this module without depending
 * on any particular business's settings.
 */

import type { Prisma } from '@/generated/prisma/client';
import { settingDefinitions } from '@/domain/contract';
import { assertCan } from '@/core/access/can';
import type { Actor } from '@/core/auth/actor';
import { recordAudit } from '@/core/audit/record';
import type { DbClient } from '@/core/db/types';
import { errors } from '@/core/errors/errors';
import type { SettingDefinition } from './define-setting';

export type SettingRegistry = Readonly<Record<string, SettingDefinition<unknown>>>;

type Definitions = typeof settingDefinitions;
export type SettingKey = keyof Definitions & string;
export type SettingValue<K extends SettingKey> = Definitions[K] extends SettingDefinition<infer T> ? T : never;

const domainRegistry = settingDefinitions as unknown as SettingRegistry;

function definitionIn(registry: SettingRegistry, key: string): SettingDefinition<unknown> | undefined {
  return Object.hasOwn(registry, key) ? registry[key] : undefined;
}

async function readValue(client: DbClient, definition: SettingDefinition<unknown>, key: string): Promise<unknown> {
  const row = await client.setting.findUnique({ where: { key } });
  if (!row) return definition.defaultValue;
  const parsed = definition.schema.safeParse(row.value);
  // A stored value that no longer satisfies the schema (the schema tightened)
  // falls back to the default rather than propagating garbage into a calculation.
  return parsed.success ? parsed.data : definition.defaultValue;
}

/** Typed read of a domain setting. */
export async function getSetting<K extends SettingKey>(client: DbClient, key: K): Promise<SettingValue<K>> {
  return (await readSettingFrom(domainRegistry, client, key)) as SettingValue<K>;
}

export async function readSettingFrom(registry: SettingRegistry, client: DbClient, key: string): Promise<unknown> {
  const definition = definitionIn(registry, key);
  if (!definition) throw new Error(`Unknown setting "${key}"`);
  return readValue(client, definition, key);
}

export interface SettingView {
  key: string;
  label: string;
  description: string;
  input: SettingDefinition<unknown>['input'];
  value: unknown;
  isDefault: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

export async function listSettings(client: DbClient, actor: Actor, registry: SettingRegistry = domainRegistry): Promise<SettingView[]> {
  assertCan(actor, 'settings.manage');
  const rows = await client.setting.findMany({ include: { updatedBy: { select: { name: true } } } });
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return Object.entries(registry).map(([key, definition]) => {
    const row = byKey.get(key);
    const parsed = row ? definition.schema.safeParse(row.value) : null;
    return {
      key,
      label: definition.label,
      description: definition.description,
      input: definition.input,
      value: parsed?.success ? parsed.data : definition.defaultValue,
      isDefault: !parsed?.success,
      updatedByName: row?.updatedBy?.name ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function updateSetting(
  client: DbClient,
  actor: Actor,
  key: string,
  rawValue: unknown,
  registry: SettingRegistry = domainRegistry,
): Promise<void> {
  assertCan(actor, 'settings.manage');
  const definition = definitionIn(registry, key);
  if (!definition) throw errors.notFound();

  const parsed = definition.schema.safeParse(rawValue);
  if (!parsed.success) {
    throw errors.validation(undefined, { value: parsed.error.issues[0]?.message ?? 'ערך לא תקין' });
  }

  const before = await readValue(client, definition, key);
  await client.setting.upsert({
    where: { key },
    update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actor.id },
    create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actor.id },
  });
  await recordAudit(client, {
    actor,
    action: 'setting.changed',
    entityType: 'setting',
    entityId: key,
    before: { value: before },
    after: { value: parsed.data },
    metadata: { label: definition.label },
  });
}
