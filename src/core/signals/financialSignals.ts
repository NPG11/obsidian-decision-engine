/**
 * Obsidian Decision Engine - Financial Signals
 * 
 * Detects patterns, risks, and opportunities in user financial data.
 * These signals drive the "Next Best Action" recommendations.
 * 
 * @module core/signals
 */

import type { UserFinancialProfile, DebtAccount } from '../../models/types.js';
import {
  EMERGENCY_FUND,
  DEBT_TO_INCOME,
  CREDIT_UTILIZATION,
  INTEREST_RATES,
  CASHFLOW,
  SAVINGS_RATE,
} from '../../config/thresholds.js';

// =============================================================================
// SIGNAL TYPES
// =============================================================================

export type SignalSeverity = 'info' | 'warning' | 'critical' | 'positive';

export interface FinancialSignal {
  /** Unique signal identifier */
  id: string;
  
  /** Signal category */
  category: 'risk' | 'cashflow' | 'debt' | 'savings' | 'opportunity' | 'behavior';
  
  /** Signal severity */
  severity: SignalSeverity;
  
  /** Short signal title */
  title: string;
  
  /** Detailed description */
  description: string;
  
  /** Relevant metric value */
  value: number;
  
  /** Threshold that triggered this signal */
  threshold?: number;
  
  /** Recommended action to address this signal */
  recommendedAction?: string;
  
  /** Priority score (0-100, higher = more important) */
  priority: number;
}

// =============================================================================
// RISK SIGNALS
// =============================================================================

export function detectRiskSignals(profile: UserFinancialProfile): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  
  // Calculate key metrics
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  const liquidAssets = profile.cash_balance + (profile.savings_balance ?? 0) + (profile.emergency_fund ?? 0);
  const monthlyDebtPayments = profile.debts.reduce(
    (sum, d) => sum + estimateMinimumPayment(d),
    0
  );
  
  // Emergency fund check
  const totalMonthlyNeeds = monthlyExpenses + monthlyDebtPayments;
  const emergencyFundMonths = totalMonthlyNeeds > 0 ? liquidAssets / totalMonthlyNeeds : 0;
  
  if (emergencyFundMonths < EMERGENCY_FUND.CRITICAL_MONTHS) {
    signals.push({
      id: 'EMERGENCY_FUND_CRITICAL',
      category: 'risk',
      severity: 'critical',
      title: 'Emergency Fund Critically Low',
      description: `You have less than ${EMERGENCY_FUND.CRITICAL_MONTHS} month of expenses saved. This leaves you vulnerable to unexpected expenses or income loss.`,
      value: emergencyFundMonths,
      threshold: EMERGENCY_FUND.CRITICAL_MONTHS,
      recommendedAction: 'Prioritize building emergency fund before any non-essential spending',
      priority: 95,
    });
  } else if (emergencyFundMonths < EMERGENCY_FUND.MINIMUM_MONTHS) {
    signals.push({
      id: 'EMERGENCY_FUND_LOW',
      category: 'risk',
      severity: 'warning',
      title: 'Emergency Fund Below Recommended Level',
      description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses saved. Aim for at least ${EMERGENCY_FUND.MINIMUM_MONTHS} months.`,
      value: emergencyFundMonths,
      threshold: EMERGENCY_FUND.MINIMUM_MONTHS,
      recommendedAction: `Save an additional $${Math.round((EMERGENCY_FUND.MINIMUM_MONTHS - emergencyFundMonths) * totalMonthlyNeeds)} to reach the minimum`,
      priority: 70,
    });
  } else {
    signals.push({
      id: 'EMERGENCY_FUND_HEALTHY',
      category: 'savings',
      severity: 'positive',
      title: 'Healthy Emergency Fund',
      description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses saved - great job!`,
      value: emergencyFundMonths,
      priority: 10,
    });
  }
  
  // Debt-to-income check
  const annualDebtPayments = monthlyDebtPayments * 12;
  const annualIncome = monthlyIncome * 12;
  const dtiRatio = annualIncome > 0 ? annualDebtPayments / annualIncome : 0;
  
  if (dtiRatio > DEBT_TO_INCOME.CRITICAL) {
    signals.push({
      id: 'DTI_CRITICAL',
      category: 'debt',
      severity: 'critical',
      title: 'Debt-to-Income Ratio Critical',
      description: `Your DTI is ${(dtiRatio * 100).toFixed(1)}%, well above the ${(DEBT_TO_INCOME.CRITICAL * 100).toFixed(0)}% critical threshold. This indicates severe financial stress.`,
      value: dtiRatio,
      threshold: DEBT_TO_INCOME.CRITICAL,
      recommendedAction: 'Consider debt consolidation or credit counseling',
      priority: 90,
    });
  } else if (dtiRatio > DEBT_TO_INCOME.HIGH) {
    signals.push({
      id: 'DTI_HIGH',
      category: 'debt',
      severity: 'warning',
      title: 'High Debt-to-Income Ratio',
      description: `Your DTI is ${(dtiRatio * 100).toFixed(1)}%, above the ${(DEBT_TO_INCOME.HIGH * 100).toFixed(0)}% recommended limit.`,
      value: dtiRatio,
      threshold: DEBT_TO_INCOME.HIGH,
      recommendedAction: 'Focus on paying down debt aggressively',
      priority: 75,
    });
  }
  
  // Variable income risk
  if (profile.employment_status === 'self_employed' || profile.employment_status === 'employed_part_time') {
    if (emergencyFundMonths < EMERGENCY_FUND.VARIABLE_INCOME_MONTHS) {
      signals.push({
        id: 'VARIABLE_INCOME_RISK',
        category: 'risk',
        severity: 'warning',
        title: 'Variable Income Without Adequate Buffer',
        description: `With variable income, you should have ${EMERGENCY_FUND.VARIABLE_INCOME_MONTHS} months of expenses saved. You currently have ${emergencyFundMonths.toFixed(1)} months.`,
        value: emergencyFundMonths,
        threshold: EMERGENCY_FUND.VARIABLE_INCOME_MONTHS,
        recommendedAction: 'Build larger emergency fund to account for income variability',
        priority: 65,
      });
    }
  }
  
  return signals;
}

