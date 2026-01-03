/**
 * Obsidian Decision Engine - Affordability Rules
 * 
 * Rule-based evaluation for affordability decisions.
 * CRITICAL: These rules are deterministic and form the foundation
 * of the decision. AI is only used for explanation synthesis.
 * 
 * Each rule:
 * - Has a unique identifier
 * - Returns pass/fail
 * - Provides reason codes
 * - Has a weight for final scoring
 * - Includes human-readable explanation
 * 
 * @module core/affordability/affordRules
 */

import { ReasonCode, RiskLevel, DecisionOutcome } from '../../models/DecisionResponse.js';
import {
  EMERGENCY_FUND,
  DEBT_TO_INCOME,
  CREDIT_UTILIZATION,
  AFFORDABILITY,
} from '../../config/thresholds.js';
import type {
  AffordabilityMetrics,
  PurchaseImpact,
  RuleResult,
  RuleEvaluationResult,
} from './affordTypes.js';
import { format } from '../../utils/money.js';

// =============================================================================
// RULE DEFINITIONS
// =============================================================================

type RuleFunction = (
  metrics: AffordabilityMetrics,
  impact: PurchaseImpact,
  purchaseAmount: number
) => RuleResult;

/**
 * Rule: Sufficient Buffer Remaining
 * After purchase, user should have at least minimum buffer months.
 */
const sufficientBufferRule: RuleFunction = (metrics, impact) => {
  const passed = impact.monthsOfBufferRemaining >= AFFORDABILITY.MINIMUM_POST_PURCHASE_BUFFER_MONTHS;
  
  return {
    ruleId: 'SUFFICIENT_BUFFER',
    passed,
    reasonCodes: passed ? ['HEALTHY_BUFFER'] : ['INSUFFICIENT_BUFFER'],
    weight: 0.25,
    explanation: passed
      ? `You'll maintain ${impact.monthsOfBufferRemaining.toFixed(1)} months of expenses as a buffer.`
      : `This purchase would leave you with only ${impact.monthsOfBufferRemaining.toFixed(1)} months of expenses - below the recommended minimum of ${AFFORDABILITY.MINIMUM_POST_PURCHASE_BUFFER_MONTHS} months.`,
    data: {
      monthsRemaining: impact.monthsOfBufferRemaining,
      minimumRequired: AFFORDABILITY.MINIMUM_POST_PURCHASE_BUFFER_MONTHS,
    },
  };
};

/**
 * Rule: Positive Cashflow Maintained
 * User should maintain positive monthly cashflow after purchase.
 */
const positiveCashflowRule: RuleFunction = (metrics, impact) => {
  const effectiveCashflow = impact.newMonthlyCashflow ?? metrics.monthlyCashflow;
  const passed = effectiveCashflow > 0;
  
  return {
    ruleId: 'POSITIVE_CASHFLOW',
    passed,
    reasonCodes: passed ? ['POSITIVE_CASHFLOW'] : ['NEGATIVE_CASHFLOW'],
    weight: 0.20,
    explanation: passed
      ? `Your monthly cashflow remains positive at ${format(effectiveCashflow)}.`
      : `This purchase would result in negative monthly cashflow of ${format(effectiveCashflow)}.`,
    data: {
      currentCashflow: metrics.monthlyCashflow,
      projectedCashflow: effectiveCashflow,
    },
  };
};

/**
 * Rule: Debt-to-Income Acceptable
 * After purchase (if using credit), DTI should remain acceptable.
 */
