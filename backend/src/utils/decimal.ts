import Decimal from 'decimal.js';

// Configure Decimal precision for financial calculations (Sri Lankan Rupee & Gold Milligrams)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Parses and returns a safe Decimal instance.
 */
export function toDecimal(val: number | string | Decimal | null | undefined): Decimal {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Formats a currency value with 2 decimal places.
 */
export function formatLkr(val: number | string | Decimal | null | undefined): string {
  return toDecimal(val).toFixed(2);
}

/**
 * Formats a weight value with 3 decimal places (grams or milligrams).
 */
export function formatWeight(val: number | string | Decimal | null | undefined): string {
  return toDecimal(val).toFixed(3);
}

/**
 * Calculates interest for a pawn loan.
 * Formula: Principal * (Interest Rate % per month) * (Days / 30)
 */
export function calculatePawnInterest(
  principal: number | string | Decimal,
  monthlyRatePercent: number | string | Decimal,
  days: number
): { interest: Decimal; totalSettlement: Decimal } {
  const p = toDecimal(principal);
  const r = toDecimal(monthlyRatePercent).dividedBy(100);
  const periodFactor = new Decimal(days).dividedBy(30);

  const interest = p.times(r).times(periodFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalSettlement = p.plus(interest).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { interest, totalSettlement };
}

/**
 * Calculates Specific Gravity (Archimedes' Hydrostatic Principle)
 * Formula: Air Weight / (Air Weight - Submerged Weight)
 */
export function calculateSpecificGravity(
  airWeight: number | string | Decimal,
  waterWeight: number | string | Decimal
): Decimal {
  const aw = toDecimal(airWeight);
  const ww = toDecimal(waterWeight);

  if (aw.isZero() || ww.isZero() || aw.lessThanOrEqualTo(ww)) {
    return new Decimal(0);
  }

  // If waterWeight is already displaced water weight: aw / ww
  if (ww.lessThan(aw.times(0.45))) {
    return aw.dividedBy(ww).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  }

  // Apparent submerged weight: aw / (aw - ww)
  const displaced = aw.minus(ww);
  if (displaced.isZero()) return new Decimal(0);

  return aw.dividedBy(displaced).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/**
 * Returns estimated Karat purity from Specific Gravity.
 */
export function getEstimatedKarat(sg: Decimal | number): string {
  const num = typeof sg === 'number' ? sg : sg.toNumber();
  if (num >= 19.1) return '24K (Pure Gold)';
  if (num >= 17.2) return '22K (91.6% Sovereign)';
  if (num >= 16.2) return '21K (87.5% Gold)';
  if (num >= 15.4) return '20K (83.3% Gold)';
  if (num >= 14.4) return '18K (75.0% Gold)';
  if (num >= 12.5) return '14K (58.5% Gold)';
  if (num >= 11.2) return '10K (41.7% Gold)';
  if (num >= 10.5) return '9K (37.5% Gold)';
  if (num >= 9.5)  return 'Silver / Low Karat';
  if (num >= 8.0)  return 'Brass / Copper Alloy';
  if (num >= 6.5)  return 'Iron / Steel Alloy';
  if (num > 0)     return 'Base Metal / Non-Gold';
  return 'Unknown';
}

/**
 * Rupasinghe Enterprise Graduated Pawn Interest & Settlement Engine.
 * All math performed in Decimal(20) to prevent fractional cent leakage.
 */
export function calculateRupasingheInterest(
  principalInput: number | string | Decimal,
  days: number,
  insuranceInput: number | string | Decimal = 50
) {
  const principal = toDecimal(principalInput);
  const insurance = toDecimal(insuranceInput);
  const tier = principal.lessThan(50000) ? 'A' : 'B';
  let interestRate = new Decimal(0.0250); // Tier A: 2.50%
  let discountRate = new Decimal(0.0100); // Tier A: 1.00%
  if (tier === 'B') {
    interestRate = new Decimal(0.0275); // Tier B: 2.75%
    discountRate = new Decimal(0.0050); // Tier B: 0.50%
  }

  const interestOne = principal.times(interestRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalAmount = principal.plus(interestOne);
  const finalTotalInterest = interestOne.plus(insurance);

  let settlement = new Decimal(0);
  let accrualExpr = '';
  let accrualDesc = '';
  let activeNodeIndex = 0;

  if (days <= 30) {
    const discount = principal.times(discountRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    settlement = totalAmount.minus(discount).plus(insurance);
    accrualExpr = `(P + I_1) - D_1 + Ins`;
    accrualDesc = `Month 1 Discounted: Full loan settled within 30 days receives a ${discountRate.times(100).toFixed(2)}% discount on principal.`;
    activeNodeIndex = 1;
  } else if (days <= 38) {
    const extraInt = totalAmount.times(interestRate).times(0.25).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    settlement = principal.plus(extraInt).plus(finalTotalInterest);
    accrualExpr = `P + ((T x r_int) x 0.25) + I_final`;
    accrualDesc = `Month 2 (Days 1-8): Principal + 25% extra interest increment + Final Total Interest.`;
    activeNodeIndex = 2;
  } else if (days <= 45) {
    const extraInt = totalAmount.times(interestRate).times(0.50).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    settlement = principal.plus(extraInt).plus(finalTotalInterest);
    accrualExpr = `P + ((T x r_int) x 0.50) + I_final`;
    accrualDesc = `Month 2 (Days 9-15): Principal + 50% extra interest increment + Final Total Interest.`;
    activeNodeIndex = 3;
  } else if (days <= 60) {
    const extraInt = totalAmount.times(interestRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    settlement = principal.plus(extraInt).plus(finalTotalInterest);
    accrualExpr = `P + (T x r_int) + I_final`;
    accrualDesc = `Month 2 (Full): Principal + 100% extra interest increment + Final Total Interest.`;
    activeNodeIndex = 4;
  } else {
    const months = Math.ceil(days / 30);
    const extraInt = totalAmount.times(interestRate).times(months - 1).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    settlement = principal.plus(extraInt).plus(finalTotalInterest);
    accrualExpr = `P + ((T x r_int) x (${months} - 1)) + I_final`;
    accrualDesc = `Month 3+ (Month ${months}): Principal + accrued monthly interest + Final Total Interest.`;
    activeNodeIndex = 5;
  }

  settlement = settlement.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const accruedCharges = Decimal.max(0, settlement.minus(principal));

  return {
    principal: principal.toNumber(),
    insurance: insurance.toNumber(),
    interestRate: interestRate.toNumber(),
    discountRate: discountRate.toNumber(),
    interestOne: interestOne.toNumber(),
    finalTotalInterest: finalTotalInterest.toNumber(),
    settlement: settlement.toNumber(),
    accruedCharges: accruedCharges.toNumber(),
    accrualExpr,
    accrualDesc,
    activeNodeIndex,
  };
}