// =============================================================================
// CASHFLOW SIGNALS
// =============================================================================

export function detectCashflowSignals(profile: UserFinancialProfile): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  const monthlyDebtPayments = profile.debts.reduce(
    (sum, d) => sum + estimateMinimumPayment(d),
    0
  );
  
  const monthlyCashflow = monthlyIncome - monthlyExpenses - monthlyDebtPayments;
  const cashflowRatio = monthlyIncome > 0 ? monthlyCashflow / monthlyIncome : 0;
  
  // Negative cashflow
  if (monthlyCashflow < 0) {
    signals.push({
      id: 'NEGATIVE_CASHFLOW',
      category: 'cashflow',
      severity: 'critical',
      title: 'Negative Monthly Cashflow',
      description: `You're spending $${Math.abs(monthlyCashflow).toFixed(2)} more than you earn each month. This is unsustainable.`,
      value: monthlyCashflow,
      threshold: 0,
      recommendedAction: 'Immediately review expenses and find areas to cut',
      priority: 100,
    });
  } else if (cashflowRatio < SAVINGS_RATE.MINIMUM) {
    signals.push({
      id: 'LOW_SAVINGS_RATE',
      category: 'cashflow',
      severity: 'warning',
      title: 'Low Savings Rate',
      description: `You're only saving ${(cashflowRatio * 100).toFixed(1)}% of your income. Aim for at least ${(SAVINGS_RATE.MINIMUM * 100).toFixed(0)}%.`,
      value: cashflowRatio,
      threshold: SAVINGS_RATE.MINIMUM,
      recommendedAction: 'Review subscriptions and discretionary spending',
      priority: 50,
    });
  } else if (cashflowRatio >= SAVINGS_RATE.RECOMMENDED) {
    signals.push({
      id: 'HEALTHY_SAVINGS_RATE',
      category: 'cashflow',
      severity: 'positive',
      title: 'Healthy Savings Rate',
      description: `You're saving ${(cashflowRatio * 100).toFixed(1)}% of your income - excellent financial discipline!`,
      value: cashflowRatio,
      priority: 10,
    });
  }
  
  return signals;
}

// =============================================================================
// DEBT SIGNALS
// =============================================================================

export function detectDebtSignals(profile: UserFinancialProfile): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  
  // Check each debt
  for (const debt of profile.debts) {
    if (debt.balance <= 0) continue;
    
    // High APR debt
    if (debt.apr >= INTEREST_RATES.PREDATORY_APR) {
      signals.push({
        id: `PREDATORY_APR_${debt.id ?? debt.type}`,
        category: 'debt',
        severity: 'critical',
        title: `Predatory Interest Rate on ${debt.name ?? debt.type}`,
        description: `This debt has a ${debt.apr}% APR, which is extremely high. You're paying significant interest.`,
        value: debt.apr,
        threshold: INTEREST_RATES.PREDATORY_APR,
        recommendedAction: 'Prioritize paying this off immediately or seek refinancing',
        priority: 85,
      });
    } else if (debt.apr >= INTEREST_RATES.VERY_HIGH_APR) {
      signals.push({
        id: `VERY_HIGH_APR_${debt.id ?? debt.type}`,
        category: 'debt',
        severity: 'warning',
        title: `High Interest Rate on ${debt.name ?? debt.type}`,
        description: `This debt has a ${debt.apr}% APR. Consider prioritizing payoff.`,
        value: debt.apr,
        threshold: INTEREST_RATES.VERY_HIGH_APR,
        recommendedAction: 'Make this a priority in your debt payoff strategy',
        priority: 70,
      });
    }
    
    // Credit utilization for credit cards
    if (debt.type === 'credit_card' && debt.credit_limit && debt.credit_limit > 0) {
      const utilization = debt.balance / debt.credit_limit;
      
      if (utilization >= CREDIT_UTILIZATION.CRITICAL) {
        signals.push({
          id: `CREDIT_MAXED_${debt.id ?? debt.type}`,
          category: 'debt',
          severity: 'critical',
          title: `${debt.name ?? 'Credit Card'} Near Limit`,
          description: `You're using ${(utilization * 100).toFixed(0)}% of your credit limit. This severely impacts your credit score.`,
          value: utilization,
          threshold: CREDIT_UTILIZATION.CRITICAL,
          recommendedAction: 'Pay down this card as quickly as possible',
          priority: 80,
        });
      } else if (utilization >= CREDIT_UTILIZATION.HIGH) {
        signals.push({
          id: `HIGH_UTILIZATION_${debt.id ?? debt.type}`,
          category: 'debt',
          severity: 'warning',
          title: `High Utilization on ${debt.name ?? 'Credit Card'}`,
          description: `You're using ${(utilization * 100).toFixed(0)}% of your credit limit. Keep under 30% for best credit score.`,
          value: utilization,
          threshold: CREDIT_UTILIZATION.HIGH,
          recommendedAction: 'Reduce balance to improve credit score',
          priority: 55,
        });
      }
    }
  }
  
  // No debt - positive signal
  if (profile.debts.length === 0 || profile.debts.every((d) => d.balance <= 0)) {
    signals.push({
      id: 'DEBT_FREE',
      category: 'debt',
      severity: 'positive',
      title: 'Debt Free!',
      description: 'You have no outstanding debt. This gives you maximum financial flexibility.',
      value: 0,
      priority: 5,
    });
  }
  
  return signals;
}