const debtToIncomeRule: RuleFunction = (metrics, impact) => {
  const effectiveDTI = impact.newDebtToIncomeRatio ?? metrics.debtToIncomeRatio;
  const passed = effectiveDTI <= DEBT_TO_INCOME.ACCEPTABLE;
  
  let explanation: string;
  let reasonCodes: ReasonCode[];
  
  if (effectiveDTI <= DEBT_TO_INCOME.GOOD) {
    reasonCodes = ['ACCEPTABLE_DEBT_TO_INCOME'];
    explanation = `Your debt-to-income ratio of ${(effectiveDTI * 100).toFixed(1)}% is in a healthy range.`;
  } else if (effectiveDTI <= DEBT_TO_INCOME.ACCEPTABLE) {
    reasonCodes = ['ACCEPTABLE_DEBT_TO_INCOME'];
    explanation = `Your debt-to-income ratio of ${(effectiveDTI * 100).toFixed(1)}% is acceptable but worth monitoring.`;
  } else {
    reasonCodes = ['HIGH_DEBT_TO_INCOME'];
    explanation = `This would push your debt-to-income ratio to ${(effectiveDTI * 100).toFixed(1)}%, above the recommended ${(DEBT_TO_INCOME.ACCEPTABLE * 100).toFixed(0)}% threshold.`;
  }
  
  return {
    ruleId: 'DEBT_TO_INCOME',
    passed,
    reasonCodes,
    weight: 0.15,
    explanation,
    data: {
      currentDTI: metrics.debtToIncomeRatio,
      projectedDTI: effectiveDTI,
      threshold: DEBT_TO_INCOME.ACCEPTABLE,
    },
  };
};

/**
 * Rule: Credit Utilization Acceptable
 * If using credit card, utilization should remain acceptable.
 */
const creditUtilizationRule: RuleFunction = (metrics, impact) => {
  // If no change in credit utilization, rule passes
  if (impact.creditUtilizationChange === null) {
    return {
      ruleId: 'CREDIT_UTILIZATION',
      passed: true,
      reasonCodes: [],
      weight: 0,
      explanation: 'Credit utilization not affected.',
    };
  }
  
  const newUtilization = metrics.creditUtilization + impact.creditUtilizationChange;
  const passed = newUtilization <= CREDIT_UTILIZATION.GOOD;
  
  return {
    ruleId: 'CREDIT_UTILIZATION',
    passed,
    reasonCodes: passed ? ['LOW_CREDIT_UTILIZATION'] : ['HIGH_CREDIT_UTILIZATION'],
    weight: 0.10,
    explanation: passed
      ? `Your credit utilization would be ${(newUtilization * 100).toFixed(0)}%, which is healthy for your credit score.`
      : `This would push your credit utilization to ${(newUtilization * 100).toFixed(0)}%, above the recommended ${(CREDIT_UTILIZATION.GOOD * 100).toFixed(0)}% for optimal credit health.`,
    data: {
      currentUtilization: metrics.creditUtilization,
      projectedUtilization: newUtilization,
      threshold: CREDIT_UTILIZATION.GOOD,
    },
  };
};

/**
 * Rule: Emergency Fund Adequacy
 * User should have adequate emergency fund before non-essential purchases.
 */
const emergencyFundRule: RuleFunction = (metrics) => {
  const passed = metrics.emergencyFundMonths >= EMERGENCY_FUND.MINIMUM_MONTHS;
  
  return {
    ruleId: 'EMERGENCY_FUND',
    passed,
    reasonCodes: passed ? ['EMERGENCY_FUND_ADEQUATE'] : ['EMERGENCY_FUND_INADEQUATE'],
    weight: 0.15,
    explanation: passed
      ? `You have ${metrics.emergencyFundMonths.toFixed(1)} months of expenses saved - a solid emergency fund.`
      : `Your emergency fund covers only ${metrics.emergencyFundMonths.toFixed(1)} months of expenses. Building this to ${EMERGENCY_FUND.MINIMUM_MONTHS} months is recommended before major purchases.`,
    data: {
      currentMonths: metrics.emergencyFundMonths,
      recommendedMonths: EMERGENCY_FUND.MINIMUM_MONTHS,
    },
  };
};

/**
 * Rule: Purchase Size Relative to Income
 * Large purchases relative to income require more scrutiny.
 */
