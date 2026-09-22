/**
 * Preparing values for the append-only audit log.
 *
 * Secrets never enter: any key that looks like a credential is dropped at every
 * depth, not only at the top level, because a snapshot taken by spreading a row
 * picks up whatever fields are added to that model later — and nothing can be
 * cleaned out of an append-only table afterwards.
 *
 * Dates become ISO strings so stored JSON is stable and comparable.
 */

const SECRET_KEY = /pass(word)?|secret|token|hash|cookie|session|authorization|api[-_]?key|credential|otp/i;

export function redactForAudit(value: unknown, depth = 0): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (depth > 5) return '[truncated]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => redactForAudit(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) continue;
      const cleaned = redactForAudit(inner, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 5000) return `${value.slice(0, 5000)}…`;
  return value;
}

/** Fields that change on every write and carry no intent. */
const NOISE = new Set(['updatedAt', 'version']);

/**
 * Only what actually changed, so a reviewer looking for "who changed the price"
 * does not diff two twenty-field objects by eye. Null when nothing changed.
 */
export function diffForAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const cleanBefore = redactForAudit(before) as Record<string, unknown>;
  const cleanAfter = redactForAudit(after) as Record<string, unknown>;
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(cleanBefore), ...Object.keys(cleanAfter)])) {
    if (NOISE.has(key)) continue;
    if (JSON.stringify(cleanBefore[key] ?? null) !== JSON.stringify(cleanAfter[key] ?? null)) {
      changedBefore[key] = cleanBefore[key] ?? null;
      changedAfter[key] = cleanAfter[key] ?? null;
    }
  }
  return Object.keys(changedAfter).length === 0 ? null : { before: changedBefore, after: changedAfter };
}
