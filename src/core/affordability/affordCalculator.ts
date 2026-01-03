/**
 * Obsidian Decision Engine - Affordability Calculator
 * 
 * The core calculation engine for affordability decisions.
 * This module performs all deterministic calculations - no AI here.
 * 
 * Flow:
 * 1. Calculate user's financial metrics
 * 2. Calculate purchase impact
 * 3. Evaluate rules
 * 4. Generate decision and recommendations
 * 
 * @module core/affordability/affordCalculator
 */

import type { UserFinancialProfile, PurchaseRequest, DebtAccount } from '../../models/types.js';
import type { DecisionOutcome, RiskLevel, ReasonCode } from '../../models/DecisionResponse.js';
import type {
  AffordabilityMetrics,
  PurchaseImpact,
  AffordabilityCalculation,
} from './affordTypes.js';
import {
  evaluateAffordabilityRules,
  getFailedRuleRecommendations,
} from './affordRules.js';
import {
  money,
  add,
  subtract,
  divide,
  multiply,
  toDisplayDollars,
  sum,
  isZero,
  format,
} from '../../utils/money.js';
import { DEBT_PAYOFF } from '../../config/thresholds.js';

// =============================================================================
// METRICS CALCULATION
// =============================================================================

/**
 * Calculate minimum payment for a debt account.
 * If not provided, estimate based on debt type.
 */
function calculateMinimumPayment(debt: DebtAccount): number {
  if (debt.minimum_payment !== undefined) {
    return debt.minimum_payment;
  }
  
  // Estimate minimum payment based on debt type
  switch (debt.type) {
    case 'credit_card':
      // Credit cards: typically 2% of balance or $25, whichever is greater
      return Math.max(
        toDisplayDollars(multiply(debt.balance, DEBT_PAYOFF.MIN_CREDIT_CARD_PAYMENT_PERCENT)),
        DEBT_PAYOFF.MIN_PAYMENT_FLOOR
      );
    case 'personal_loan':
    case 'auto_loan':
    case 'student_loan':
      // Installment loans: estimate based on typical term
      // Assume 5 year term for personal/auto, 10 year for student
      const termMonths = debt.type === 'student_loan' ? 120 : 60;
      const monthlyRate = debt.apr / 100 / 12;
      if (monthlyRate === 0) {
        return toDisplayDollars(divide(debt.balance, termMonths));
      }
      // Standard amortization formula
      const payment = debt.balance * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);
      return Math.round(payment * 100) / 100;
    case 'mortgage':
      // Assume 30-year mortgage
      const mortgageMonths = 360;
      const mortgageRate = debt.apr / 100 / 12;
      if (mortgageRate === 0) {
        return toDisplayDollars(divide(debt.balance, mortgageMonths));
      }
      const mortgagePayment = debt.balance * (mortgageRate * Math.pow(1 + mortgageRate, mortgageMonths)) /
        (Math.pow(1 + mortgageRate, mortgageMonths) - 1);
      return Math.round(mortgagePayment * 100) / 100;
    default:
      // Default: 3% of balance or $25
      return Math.max(toDisplayDollars(multiply(debt.balance, 0.03)), DEBT_PAYOFF.MIN_PAYMENT_FLOOR);
  }
}

/**
 * Calculate credit utilization from debt accounts.
 */
function calculateCreditUtilization(debts: DebtAccount[]): number {
  const creditCards = debts.filter(
    (d) => d.type === 'credit_card' && d.credit_limit !== undefined && d.credit_limit > 0
  );
  
  if (creditCards.length === 0) return 0;
  
  const totalBalance = sum(creditCards.map((d) => d.balance));
  const totalLimit = sum(creditCards.map((d) => d.credit_limit ?? 0));
  
  if (isZero(totalLimit)) return 0;
  
  return toDisplayDollars(divide(totalBalance, totalLimit));
}

/**
 * Calculate all financial metrics for a user profile.
 */
