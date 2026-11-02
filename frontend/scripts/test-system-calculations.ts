/**
 * MIFOS SYSTEM COMPREHENSIVE CALCULATION & PAYMENT VERIFICATION TEST SUITE
 * Verifies:
 * 1. Gold weight (grams, milligrams, multi-item sums, hydrostatic SG, and Karat classification)
 * 2. Valuation and loan amount appraisal (purity factors, gold rate, LTV)
 * 3. Payment & Settlement interest computation across Tier A & Tier B across all duration slabs
 * 4. Day-End cash reconciliation calculation
 * 5. General Ledger debit/credit balance equality
 */

// -------------------------------------------------------------
// 1. GOLD GRAM & WEIGHT CALCULATION FUNCTIONS
// -------------------------------------------------------------

export function convertMgToGrams(mg: number): number {
  return Number((mg / 1000).toFixed(3));
}

export function convertGramsToMg(grams: number): number {
  return Math.round(grams * 1000);
}

export function computeTotalGoldWeight(items: Array<{ grams?: number; mg?: number }>): number {
  const total = items.reduce((sum, item) => {
    const g = Number(item.grams) || 0;
    const m = Number(item.mg) || 0;
    return sum + g + (m / 1000);
  }, 0);
  return Number(total.toFixed(3));
}

export function calculateSpecificGravity(airWeight: number, waterWeight: number): {
  sg: number;
  karat: string;
} {
  if (airWeight <= 0 || waterWeight <= 0 || airWeight <= waterWeight) {
    return { sg: 0, karat: 'Unknown' };
  }
  const sg = Number((airWeight / (airWeight - waterWeight)).toFixed(2));
  let karat = 'Unknown / Base Metal';

  if (sg >= 19.3) karat = '24K';
  else if (sg >= 17.5) karat = '22K';
  else if (sg >= 16.5) karat = '21K';
  else if (sg >= 14.7) karat = '18K';
  else if (sg >= 12.6) karat = '14K';
  else if (sg >= 11.4) karat = '10K';
  else if (sg >= 11.1) karat = '9K';

  return { sg, karat };
}

export function getGoldFactor(purity: string): number {
  if (purity === '24K') return 1.0;
  if (purity === '22K') return 0.916;
  if (purity === '20K') return 0.833;
  return 0.75; // 18K
}

export function calculateGoldValuation(
  weightGrams: number,
  ratePerGram: number,
  purity: string,
  ltvPercent: number = 80
): { appraisedValue: number; loanAmount: number } {
  const factor = getGoldFactor(purity);
  const appraisedValue = Math.round(weightGrams * ratePerGram * factor);
  const loanAmount = Math.round(appraisedValue * (ltvPercent / 100));
  return { appraisedValue, loanAmount };
}

// -------------------------------------------------------------
// 2. PAYMENT, INTEREST & SETTLEMENT CALCULATION FUNCTIONS
// -------------------------------------------------------------

