import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fields, toFieldErrors } from '@/core/validation/fields';

const patchSchema = z
  .object({
    name: fields.text({ label: 'שם', min: 2, max: 50 }).optional(),
    phone: fields.optionalPhone(),
    email: fields.optionalEmail(),
    note: fields.optionalText({ label: 'הערה', max: 200, multiline: true }),
    due: fields.optionalCalendarDate(),
    amount: fields.optionalMoney(),
    ownerId: fields.optionalId(),
  })
  .strict();

describe('request field schemas', () => {
  it('absent keys stay undefined (leave unchanged); null or "" clears', () => {
    const absent = patchSchema.parse({ name: 'דנה' });
    for (const key of ['phone', 'email', 'note', 'due', 'amount', 'ownerId'] as const) {
      expect(absent[key], key).toBeUndefined();
    }
    const cleared = patchSchema.parse({ phone: '', email: null, note: '   ', due: '', amount: null, ownerId: '' });
    for (const key of ['phone', 'email', 'note', 'due', 'amount', 'ownerId'] as const) {
      expect(cleared[key], key).toBeNull();
    }
  });

  it('rejects unknown keys (mass assignment) and names them', () => {
    const result = patchSchema.safeParse({ name: 'דנה', role: 'OWNER', createdById: 'x', status: 'DONE' });
    expect(result.success).toBe(false);
    expect(Object.keys(toFieldErrors(result.error!))).toEqual(expect.arrayContaining(['role', 'createdById', 'status']));
  });

  it('rejects impossible dates, fractional and negative money, malformed ids', () => {
    expect(patchSchema.safeParse({ due: '2026-04-31' }).success).toBe(false);
    expect(patchSchema.safeParse({ due: '31.04.2026' }).success).toBe(false);
    expect(patchSchema.safeParse({ amount: 10.5 }).success).toBe(false);
    expect(patchSchema.safeParse({ amount: -1 }).success).toBe(false);
    expect(patchSchema.safeParse({ amount: 2 ** 31 }).success).toBe(false);
    expect(patchSchema.safeParse({ ownerId: "x' OR 1=1" }).success).toBe(false);
  });

  it('allows negative amounts only where explicitly requested', () => {
    expect(fields.money({ allowNegative: true }).safeParse(-500).success).toBe(true);
    expect(fields.money().safeParse(-500).success).toBe(false);
  });

  it('normalizes text: NFC, invisible marks, collapsed whitespace', () => {
    const schema = z.object({ name: fields.text({ label: 'שם', max: 50 }) });
    expect(schema.parse({ name: `  דנה${String.fromCharCode(0x200f)}   לוי ` }).name).toBe('דנה לוי');
    expect(schema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('writes messages for people, naming the field', () => {
    const result = z.object({ name: fields.text({ label: 'שם הלקוח', min: 2, max: 5 }) }).safeParse({ name: 'ארוך מדי' });
    expect(toFieldErrors(result.error!).name).toContain('שם הלקוח');
  });
});
