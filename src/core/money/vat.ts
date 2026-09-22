/**
 * VAT (מע״מ).
 *
 * Explicit, not implied. Every figure that involves VAT says whether it is net
 * (before VAT) or gross (including VAT), and the rate travels with it. The rate
 * applied to a record is stored on that record when it is priced, so a change
 * to the national rate (17% → 18% in January 2025) never rewrites past work.
 *
 * The current default rate is business configuration (a setting), not a
 * constant in code.
 */

import { applyRate, assertBasisPoints, assertMinor, BPS_PER_WHOLE, divideRounded, type BasisPoints, type Minor } from './money';

export interface VatBreakdown {
  net: Minor;
  vat: Minor;
  gross: Minor;
  rateBps: BasisPoints;
}

/** From a net price: VAT rounded once, gross = net + VAT exactly. */
export function vatFromNet(net: Minor, rateBps: BasisPoints): VatBreakdown {
  assertMinor(net, 'net');
  assertBasisPoints(rateBps, 'VAT rate');
  const vat = applyRate(net, rateBps);
  return { net, vat, gross: net + vat, rateBps };
}

/**
 * From a VAT-inclusive amount: net rounded once, VAT = gross − net exactly, so
 * the parts always reconcile to the amount actually collected.
 */
export function vatFromGross(gross: Minor, rateBps: BasisPoints): VatBreakdown {
  assertMinor(gross, 'gross');
  assertBasisPoints(rateBps, 'VAT rate');
  const net = Number(divideRounded(BigInt(gross) * BigInt(BPS_PER_WHOLE), BigInt(BPS_PER_WHOLE + rateBps)));
  return { net, vat: gross - net, gross, rateBps };
}

/** Sum breakdowns that may carry different rates (e.g. across a rate change). */
export function sumBreakdowns(items: readonly VatBreakdown[]): Omit<VatBreakdown, 'rateBps'> {
  return items.reduce(
    (total, item) => ({ net: total.net + item.net, vat: total.vat + item.vat, gross: total.gross + item.gross }),
    { net: 0, vat: 0, gross: 0 },
  );
}