// =============================================================================
// OPPORTUNITY SIGNALS
// =============================================================================

export function detectOpportunitySignals(profile: UserFinancialProfile): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  const liquidAssets = profile.cash_balance + (profile.savings_balance ?? 0);
  const monthlyCashflow = monthlyIncome - monthlyExpenses;
  
  // Excess cash sitting idle
  const monthsOfCashOnHand = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  
  if (monthsOfCashOnHand > 12 && profile.debts.length === 0) {
    signals.push({
      id: 'EXCESS_CASH',
      category: 'opportunity',
      severity: 'info',
      title: 'Consider Investing Excess Cash',
      description: `You have ${monthsOfCashOnHand.toFixed(0)} months of expenses in cash. Consider investing the excess for better returns.`,
      value: monthsOfCashOnHand,
      recommendedAction: 'Explore high-yield savings accounts or index fund investments',
      priority: 30,
    });
  }
  
  // High-interest debt refinancing opportunity
  const highInterestDebts = profile.debts.filter((d) => d.apr > INTEREST_RATES.HIGH_APR && d.balance > 1000);
  if (highInterestDebts.length > 0 && (profile.credit_score ?? 0) >= 700) {
    signals.push({
      id: 'REFINANCE_OPPORTUNITY',
      category: 'opportunity',
      severity: 'info',
      title: 'Potential Refinancing Opportunity',
      description: `With your credit score, you may qualify for lower rates on ${highInterestDebts.length} debt(s).`,
      value: highInterestDebts.reduce((sum, d) => sum + d.balance, 0),
      recommendedAction: 'Shop for balance transfer offers or personal loan refinancing',
      priority: 40,
    });
  }
  
  // Good candidate for automation
  if (monthlyCashflow > 200 && profile.debts.every((d) => d.balance <= 0)) {
    signals.push({
      id: 'AUTOMATE_SAVINGS',
      category: 'opportunity',
      severity: 'positive',
      title: 'Ready for Automated Savings',
      description: `With ${formatMoney(monthlyCashflow)} positive cashflow, you can automate your savings and investing.`,
      value: monthlyCashflow,
      recommendedAction: 'Set up automatic transfers to savings and investment accounts',
      priority: 25,
    });
  }
  
  return signals;
}

// =============================================================================
// ALL SIGNALS
// =============================================================================

/**
 * Detect all financial signals from a user profile.
 */
export function detectAllSignals(profile: UserFinancialProfile): FinancialSignal[] {
  const allSignals = [
    ...detectRiskSignals(profile),
    ...detectCashflowSignals(profile),
    ...detectDebtSignals(profile),
    ...detectOpportunitySignals(profile),
  ];
  
  // Sort by priority (highest first)
  return allSignals.sort((a, b) => b.priority - a.priority);
}

/**
 * Get critical signals only.
 */
export function getCriticalSignals(signals: FinancialSignal[]): FinancialSignal[] {
  return signals.filter((s) => s.severity === 'critical');
}

/**
 * Get positive signals only.
 */
export function getPositiveSignals(signals: FinancialSignal[]): FinancialSignal[] {
  return signals.filter((s) => s.severity === 'positive');
}

// =============================================================================
// HELPERS
// =============================================================================

function estimateMinimumPayment(debt: DebtAccount): number {
  if (debt.minimum_payment) return debt.minimum_payment;
  
  switch (debt.type) {
    case 'credit_card':
      return Math.max(debt.balance * 0.02, 25);
    case 'mortgage':
      return debt.balance * 0.004; // Rough estimate
    default:
      return debt.balance * 0.03;
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