export function calculateRedemptionSettlement(
  principal: number,
  days: number,
  insurance: number = 50
): {
  tier: 'A' | 'B';
  interestRate: number;
  discountRate: number;
  interestOne: number;
  totalAmount: number;
  settlement: number;
  accruedCharges: number;
  formula: string;
} {
  const tier: 'A' | 'B' = principal < 50000 ? 'A' : 'B';
  let interestRate = 0.0250; // Tier A: 2.50%
  let discountRate = 0.0100; // Tier A: 1.00%
  if (tier === 'B') {
    interestRate = 0.0275; // Tier B: 2.75%
    discountRate = 0.0050; // Tier B: 0.50%
  }

  const interestOne = Number((principal * interestRate).toFixed(2));
  const totalAmount = Number((principal + interestOne).toFixed(2));
  const finalTotalInterest = Number((interestOne + insurance).toFixed(2));

  let settlement = 0;
  let formula = '';

  if (days <= 10) {
    const discount = Number((totalAmount * discountRate).toFixed(2));
    settlement = Number((totalAmount - discount).toFixed(2));
    formula = `TotalAmount (${totalAmount}) - Discount (${discount})`;
  } else if (days <= 30) {
    settlement = totalAmount;
    formula = `Flat TotalAmount (${totalAmount})`;
  } else if (days <= 38) {
    const extraInt = Number(((totalAmount * interestRate) * 0.25).toFixed(2));
    settlement = Number((principal + extraInt + finalTotalInterest).toFixed(2));
    formula = `P + ((T * r) * 0.25) + I_final`;
  } else if (days <= 45) {
    const extraInt = Number(((totalAmount * interestRate) * 0.50).toFixed(2));
    settlement = Number((principal + extraInt + finalTotalInterest).toFixed(2));
    formula = `P + ((T * r) * 0.50) + I_final`;
  } else if (days <= 60) {
    const extraInt = Number((totalAmount * interestRate).toFixed(2));
    settlement = Number((principal + extraInt + finalTotalInterest).toFixed(2));
    formula = `P + (T * r) + I_final`;
  } else {
    const months = Math.ceil(days / 30);
    const extraInt = Number(((totalAmount * interestRate) * (months - 1)).toFixed(2));
    settlement = Number((principal + extraInt + finalTotalInterest).toFixed(2));
    formula = `P + ((T * r) * (${months} - 1)) + I_final`;
  }

  const accruedCharges = Number(Math.max(0, settlement - principal).toFixed(2));

  return {
    tier,
    interestRate,
    discountRate,
    interestOne,
    totalAmount,
    settlement,
    accruedCharges,
    formula
  };
}

// -------------------------------------------------------------
// 3. CASH & GENERAL LEDGER BALANCING FUNCTIONS
// -------------------------------------------------------------

export function calculateDenominationsTotal(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((sum, [denom, count]) => {
    return sum + (parseInt(denom, 10) * (Number(count) || 0));
  }, 0);
}

export function verifyJournalEntryBalanced(lines: Array<{ debit: number; credit: number }>): {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
} {
  const totalDebit = Number(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0).toFixed(2));
  const totalCredit = Number(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0).toFixed(2));
  return {
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit
  };
}

// -------------------------------------------------------------
// 4. TEST RUNNER AND ASSERTIONS
// -------------------------------------------------------------

function pass(name: string, detail: string) {
  console.log(`  ✅ PASS: ${name} [${detail}]`);
}

