/**
 * STRUCTURAL: every request schema a domain exports rejects unknown fields.
 *
 * Mass assignment starts with a schema that quietly accepts `ownerId`,
 * `createdById` or `archivedAt` next to the real fields. Domain-agnostic: it
 * scans whatever src/domain exports as `*Schema`, so it keeps guarding each new
 * business without being edited. (A mutation check removing `.strict()` from a
 * sample schema survived every other unit and integration test.)
 */

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

const modules = import.meta.glob('/src/domain/**/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;

function isZod(value: unknown): value is z.ZodType {
  return typeof value === 'object' && value !== null && '_zod' in value;
}

/** The object schemas a request schema is built from (through pipes/transforms, optional, unions). */
function objectsWithin(schema: z.ZodType): Array<{ path: string; strict: boolean }> {
  const def = (schema as unknown as { _zod: { def: Record<string, unknown> & { type: string } } })._zod.def;
  switch (def.type) {
    case 'object': {
      const catchall = def.catchall as z.ZodType | undefined;
      const strict = catchall !== undefined && (catchall as unknown as { _zod: { def: { type: string } } })._zod.def.type === 'never';
      const shape = def.shape as Record<string, z.ZodType>;
      return [{ path: '', strict }, ...Object.entries(shape).flatMap(([key, child]) => objectsWithin(child).map((o) => ({ ...o, path: `.${key}${o.path}` })))];
    }
    case 'pipe':
      return objectsWithin(def.in as z.ZodType);
    case 'optional':
    case 'nullable':
    case 'default':
    case 'readonly':
    case 'array':
      return objectsWithin((def.innerType ?? def.element) as z.ZodType);
    case 'union':
      return (def.options as z.ZodType[]).flatMap((option) => objectsWithin(option));
    default:
      return [];
  }
}

const schemas = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([name, value]) => name.endsWith('Schema') && isZod(value))
    .map(([name, value]) => ({ name: `${file.replace('/src/domain/', '')} → ${name}`, schema: value as z.ZodType })),
);

describe('domain request schemas', () => {
  it('reject unknown fields at every object level (.strict())', () => {
    const loose = schemas.flatMap(({ name, schema }) => objectsWithin(schema).filter((o) => !o.strict).map((o) => `${name}${o.path || ' (root)'}`));
    expect(loose, `Add .strict() to:\n  ${loose.join('\n  ')}`).toEqual([]);
  });

  it('the scan finds the schemas it is meant to guard', () => {
    // A blank domain may export none; when the sample domain is present the scan must see it.
    if (Object.keys(modules).some((file) => file.includes('/sample/'))) {
      expect(schemas.map((s) => s.name)).toEqual(expect.arrayContaining([expect.stringContaining('createCustomerSchema')]));
    }
  });
});