export function calculateMetrics(profile: UserFinancialProfile): AffordabilityMetrics {
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  
  // Calculate total minimum debt payments
  const monthlyDebtPayments = profile.debts.reduce(
    (total, debt) => total + calculateMinimumPayment(debt),
    0
  );
  
  // Net monthly cashflow
  const monthlyCashflow = toDisplayDollars(
    subtract(monthlyIncome, monthlyExpenses, monthlyDebtPayments)
  );
  
  // Liquid assets (cash + savings)
  const liquidAssets = toDisplayDollars(
    add(profile.cash_balance, profile.savings_balance ?? 0, profile.emergency_fund ?? 0)
  );
  
  // Total debt
  const totalDebt = toDisplayDollars(sum(profile.debts.map((d) => d.balance)));
  
  // Debt-to-income ratio (annual debt payments / annual income)
  const annualDebtPayments = monthlyDebtPayments * 12;
  const annualIncome = monthlyIncome * 12;
  const debtToIncomeRatio = annualIncome > 0 ? annualDebtPayments / annualIncome : 0;
  
  // Credit utilization
  const creditUtilization = calculateCreditUtilization(profile.debts);
  
  // Emergency fund in months
  const monthlyEssentialExpenses = monthlyExpenses + monthlyDebtPayments;
  const emergencyFundMonths = monthlyEssentialExpenses > 0
    ? liquidAssets / monthlyEssentialExpenses
    : 0;
  
  // Savings rate
  const savingsRate = monthlyIncome > 0 ? Math.max(0, monthlyCashflow / monthlyIncome) : 0;
  
  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyDebtPayments,
    monthlyCashflow,
    liquidAssets,
    totalDebt,
    debtToIncomeRatio,
    creditUtilization,
    emergencyFundMonths,
    savingsRate,
  };
}

// =============================================================================
// PURCHASE IMPACT CALCULATION
// =============================================================================

/**
 * Calculate the impact of a proposed purchase on the user's finances.
 */
export function calculatePurchaseImpact(
  metrics: AffordabilityMetrics,
  purchase: PurchaseRequest,
  profile: UserFinancialProfile
): PurchaseImpact {
  const purchaseAmount = purchase.amount;
  
  // Calculate projected cash balance after purchase
  let projectedCashBalance: number;
  let newMonthlyCashflow: number | null = null;
  let newDebtToIncomeRatio: number | null = null;
  let creditUtilizationChange: number | null = null;
  
  switch (purchase.payment_method) {
    case 'cash':
    case 'debit':
      // Direct reduction of cash balance
      projectedCashBalance = toDisplayDollars(subtract(metrics.liquidAssets, purchaseAmount));
      break;
      
    case 'credit_card':
      // Cash not immediately affected, but credit utilization increases
      projectedCashBalance = metrics.liquidAssets;
      
      // Calculate credit utilization change
      const creditCards = profile.debts.filter(
        (d) => d.type === 'credit_card' && d.credit_limit !== undefined
      );
      const totalCreditLimit = sum(creditCards.map((d) => d.credit_limit ?? 0));
      if (!isZero(totalCreditLimit)) {
        creditUtilizationChange = toDisplayDollars(divide(purchaseAmount, totalCreditLimit));
      }
      
      // Estimate new minimum payment increase
      const newMinPayment = Math.max(purchaseAmount * 0.02, 25);
      newMonthlyCashflow = metrics.monthlyCashflow - newMinPayment;
      
      // Calculate new DTI
      const newAnnualDebtPayments = (metrics.monthlyDebtPayments + newMinPayment) * 12;
      const annualIncome = metrics.monthlyIncome * 12;
      newDebtToIncomeRatio = annualIncome > 0 ? newAnnualDebtPayments / annualIncome : 0;
      break;
      
    case 'buy_now_pay_later':
      // Typically 4 payments over 6 weeks - estimate monthly impact
      projectedCashBalance = toDisplayDollars(subtract(metrics.liquidAssets, divide(purchaseAmount, 4)));
      const bnplMonthlyPayment = purchaseAmount / 2; // Roughly 2 payments per month initially
      newMonthlyCashflow = metrics.monthlyCashflow - bnplMonthlyPayment;
      break;
      
    case 'financing':
      // Use provided financing terms or estimate
      projectedCashBalance = toDisplayDollars(
        subtract(metrics.liquidAssets, purchase.financing_terms?.down_payment ?? 0)
      );
      
      if (purchase.financing_terms) {
        const { apr, term_months, down_payment = 0 } = purchase.financing_terms;
        const financedAmount = purchaseAmount - down_payment;
        const monthlyRate = apr / 100 / 12;
        
        let monthlyPayment: number;
        if (monthlyRate === 0) {
          monthlyPayment = financedAmount / term_months;
        } else {
          monthlyPayment = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, term_months)) /
            (Math.pow(1 + monthlyRate, term_months) - 1);
        }
        
        newMonthlyCashflow = metrics.monthlyCashflow - monthlyPayment;
        
        // Calculate new DTI
        const newAnnualPayments = (metrics.monthlyDebtPayments + monthlyPayment) * 12;
        newDebtToIncomeRatio = metrics.monthlyIncome * 12 > 0
          ? newAnnualPayments / (metrics.monthlyIncome * 12)
          : 0;
      }
      break;
      
    case 'savings':
      // Using savings specifically
      projectedCashBalance = toDisplayDollars(subtract(metrics.liquidAssets, purchaseAmount));
      break;
      
    case 'mixed':
    default:
      // Assume 50% cash, 50% credit
      projectedCashBalance = toDisplayDollars(subtract(metrics.liquidAssets, divide(purchaseAmount, 2)));
      break;
  }
  
  // Calculate months of buffer remaining
  const monthlyEssentials = metrics.monthlyExpenses + metrics.monthlyDebtPayments;
  const monthsOfBufferRemaining = monthlyEssentials > 0
    ? Math.max(0, projectedCashBalance / monthlyEssentials)
    : 0;
  
  // Calculate buffer consumption percentage
  const bufferConsumptionPercent = metrics.liquidAssets > 0
    ? Math.max(0, 1 - (projectedCashBalance / metrics.liquidAssets))
    : 1;
  
  // Purchase as percentage of monthly income
  const purchaseToIncomeRatio = metrics.monthlyIncome > 0
    ? purchaseAmount / metrics.monthlyIncome
    : 1;
  
  return {
    projectedCashBalance,
    monthsOfBufferRemaining,
    newMonthlyCashflow,
    newDebtToIncomeRatio,
    creditUtilizationChange,
    bufferConsumptionPercent,
    purchaseToIncomeRatio,
  };
}

