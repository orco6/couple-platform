/**
 * Declaring a setting. Kept free of imports from the domain contract so domain
 * files can call it without creating a module cycle.
 */

import type { z } from 'zod';

export interface SettingDefinition<T> {
  label: string;
  description: string;
  schema: z.ZodType<T>;
  defaultValue: T;
  /** How the admin form renders it. */
  input:
    | { kind: 'integer'; min: number; max: number; unit?: string }
    | { kind: 'rate_bps' }
    | { kind: 'text'; maxLength: number }
    | { kind: 'boolean' };
}

export function defineSetting<T>(definition: SettingDefinition<T>): SettingDefinition<T> {
  const parsed = definition.schema.safeParse(definition.defaultValue);
  if (!parsed.success) throw new Error(`Default value for setting "${definition.label}" fails its own schema`);
  return definition;
}
