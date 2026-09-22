/**
 * Field schemas for server-side validation, with messages written for people.
 *
 * Domain request schemas are built from these plus `z.object({...}).strict()`.
 * `.strict()` is not optional: an unknown key (e.g. "ownerId" or "role" sent
 * to an endpoint that does not accept it) is REJECTED, which is what closes
 * mass assignment. Services then write only the fields they name explicitly.
 *
 * OPTIONAL FIELDS distinguish three inputs, which PATCH semantics depend on:
 *   key absent        → undefined → the service leaves the column unchanged
 *   null or ""         → null      → the column is cleared
 *   a value           → the value
 *
 * Text is normalized on the way in: Unicode NFC, bidi/zero-width marks removed,
 * whitespace collapsed (for single-line fields) and trimmed. The database never
 * stores "\u200fדנה " and "דנה" as two different names.
 */

import { z } from 'zod';
import { copy } from '@/core/copy';
import { isCalendarDate, parseIsoDate, type CalendarDate } from '@/core/dates/calendar-date';
import { parseLocalTime, type LocalTime } from '@/core/dates/local-time';
import { MAX_ROW_AMOUNT, type Minor } from '@/core/money/money';

const INVISIBLE = /[\u200b\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/g;

export function cleanSingleLine(value: string): string {
  return value.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

export function cleanMultiLine(value: string): string {
  return value
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface TextOptions {
  label: string;
  min?: number;
  max: number;
  multiline?: boolean;
}

function textSchema({ label, min = 1, max, multiline }: TextOptions) {
  return z
    .string({ error: copy.validation.required(label) })
    .transform((value) => (multiline ? cleanMultiLine(value) : cleanSingleLine(value)))
    .pipe(
      z
        .string()
        .min(1, copy.validation.required(label))
        .min(min, copy.validation.tooShort(label, min))
        .max(max, copy.validation.tooLong(label, max)),
    );
}

export const fields = {
  /** Required text. */
  text: (options: TextOptions) => textSchema(options),

  /** Optional text: "", whitespace-only and null all become null. */
  optionalText: ({ label, max, multiline }: Omit<TextOptions, 'min'>) =>
    z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        const cleaned = multiline ? cleanMultiLine(value) : cleanSingleLine(value);
        return cleaned === '' ? null : cleaned;
      })
      .pipe(z.string().max(max, copy.validation.tooLong(label, max)).nullable().optional())
      .optional(),

  optionalEmail: () =>
    z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const cleaned = value === null ? '' : cleanSingleLine(value).toLowerCase();
        return cleaned === '' ? null : cleaned;
      })
      .pipe(z.email({ error: copy.validation.invalidEmail }).max(254).nullable().optional())
      .optional(),

  /** Israeli-friendly phone: digits with optional +, spaces, hyphens, parentheses. */
  optionalPhone: () =>
    z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const cleaned = value === null ? '' : cleanSingleLine(value);
        return cleaned === '' ? null : cleaned;
      })
      .pipe(
        z
          .string()
          .regex(/^\+?[\d\s\-()]{7,20}$/, copy.validation.invalidPhone)
          .refine((value) => value.replace(/\D/g, '').length >= 7, copy.validation.invalidPhone)
          .nullable()
          .optional(),
      )
      .optional(),

  /** ISO "YYYY-MM-DD" business date, strictly validated (31.04 is rejected). */
  calendarDate: () =>
    z
      .string({ error: copy.validation.invalidDate })
      .refine((value) => parseIsoDate(value) !== null, copy.validation.invalidDate)
      .transform((value) => value as CalendarDate),

  optionalCalendarDate: () =>
    z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === null || value.trim() === '' ? null : value.trim()))
      .refine((value) => value == null || isCalendarDate(value), copy.validation.invalidDate)
      .transform((value) => value as CalendarDate | null | undefined)
      .optional(),

  /**
   * "HH:MM" wall-clock time in the business timezone, exactly two-digit hours
   * (like calendarDate, the API is strict; TimeInput normalises what people type).
   * Combine with a CalendarDate via localToInstant.
   */
  localTime: () =>
    z
      .string({ error: copy.validation.invalidTime })
      .refine((value) => /^\d{2}:\d{2}$/.test(value) && parseLocalTime(value) !== null, copy.validation.invalidTime)
      .transform((value) => value as LocalTime),

  /** Integer minor units (agorot), non-negative, within a column's range. */
  money: (options: { allowNegative?: boolean } = {}) =>
    z
      .number({ error: copy.validation.invalidMoney })
      .int(copy.validation.invalidMoney)
      .min(options.allowNegative ? -MAX_ROW_AMOUNT : 0, options.allowNegative ? copy.validation.moneyTooLarge : copy.validation.negativeMoney)
      .max(MAX_ROW_AMOUNT, copy.validation.moneyTooLarge)
      .transform((value) => value as Minor),

  optionalMoney: () =>
    z
      .union([
        z
          .number({ error: copy.validation.invalidMoney })
          .int(copy.validation.invalidMoney)
          .min(0, copy.validation.negativeMoney)
          .max(MAX_ROW_AMOUNT, copy.validation.moneyTooLarge),
        z.null(),
      ])
      .optional()
      .transform((value) => value as Minor | null | undefined)
      .optional(),

  /** A record id from the client. Shape-checked only; existence and scope are checked by the service. */
  id: () => z.string().regex(/^[a-z0-9]{20,40}$/i, copy.errors.notFound),

  optionalId: () =>
    z
      .union([z.string().regex(/^[a-z0-9]{20,40}$/i, copy.errors.notFound), z.null(), z.literal('')])
      .optional()
      .transform((value) => (value === undefined ? undefined : value ? value : null))
      .optional(),

  /** Optimistic-concurrency version the client read. */
  version: () => z.number().int().min(1),

  reason: (label = 'סיבה') => textSchema({ label, min: 3, max: 500, multiline: true }),

  oneOf: <const T extends readonly [string, ...string[]]>(values: T) =>
    z.enum(values, { error: copy.validation.invalidChoice }),
};

/** Zod issues → { field: firstMessage } for forms. Unknown keys get a message too. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) result[[...issue.path, key].join('.')] ??= copy.validation.unknownField;
      continue;
    }
    const key = issue.path.join('.') || '_';
    result[key] ??= issue.message;
  }
  return result;
}