// =============================================================================
// ALTERNATIVE STRATEGIES
// =============================================================================

/**
 * Generate alternative purchase strategies.
 */
function generateAlternatives(
  metrics: AffordabilityMetrics,
  impact: PurchaseImpact,
  purchase: PurchaseRequest,
  decision: DecisionOutcome
): Array<{ strategy: string; description: string; savings?: number; timeline?: string }> {
  const alternatives: Array<{
    strategy: string;
    description: string;
    savings?: number;
    timeline?: string;
  }> = [];
  
  // Only generate alternatives if not a clear YES
  if (decision === 'YES') return alternatives;
  
  const purchaseAmount = purchase.amount;
  
  // Alternative 1: Delay and save
  if (metrics.monthlyCashflow > 0) {
    const monthsToSave = Math.ceil(purchaseAmount / metrics.monthlyCashflow);
    if (monthsToSave <= 12) {
      alternatives.push({
        strategy: 'delay_and_save',
        description: `Save ${format(metrics.monthlyCashflow)} per month and pay cash in ${monthsToSave} months`,
        timeline: `${monthsToSave} months`,
      });
    }
  }
  
  // Alternative 2: Partial purchase / smaller option
  const affordableAmount = Math.min(
    metrics.liquidAssets * 0.25, // Max 25% of liquid assets
    purchaseAmount * 0.5 // Or half the intended purchase
  );
  if (affordableAmount >= purchaseAmount * 0.3) {
    alternatives.push({
      strategy: 'reduced_purchase',
      description: `Consider a ${format(affordableAmount)} alternative that fits your budget better`,
      savings: purchaseAmount - affordableAmount,
    });
  }
  
  // Alternative 3: Pay down debt first
  if (metrics.totalDebt > 0 && impact.newDebtToIncomeRatio !== null) {
    const debtToPayDown = Math.min(metrics.totalDebt * 0.2, purchaseAmount);
    alternatives.push({
      strategy: 'debt_first',
      description: `Pay down ${format(debtToPayDown)} in debt first to improve your financial position`,
      timeline: `${Math.ceil(debtToPayDown / metrics.monthlyCashflow)} months`,
    });
  }
  
  // Alternative 4: 0% financing (if applicable)
  if (purchase.payment_method === 'cash' || purchase.payment_method === 'credit_card') {
    alternatives.push({
      strategy: '0%_financing',
      description: 'Look for 0% APR financing offers to spread payments without interest',
    });
  }
  
  // Alternative 5: Increase income
  alternatives.push({
    strategy: 'boost_income',
    description: 'Consider ways to increase income through overtime, freelance work, or selling unused items',
  });
  
  return alternatives.slice(0, 5); // Max 5 alternatives
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Perform complete affordability calculation.
 * This is the main entry point for the affordability engine.
 * 
 * @param profile User's financial profile
 * @param purchase Proposed purchase details
 * @returns Complete calculation result (before AI synthesis)
 */
export function calculateAffordability(
  profile: UserFinancialProfile,
  purchase: PurchaseRequest
): AffordabilityCalculation {
  // Step 1: Calculate user's financial metrics
  const metrics = calculateMetrics(profile);
  
  // Step 2: Calculate purchase impact
  const impact = calculatePurchaseImpact(metrics, purchase, profile);
  
  // Step 3: Evaluate all rules
  const ruleEvaluation = evaluateAffordabilityRules(metrics, impact, purchase.amount);
  
  // Step 4: Determine final decision
  // The rule evaluation provides a suggestion, but we may adjust based on severity
  let finalDecision = ruleEvaluation.suggestedDecision;
  
  // Override to NO if any critical condition is met
  if (impact.projectedCashBalance < 0) {
    finalDecision = 'NO';
  }
  if (impact.monthsOfBufferRemaining < 0.5) {
    finalDecision = 'NO';
  }
  
  // Override to CONDITIONAL if emergency fund is low but otherwise OK
  if (finalDecision === 'YES' && metrics.emergencyFundMonths < 2) {
    finalDecision = 'CONDITIONAL';
  }
  
  // Step 5: Calculate confidence
  // Higher confidence when data is complete and rules are clear
  let confidence = ruleEvaluation.weightedScore;
  
  // Reduce confidence for edge cases
  if (impact.monthsOfBufferRemaining < 1 && finalDecision !== 'NO') {
    confidence *= 0.8;
  }
  
  // Ensure confidence is in valid range
  confidence = Math.max(0, Math.min(1, confidence));
  
  // Step 6: Get recommendations for non-YES decisions
  const recommendations = finalDecision === 'YES'
    ? []
    : getFailedRuleRecommendations(ruleEvaluation.rules);
  
  // Step 7: Generate alternatives
  const alternatives = generateAlternatives(metrics, impact, purchase, finalDecision);
  
  return {
    metrics,
    impact,
    ruleEvaluation,
    decision: finalDecision,
    confidence,
    riskLevel: ruleEvaluation.suggestedRiskLevel,
    reasonCodes: ruleEvaluation.allReasonCodes as ReasonCode[],
    recommendations,
    alternatives,
  };
}

/**
 * Get human-readable summary of metrics.
 */
export function getMetricsSummary(metrics: AffordabilityMetrics): string {
  const lines = [
    `Monthly Income: ${format(metrics.monthlyIncome)}`,
    `Monthly Expenses: ${format(metrics.monthlyExpenses)}`,
    `Debt Payments: ${format(metrics.monthlyDebtPayments)}`,
    `Net Cashflow: ${format(metrics.monthlyCashflow)}`,
    `Liquid Assets: ${format(metrics.liquidAssets)}`,
    `Emergency Fund: ${metrics.emergencyFundMonths.toFixed(1)} months`,
    `Debt-to-Income: ${(metrics.debtToIncomeRatio * 100).toFixed(1)}%`,
    `Credit Utilization: ${(metrics.creditUtilization * 100).toFixed(0)}%`,
  ];
  
  return lines.join('\n');
}
