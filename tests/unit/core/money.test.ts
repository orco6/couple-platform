import { describe, expect, it } from 'vitest';
import { formatMoney, formatRate } from '@/core/money/format';
import { allocate, applyRate, divideRounded, parseMajorInput, prorate, sumMinor, toMajorInputString } from '@/core/money/money';
import { sumBreakdowns, vatFromGross, vatFromNet } from '@/core/money/vat';

const RLM = String.fromCharCode(0x200f);

describe('rounding', () => {
  it('rounds half away from zero, symmetrically', () => {
    expect(divideRounded(5n, 2n)).toBe(3n);
    expect(divideRounded(-5n, 2n)).toBe(-3n);
    expect(divideRounded(4n, 3n)).toBe(1n);
    expect(divideRounded(-4n, 3n)).toBe(-1n);
  });

  it('applies basis-point rates with one explicit rounding', () => {
    expect(applyRate(10_000, 1800)).toBe(1800);
    expect(applyRate(1, 1800)).toBe(0); // 0.18 agora
    expect(applyRate(3, 1800)).toBe(1); // 0.54 → 1
    expect(applyRate(25, 1800)).toBe(5); // 4.5 → 5 (half away from zero)
  });

  it('refuses non-integer money', () => {
    expect(() => applyRate(10.5, 1800)).toThrow();
    expect(() => sumMinor([1, 0.1])).toThrow();
  });
});

describe('allocate', () => {
  it('always adds back up to the total', () => {
    for (const total of [100, 101, 99_999, -1001]) {
      const parts = allocate(total, [1, 1, 1]);
      expect(sumMinor(parts)).toBe(total);
    }
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [70, 30])).toEqual([700, 300]);
  });
});

describe('parseMajorInput', () => {
  it.each([
    ['1180', 118000],
    ['1,180', 118000],
    ['1180.5', 118050],
    ['1180.50', 118050],
    ['₪1,180', 118000],
    [`  ${RLM}1,180.05 `, 118005],
    ['0', 0],
  ])('accepts %j', (input, expected) => {
    expect(parseMajorInput(input)).toBe(expected);
  });

  it.each(['', '1 180', '1.234', '1,18', '-5', '1e3', '12a', '1..2', ',100', '0x10'])('rejects %j', (input) => {
    expect(parseMajorInput(input)).toBeNull();
  });

  it('round-trips to the edit string without float drift', () => {
    expect(toMajorInputString(118050)).toBe('1180.50');
    expect(parseMajorInput(toMajorInputString(1)) ).toBe(1);
    expect(parseMajorInput('0.29')).toBe(29); // 0.29 * 100 in floats is 28.999…
  });
});

describe('formatting', () => {
  it('writes ₪ before the number with no invisible characters', () => {
    const text = formatMoney(118000);
    expect(text).toBe('₪1,180');
    expect(text).not.toContain(RLM);
  });

  it('shows agorot only when present, or always on request', () => {
    expect(formatMoney(118050)).toBe('₪1,180.50');
    expect(formatMoney(118000, { decimals: 'always' })).toBe('₪1,180.00');
  });

  it('uses a true minus sign and an optional plus', () => {
    expect(formatMoney(-40000)).toBe('−₪400');
    expect(formatMoney(40000, { signed: true })).toBe('+₪400');
  });

  it('formats rates', () => {
    expect(formatRate(1800)).toBe('18%');
    expect(formatRate(1750)).toBe('17.5%');
  });
});

describe('VAT', () => {
  it('from net: gross is exactly net + VAT', () => {
    expect(vatFromNet(100_000, 1800)).toEqual({ net: 100_000, vat: 18_000, gross: 118_000, rateBps: 1800 });
    const odd = vatFromNet(333, 1800);
    expect(odd.net + odd.vat).toBe(odd.gross);
  });

  it('from gross: parts always reconcile to the amount collected', () => {
    for (const gross of [118_000, 100, 1, 99_999, 117_999]) {
      const breakdown = vatFromGross(gross, 1800);
      expect(breakdown.net + breakdown.vat).toBe(gross);
    }
    expect(vatFromGross(118_000, 1800).net).toBe(100_000);
  });

  it('sums breakdowns across different rates', () => {
    const total = sumBreakdowns([vatFromNet(10_000, 1700), vatFromNet(10_000, 1800)]);
    expect(total).toEqual({ net: 20_000, vat: 3_500, gross: 23_500 });
  });

  it('rejects impossible rates', () => {
    expect(() => vatFromNet(100, -1)).toThrow();
    expect(() => vatFromNet(100, 10_001)).toThrow();
  });
});

describe('signed amounts and proration', () => {
  it('parses negative amounts only when allowed', () => {
    expect(parseMajorInput('-50')).toBeNull();
    expect(parseMajorInput('-50', { allowNegative: true })).toBe(-5000);
    expect(parseMajorInput('-₪1,180.5', { allowNegative: true })).toBe(-118050);
    expect(parseMajorInput('₪-12.30', { allowNegative: true })).toBe(-1230);
    expect(parseMajorInput(`${String.fromCharCode(0x2212)}40`, { allowNegative: true })).toBe(-4000);
    expect(parseMajorInput('--5', { allowNegative: true })).toBeNull();
    expect(parseMajorInput('5-', { allowNegative: true })).toBeNull();
    expect(toMajorInputString(-118050)).toBe('-1180.50');
  });

  it('prorates exactly with one rounding', () => {
    expect(prorate(300_000, 10, 30)).toBe(100_000); // ₪3,000/month × 10 of 30 days
    expect(prorate(100, 1, 3)).toBe(33);
    expect(prorate(200, 1, 3)).toBe(67);
    expect(prorate(45_000, 90, 60)).toBe(67_500); // ₪450/hour × 90 minutes
    expect(prorate(-100, 1, 2)).toBe(-50);
    expect(() => prorate(100, 1, 0)).toThrow();
    expect(() => prorate(100, 1.5, 2)).toThrow();
  });

  it('handles the boundaries: 0, 1 agora, and the largest safe amounts', () => {
    expect(applyRate(0, 1800)).toBe(0);
    expect(vatFromNet(1, 1800)).toEqual({ net: 1, vat: 0, gross: 1, rateBps: 1800 });
    expect(vatFromGross(1, 1800)).toEqual({ net: 1, vat: 0, gross: 1, rateBps: 1800 });
    expect(applyRate(Number.MAX_SAFE_INTEGER, 10_000)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(formatMoney(0)).toBe('₪0');
    expect(formatMoney(1)).toBe('₪0.01');
    expect(formatMoney(-1)).toBe('−₪0.01');
  });
});