const purchaseSizeRule: RuleFunction = (metrics, impact, purchaseAmount) => {
  const ratio = impact.purchaseToIncomeRatio;
  
  let passed: boolean;
  let reasonCodes: ReasonCode[];
  let explanation: string;
  
  if (ratio <= AFFORDABILITY.SMALL_PURCHASE_THRESHOLD) {
    passed = true;
    reasonCodes = ['AFFORDABLE_PURCHASE'];
    explanation = `At ${format(purchaseAmount)}, this is a relatively small purchase (${(ratio * 100).toFixed(1)}% of your monthly income).`;
  } else if (ratio <= AFFORDABILITY.LARGE_PURCHASE_THRESHOLD) {
    passed = true;
    reasonCodes = ['AFFORDABLE_PURCHASE'];
    explanation = `This purchase represents ${(ratio * 100).toFixed(1)}% of your monthly income - moderate but manageable.`;
  } else if (ratio <= AFFORDABILITY.MAJOR_PURCHASE_THRESHOLD) {
    passed = metrics.emergencyFundMonths >= EMERGENCY_FUND.MINIMUM_MONTHS;
    reasonCodes = passed ? ['AFFORDABLE_PURCHASE', 'PURCHASE_STRAINS_BUDGET'] : ['PURCHASE_STRAINS_BUDGET'];
    explanation = `This is a significant purchase at ${(ratio * 100).toFixed(1)}% of your monthly income. ${passed ? 'Your healthy finances can support it.' : 'Consider saving up first.'}`;
  } else {
    passed = false;
    reasonCodes = ['UNAFFORDABLE_PURCHASE'];
    explanation = `At ${(ratio * 100).toFixed(1)}% of your monthly income, this purchase is very large relative to your earnings.`;
  }
  
  return {
    ruleId: 'PURCHASE_SIZE',
    passed,
    reasonCodes,
    weight: 0.10,
    explanation,
    data: {
      purchaseAmount,
      ratio,
      monthlyIncome: metrics.monthlyIncome,
    },
  };
};

/**
 * Rule: Buffer Consumption
 * Purchase shouldn't consume too much of available buffer.
 */
const bufferConsumptionRule: RuleFunction = (metrics, impact) => {
  const consumption = impact.bufferConsumptionPercent;
  const passed = consumption <= AFFORDABILITY.MAX_BUFFER_CONSUMPTION;
  
  return {
    ruleId: 'BUFFER_CONSUMPTION',
    passed,
    reasonCodes: passed ? ['SAVINGS_HEALTHY'] : ['SAVINGS_DEPLETED'],
    weight: 0.05,
    explanation: passed
      ? `This purchase uses ${(consumption * 100).toFixed(0)}% of your available buffer.`
      : `This purchase would consume ${(consumption * 100).toFixed(0)}% of your available buffer - leaving you vulnerable to unexpected expenses.`,
    data: {
      consumptionPercent: consumption,
      threshold: AFFORDABILITY.MAX_BUFFER_CONSUMPTION,
    },
  };
};

/**
 * Rule: Luxury While in High-Interest Debt
 * Discourage non-essential purchases while carrying high-interest debt.
 */
const luxuryWhileInDebtRule: RuleFunction = (metrics) => {
  // This rule only applies if user has high-interest debt
  if (metrics.debtToIncomeRatio <= DEBT_TO_INCOME.GOOD) {
    return {
      ruleId: 'LUXURY_WHILE_IN_DEBT',
      passed: true,
      reasonCodes: [],
      weight: 0,
      explanation: 'Debt levels are manageable.',
    };
  }
  
  return {
    ruleId: 'LUXURY_WHILE_IN_DEBT',
    passed: true, // Don't fail, but warn
    reasonCodes: metrics.totalDebt > 0 ? ['LUXURY_WHILE_IN_DEBT'] : [],
    weight: 0.05,
    explanation: metrics.totalDebt > 0
      ? `Consider that you have ${format(metrics.totalDebt)} in debt. Prioritizing debt payoff could save you money on interest.`
      : 'You have no outstanding debt.',
    data: {
      totalDebt: metrics.totalDebt,
      dtiRatio: metrics.debtToIncomeRatio,
    },
  };
};