function fail(name: string, detail: string) {
  console.error(`  ❌ FAIL: ${name} [${detail}]`);
  throw new Error(`Assertion failed: ${name}`);
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  MIFOS SYSTEM INTEGRITY & ACCURACY TEST SUITE');
  console.log('  Verifying Gold Grams, Weight Sums, Appraisals, Payments & Settlement');
  console.log('========================================================================\n');

  // --- SECTION 1: GOLD WEIGHT (GRAMS & MILLIGRAMS) ---
  console.log('--- 1. GOLD GRAM & WEIGHT CONVERSIONS & MULTI-ITEM SUMS ---');

  // 1.1 Conversion test
  const mgInput = 8750;
  const gramsOutput = convertMgToGrams(mgInput);
  if (gramsOutput === 8.75) {
    pass('MG to Grams', `${mgInput} mg = ${gramsOutput} g`);
  } else {
    fail('MG to Grams', `Expected 8.75, got ${gramsOutput}`);
  }

  const gramsInput = 12.345;
  const mgOutput = convertGramsToMg(gramsInput);
  if (mgOutput === 12345) {
    pass('Grams to MG', `${gramsInput} g = ${mgOutput} mg`);
  } else {
    fail('Grams to MG', `Expected 12345, got ${mgOutput}`);
  }

  // 1.2 Multi-item aggregation test
  const multiItems = [
    { grams: 5, mg: 250 },   // 5.250g (e.g. Ring)
    { grams: 14, mg: 500 },  // 14.500g (e.g. Chain)
    { grams: 2, mg: 125 }    // 2.125g (e.g. Earring)
  ];
  const totalWeight = computeTotalGoldWeight(multiItems);
  const expectedTotalWeight = 21.875;
  if (totalWeight === expectedTotalWeight) {
    pass('Multi-item Collateral Aggregation', `Sum of 3 items = ${totalWeight} g`);
  } else {
    fail('Multi-item Collateral Aggregation', `Expected ${expectedTotalWeight}, got ${totalWeight}`);
  }

  // 1.3 Hydrostatic Specific Gravity & Karat Estimation
  const test22kAir = 21.875;
  const test22kWater = 20.635; // loss in water ~1.24g -> SG ~ 17.64
  const eval22k = calculateSpecificGravity(test22kAir, test22kWater);
  if (eval22k.sg >= 17.5 && eval22k.karat === '22K') {
    pass('22K Specific Gravity & Karat Identification', `Air: ${test22kAir}g, Water: ${test22kWater}g -> SG: ${eval22k.sg}, Karat: ${eval22k.karat}`);
  } else {
    fail('22K Specific Gravity', `Expected >=17.5 & 22K, got SG ${eval22k.sg}, Karat ${eval22k.karat}`);
  }

  const test18kAir = 10.0;
  const test18kWater = 9.35; // loss in water 0.65g -> SG ~ 15.38
  const eval18k = calculateSpecificGravity(test18kAir, test18kWater);
  if (eval18k.sg >= 14.7 && eval18k.karat === '18K') {
    pass('18K Specific Gravity & Karat Identification', `Air: ${test18kAir}g, Water: ${test18kWater}g -> SG: ${eval18k.sg}, Karat: ${eval18k.karat}`);
  } else {
    fail('18K Specific Gravity', `Expected >=14.7 & 18K, got SG ${eval18k.sg}, Karat ${eval18k.karat}`);
  }

  // --- SECTION 2: GOLD APPRAISAL & LOAN VALUATION ---
  console.log('\n--- 2. GOLD VALUATION & LOAN-TO-VALUE (LTV) APPRAISAL ---');
  // Weight: 8.000g (1 Sovereign / 1 Poun) of 22K Gold
  // Market rate: 235,000 LKR per 8g Sovereign = ~29,375 per gram (or test rate 25,000 LKR/g)
  const sovereignWeight = 8.0;
  const testRatePerGram = 25000;
  const val22k = calculateGoldValuation(sovereignWeight, testRatePerGram, '22K', 80);
  // Expected: 8 * 25000 * 0.916 = 183,200 LKR appraised
  // Loan amount at 80% LTV: 183,200 * 0.80 = 146,560 LKR
  if (val22k.appraisedValue === 183200 && val22k.loanAmount === 146560) {
    pass('22K Sovereign Loan Appraisal (80% LTV)', `Appraised: Rs. ${val22k.appraisedValue.toLocaleString()} | Loan Amount: Rs. ${val22k.loanAmount.toLocaleString()}`);
  } else {
    fail('22K Sovereign Valuation', `Expected 183200 / 146560, got ${val22k.appraisedValue} / ${val22k.loanAmount}`);
  }

  // --- SECTION 3: TIER A REDEMPTION PAYMENT & INTEREST ACCRUALS (< 50,000 LKR) ---
  console.log('\n--- 3. TIER A REDEMPTION PAYMENT & ACCRUAL SLABS (P = 40,000 LKR) ---');
  const principalA = 40000;
  const insuranceFee = 50;

  // 3.1 Slab 1: Days 1-10 (Early Settlement Discount 1.0%)
  const rA_day5 = calculateRedemptionSettlement(principalA, 5, insuranceFee);
  // Tier A: 2.50% -> interestOne = 40000 * 0.025 = 1,000. TotalAmount = 41,000.
  // Discount = 41,000 * 0.01 = 410. Settlement = 41,000 - 410 = 40,590.
  if (rA_day5.tier === 'A' && rA_day5.settlement === 40590 && rA_day5.accruedCharges === 590) {
    pass('Tier A (Days 1-10 Early Discount)', `Day 5: Total Rs. ${rA_day5.settlement} (Charges: Rs. ${rA_day5.accruedCharges}) [Discount: Rs. 410 applied]`);
  } else {
    fail('Tier A Day 5', `Expected settlement 40590, got ${rA_day5.settlement}`);
  }

  // 3.2 Slab 2: Days 11-30 (Standard Month 1)
  const rA_day20 = calculateRedemptionSettlement(principalA, 20, insuranceFee);
  // Flat Total Amount = 41,000 LKR
  if (rA_day20.settlement === 41000 && rA_day20.accruedCharges === 1000) {
    pass('Tier A (Days 11-30 Flat Month 1)', `Day 20: Total Rs. ${rA_day20.settlement} (Interest: Rs. ${rA_day20.accruedCharges})`);
  } else {
    fail('Tier A Day 20', `Expected 41000, got ${rA_day20.settlement}`);
  }

  // 3.3 Slab 3: Days 31-38 (+25% Extra Accrual)
  const rA_day35 = calculateRedemptionSettlement(principalA, 35, insuranceFee);
  // Extra interest = (41000 * 0.025) * 0.25 = 256.25.
  // Final Total Interest = 1000 + 50 = 1050.
  // Settlement = 40000 + 256.25 + 1050 = 41306.25.
  if (rA_day35.settlement === 41306.25 && rA_day35.accruedCharges === 1306.25) {
    pass('Tier A (Days 31-38 25% Extra Month 2)', `Day 35: Total Rs. ${rA_day35.settlement} (Charges: Rs. ${rA_day35.accruedCharges})`);
  } else {
    fail('Tier A Day 35', `Expected 41306.25, got ${rA_day35.settlement}`);
  }

  // 3.4 Slab 4: Days 39-45 (+50% Extra Accrual)
  const rA_day42 = calculateRedemptionSettlement(principalA, 42, insuranceFee);
  // Extra interest = (41000 * 0.025) * 0.50 = 512.50.
  // Settlement = 40000 + 512.50 + 1050 = 41562.50.
  if (rA_day42.settlement === 41562.50 && rA_day42.accruedCharges === 1562.50) {
    pass('Tier A (Days 39-45 50% Extra Month 2)', `Day 42: Total Rs. ${rA_day42.settlement} (Charges: Rs. ${rA_day42.accruedCharges})`);
  } else {
    fail('Tier A Day 42', `Expected 41562.50, got ${rA_day42.settlement}`);
  }

  // 3.5 Slab 5: Days 46-60 (Full Month 2 Accrual)
  const rA_day55 = calculateRedemptionSettlement(principalA, 55, insuranceFee);
  // Extra interest = 41000 * 0.025 = 1025.00.
  // Settlement = 40000 + 1025 + 1050 = 42075.00.
  if (rA_day55.settlement === 42075.00 && rA_day55.accruedCharges === 2075.00) {
    pass('Tier A (Days 46-60 Full Month 2)', `Day 55: Total Rs. ${rA_day55.settlement} (Charges: Rs. ${rA_day55.accruedCharges})`);
  } else {
    fail('Tier A Day 55', `Expected 42075.00, got ${rA_day55.settlement}`);
  }

  // 3.6 Slab 6: Day 75 (Month 3 Accrual)
  const rA_day75 = calculateRedemptionSettlement(principalA, 75, insuranceFee);
  // months = ceil(75/30) = 3. Extra interest = (41000 * 0.025) * (3 - 1) = 2050.00.
  // Settlement = 40000 + 2050 + 1050 = 43100.00.
  if (rA_day75.settlement === 43100.00 && rA_day75.accruedCharges === 3100.00) {
    pass('Tier A (Day 75 - Month 3)', `Day 75: Total Rs. ${rA_day75.settlement} (Charges: Rs. ${rA_day75.accruedCharges})`);
  } else {
    fail('Tier A Day 75', `Expected 43100.00, got ${rA_day75.settlement}`);
  }

  // --- SECTION 4: TIER B REDEMPTION PAYMENT & INTEREST ACCRUALS (P >= 50,000 LKR) ---
  console.log('\n--- 4. TIER B REDEMPTION PAYMENT & ACCRUAL SLABS (P = 100,000 LKR) ---');
  const principalB = 100000;
  // Tier B rate = 2.75%, Discount = 0.50%
  // interestOne = 100000 * 0.0275 = 2,750. TotalAmount = 102,750.

  // 4.1 Tier B Early Discount (Days 1-10)
  const rB_day7 = calculateRedemptionSettlement(principalB, 7, insuranceFee);
  // Discount = 102750 * 0.0050 = 513.75.
  // Settlement = 102750 - 513.75 = 102236.25.
  if (rB_day7.tier === 'B' && rB_day7.settlement === 102236.25 && rB_day7.accruedCharges === 2236.25) {
    pass('Tier B (Days 1-10 Early Discount)', `Day 7: Total Rs. ${rB_day7.settlement} (Discount: Rs. 513.75 applied)`);
  } else {
    fail('Tier B Day 7', `Expected 102236.25, got ${rB_day7.settlement}`);
  }

  // 4.2 Tier B Flat Month 1 (Days 11-30)
  const rB_day25 = calculateRedemptionSettlement(principalB, 25, insuranceFee);
  if (rB_day25.settlement === 102750 && rB_day25.accruedCharges === 2750) {
    pass('Tier B (Days 11-30 Flat Month 1)', `Day 25: Total Rs. ${rB_day25.settlement} (Interest: Rs. ${rB_day25.accruedCharges})`);
  } else {
    fail('Tier B Day 25', `Expected 102750, got ${rB_day25.settlement}`);
  }

  // --- SECTION 5: CASH COUNT & DAY-END RECONCILIATION ---
  console.log('\n--- 5. DAY-END CASH DRAWER DENOMINATION CALCULATION ---');
  const cashCount = {
    "5000": 80,  // 400,000
    "1000": 50,  //  50,000
    "500":  15,  //   7,500
    "100":  12,  //   1,200
    "50":   4,   //     200
    "20":   0    //       0
  };
  const actualTotal = calculateDenominationsTotal(cashCount);
  const expectedTotal = 458900;
  if (actualTotal === expectedTotal) {
    pass('Denominations Aggregation', `Counted Total: Rs. ${actualTotal.toLocaleString()} exactly matches expected: Rs. ${expectedTotal.toLocaleString()}`);
  } else {
    fail('Denominations Aggregation', `Expected ${expectedTotal}, got ${actualTotal}`);
  }

  // --- SECTION 6: GENERAL LEDGER DOUBLE-ENTRY BALANCING ---
  console.log('\n--- 6. GENERAL LEDGER DOUBLE-ENTRY JOURNAL EQUALITY ---');
  // Disbursing loan of 146,560 LKR:
  const glDisburseLines = [
    { account: 'Pawn Loan Portfolio (Asset)', debit: 146560, credit: 0 },
    { account: 'Vault Cash (Asset)', debit: 0, credit: 146560 }
  ];
  const glDisburseCheck = verifyJournalEntryBalanced(glDisburseLines);
  if (glDisburseCheck.isBalanced && glDisburseCheck.totalDebit === 146560) {
    pass('Pawn Loan Disbursal GL Entry', `Balanced: Total Debit (${glDisburseCheck.totalDebit}) == Total Credit (${glDisburseCheck.totalCredit})`);
  } else {
    fail('Pawn Loan Disbursal GL Entry', 'Debits and Credits are not equal');
  }

  // Redeeming loan: Principal 40,000 LKR + Interest 1,000 LKR
  const glRedeemLines = [
    { account: 'Vault Cash (Asset)', debit: 41000, credit: 0 },
    { account: 'Pawn Loan Portfolio (Asset)', debit: 0, credit: 40000 },
    { account: 'Interest Income (Revenue)', debit: 0, credit: 1000 }
  ];
  const glRedeemCheck = verifyJournalEntryBalanced(glRedeemLines);
  if (glRedeemCheck.isBalanced && glRedeemCheck.totalDebit === 41000) {
    pass('Pawn Loan Redemption GL Entry', `Balanced: Total Debit (${glRedeemCheck.totalDebit}) == Total Credit (${glRedeemCheck.totalCredit})`);
  } else {
    fail('Pawn Loan Redemption GL Entry', 'Debits and Credits are not equal');
  }

  console.log('\n========================================================================');
  console.log('  ALL GOLD GRAM, APPRAISAL, PAYMENT & INTEREST TESTS VERIFIED! 🎯');
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('System calculation test failure:', err);
  process.exit(1);
});
