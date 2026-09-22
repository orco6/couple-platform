/**
 * Money formatting. The only place minor units become "₪1,180".
 *
 * Composed by hand rather than with Intl's currency style: he-IL currency
 * formatting yields "\u200f1,180 \u200f₪" — symbol after the number, wrapped in invisible
 * RLM characters that ride along into copy-paste and string comparisons. The
 * business writes ₪ before the number, so that is what this produces: plain,
 * copyable text with nothing invisible in it.
 */

import { businessLocale } from '@/brand/brand';
import { assertMinor, MINOR_PER_MAJOR, type BasisPoints, type Minor } from './money';

const grouping = new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 0 });

export interface FormatMoneyOptions {
  /** 'auto' shows agorot only when present; 'always' prints two decimals. */
  decimals?: 'auto' | 'always';
  /** Render a leading + for positive values (adjustments, deltas). */
  signed?: boolean;
}

export function formatMoney(amount: Minor, options: FormatMoneyOptions = {}): string {
  assertMinor(amount);
  const { decimals = 'auto', signed = false } = options;
  const absolute = Math.abs(amount);
  const whole = Math.trunc(absolute / MINOR_PER_MAJOR);
  const fraction = absolute % MINOR_PER_MAJOR;

  const showFraction = decimals === 'always' || fraction !== 0;
  const number = `${grouping.format(whole)}${showFraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;

  // True minus sign (U+2212), not a hyphen: −₪400 reads as money, -₪400 as a dash.
  const sign = amount < 0 ? '−' : signed && amount > 0 ? '+' : '';
  return `${sign}${businessLocale.currencySymbol}${number}`;
}

/** 1800 → "18%", 1750 → "17.5%". */
export function formatRate(rateBps: BasisPoints): string {
  const whole = Math.trunc(rateBps / 100);
  const fraction = rateBps % 100;
  if (fraction === 0) return `${whole}%`;
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}%`;
}