// =============================================================================
// RULE AGGREGATION
// =============================================================================

/**
 * All rules to evaluate for affordability.
 */
const ALL_RULES: RuleFunction[] = [
  sufficientBufferRule,
  positiveCashflowRule,
  debtToIncomeRule,
  creditUtilizationRule,
  emergencyFundRule,
  purchaseSizeRule,
  bufferConsumptionRule,
  luxuryWhileInDebtRule,
];

/**
 * Evaluate all affordability rules and aggregate results.
 */
export function evaluateAffordabilityRules(
  metrics: AffordabilityMetrics,
  impact: PurchaseImpact,
  purchaseAmount: number
): RuleEvaluationResult {
  // Evaluate all rules
  const results = ALL_RULES.map((rule) => rule(metrics, impact, purchaseAmount));
  
  // Filter out rules with zero weight (not applicable)
  const applicableRules = results.filter((r) => r.weight > 0);
  
  // Calculate weighted score
  const totalWeight = applicableRules.reduce((sum, r) => sum + r.weight, 0);
  const weightedSum = applicableRules.reduce(
    (sum, r) => sum + (r.passed ? r.weight : 0),
    0
  );
  const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // Collect all reason codes
  const allReasonCodes = results.flatMap((r) => r.reasonCodes);
  
  // Count passes and fails
  const passCount = applicableRules.filter((r) => r.passed).length;
  const failCount = applicableRules.filter((r) => !r.passed).length;
  
  // Determine suggested decision
  let suggestedDecision: DecisionOutcome;
  if (weightedScore >= 0.85) {
    suggestedDecision = 'YES';
  } else if (weightedScore >= 0.60) {
    suggestedDecision = 'CONDITIONAL';
  } else if (weightedScore >= 0.40) {
    suggestedDecision = 'DEFER';
  } else {
    suggestedDecision = 'NO';
  }
  
  // Determine risk level
  let suggestedRiskLevel: RiskLevel;
  if (weightedScore >= 0.85) {
    suggestedRiskLevel = 'LOW';
  } else if (weightedScore >= 0.60) {
    suggestedRiskLevel = 'MODERATE';
  } else if (weightedScore >= 0.40) {
    suggestedRiskLevel = 'HIGH';
  } else {
    suggestedRiskLevel = 'CRITICAL';
  }
  
  return {
    rules: results,
    passCount,
    failCount,
    weightedScore,
    allReasonCodes: [...new Set(allReasonCodes)], // Deduplicate
    suggestedDecision,
    suggestedRiskLevel,
  };
}

/**
 * Get rule explanations for display.
 */
export function getRuleExplanations(results: RuleResult[]): string[] {
  return results
    .filter((r) => r.weight > 0 && r.explanation)
    .map((r) => r.explanation);
}

/**
 * Get failed rule explanations for recommendations.
 */
export function getFailedRuleRecommendations(results: RuleResult[]): string[] {
  return results
    .filter((r) => !r.passed && r.weight > 0)
    .map((r) => {
      switch (r.ruleId) {
        case 'SUFFICIENT_BUFFER':
          return 'Build up your emergency buffer before making this purchase';
        case 'POSITIVE_CASHFLOW':
          return 'Reduce monthly expenses or increase income first';
        case 'DEBT_TO_INCOME':
          return 'Pay down existing debt before taking on new obligations';
        case 'CREDIT_UTILIZATION':
          return 'Pay down credit card balances to improve utilization';
        case 'EMERGENCY_FUND':
          return `Build emergency fund to ${EMERGENCY_FUND.MINIMUM_MONTHS} months of expenses`;
        case 'PURCHASE_SIZE':
          return 'Consider saving up for this purchase over time';
        case 'BUFFER_CONSUMPTION':
          return 'This purchase consumes too much of your safety net';
        default:
          return r.explanation;
      }
    });
}
