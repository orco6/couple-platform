/**
 * Money.
 *
 * STRATEGY (docs/adr/0003-money.md)
 *   • Every amount is an integer count of minor units — agorot for ILS.
 *     118000 === ₪1,180.00. Stored as Postgres INTEGER, carried as a JS number.
 *   • Floats never hold money. 0.1 + 0.2 !== 0.3, and a ledger that disagrees
 *     with itself by one agora is a ledger nobody trusts.
 *   • Rates are integer basis points: 1800 bps === 18%.
 *   • Multiplication by a rate goes through BigInt and rounds ONCE, explicitly,
 *     half away from zero (the convention Israeli tax invoices use).
 *   • Calculations happen on the server, in plain tested functions. Components
 *     only format results; there is no arithmetic in JSX.
 *
 * Limits: INTEGER columns hold ±21,474,836.47 ₪ per row. A domain with larger
 * single amounts uses BigInt columns — change the column, not this strategy.
 */

/** An integer number of minor units (agorot). */
export type Minor = number;
/** An integer rate in basis points (1 bps = 0.01%). */
export type BasisPoints = number;

export const MINOR_PER_MAJOR = 100;
export const BPS_PER_WHOLE = 10_000;
/** Largest per-row amount an INTEGER column can hold. */
export const MAX_ROW_AMOUNT: Minor = 2_147_483_647;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertMinor(value: number, label = 'amount'): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer number of minor units, got ${value}`);
  }
}

export function assertBasisPoints(value: number, label = 'rate'): asserts value is BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > BPS_PER_WHOLE) {
    throw new MoneyError(`${label} must be an integer between 0 and ${BPS_PER_WHOLE} bps, got ${value}`);
  }
}

/**
 * Integer division rounded half away from zero, exact for any safe integers.
 * divideRounded(5n, 2n) === 3n; divideRounded(-5n, 2n) === -3n.
 */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (d * 2n);
  return negative ? -quotient : quotient;
}

function toSafeNumber(value: bigint): Minor {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError('Amount exceeds the safe integer range');
  }
  return Number(value);
}

/** amount × rate, rounded once. applyRate(10_000, 1800) === 1_800. */
export function applyRate(amount: Minor, rate: BasisPoints): Minor {
  assertMinor(amount);
  assertBasisPoints(rate);
  return toSafeNumber(divideRounded(BigInt(amount) * BigInt(rate), BigInt(BPS_PER_WHOLE)));
}

export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0n;
  for (const value of values) {
    assertMinor(value);
    total += BigInt(value);
  }
  return toSafeNumber(total);
}

/**
 * Split `total` across `weights` so the parts always add back up to `total`
 * exactly (largest-remainder method). Use for splitting a fee between people:
 * naive per-part rounding loses or invents agorot.
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  assertMinor(total);
  if (weights.length === 0) throw new MoneyError('allocate needs at least one weight');
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new MoneyError('weights must be non-negative integers');
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) throw new MoneyError('weights must not all be zero');

  const sign = total < 0 ? -1n : 1n;
  const absolute = BigInt(Math.abs(total));
  const sum = BigInt(weightSum);

  const floors = weights.map((w) => (absolute * BigInt(w)) / sum);
  const remainders = weights.map((w, index) => ({
    index,
    remainder: (absolute * BigInt(w)) % sum,
  }));
  let leftover = absolute - floors.reduce((a, b) => a + b, 0n);

  remainders.sort((a, b) => (b.remainder === a.remainder ? a.index - b.index : b.remainder > a.remainder ? 1 : -1));
  for (const { index } of remainders) {
    if (leftover === 0n) break;
    floors[index] = (floors[index] ?? 0n) + 1n;
    leftover -= 1n;
  }

  return floors.map((part) => toSafeNumber(part * sign));
}

/**
 * Parse what a person typed into minor units, or null if it is not a plain
 * non-negative amount.
 *
 * Accepts "1180", "1,180", "1180.5", "1180.50", "₪1,180" (with surrounding
 * whitespace and invisible bidi marks from pasting). Rejects internal spaces,
 * more than two decimals, multiple dots, signs, exponents and misplaced
 * thousands separators — a typo must not silently become a different amount.
 */
export function parseMajorInput(input: string, options: { allowNegative?: boolean } = {}): Minor | null {
  let cleaned = input
    .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();

  // A sign may come before or after the currency symbol: "-₪50", "₪-50", or a true minus sign.
  const isSign = (value: string) => value.startsWith('-') || value.startsWith(String.fromCharCode(0x2212));
  let negative = false;
  if (isSign(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1).trim();
  }
  cleaned = cleaned.replace(/^₪\s?/, '').replace(/\s?₪$/, '');
  if (!negative && isSign(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1);
  }
  if (negative && !options.allowNegative) return null;

  if (cleaned === '') return null;
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole = '0', fraction = ''] = cleaned.replace(/,/g, '').split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return negative ? -Number(minor) : Number(minor);
}

/**
 * amount × numerator ÷ denominator, rounded once (half away from zero), exact
 * for any safe integers. For proration and time-based billing:
 *   prorate(monthlyFee, daysUsed, daysInMonth)
 *   prorate(hourlyRate, minutesWorked, 60)
 */
export function prorate(amount: Minor, numerator: number, denominator: number): Minor {
  assertMinor(amount);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new MoneyError('prorate needs integer numerator and denominator');
  }
  if (denominator === 0) throw new MoneyError('Division by zero');
  return toSafeNumber(divideRounded(BigInt(amount) * BigInt(numerator), BigInt(denominator)));
}

/** Minor units → the string an input field shows for editing: 118050 → "1180.50". */
export function toMajorInputString(amount: Minor): string {
  assertMinor(amount);
  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const whole = Math.trunc(absolute / MINOR_PER_MAJOR);
  const fraction = absolute % MINOR_PER_MAJOR;
  return fraction === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}
