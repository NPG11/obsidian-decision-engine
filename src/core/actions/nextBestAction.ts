/**
 * Obsidian Decision Engine - Next Best Action Engine
 * 
 * Analyzes user's financial situation and recommends prioritized actions.
 * This is the "smart advisor" component of the engine.
 * 
 * @module core/actions/nextBestAction
 */

import { z } from 'zod';
import type { UserFinancialProfile } from '../../models/types.js';
import type { RecommendedAction, NextBestActionResponse } from '../../models/DecisionResponse.js';
import { detectAllSignals, getCriticalSignals, getPositiveSignals, type FinancialSignal } from '../signals/financialSignals.js';
import {
  EMERGENCY_FUND,
  DEBT_TO_INCOME,
  SAVINGS_RATE,
  INTEREST_RATES,
  HEALTH_SCORE_WEIGHTS,
} from '../../config/thresholds.js';
import { format } from '../../utils/money.js';
import { ENGINE_VERSION } from '../../config/constants.js';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

export const NextBestActionRequestSchema = z.object({
  user: z.any(),
  max_actions: z.number().int().min(1).max(10).default(5),
  include_ai_explanation: z.boolean().default(true),
});

export type NextBestActionRequest = z.infer<typeof NextBestActionRequestSchema>;

// =============================================================================
// HEALTH SCORE CALCULATION
// =============================================================================

interface HealthMetrics {
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  monthlyCashflow: number;
  savingsRate: number;
  creditUtilization: number;
}

function calculateHealthMetrics(profile: UserFinancialProfile): HealthMetrics {
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  const liquidAssets = profile.cash_balance + (profile.savings_balance ?? 0) + (profile.emergency_fund ?? 0);
  
  const monthlyDebtPayments = profile.debts.reduce(
    (sum, d) => sum + (d.minimum_payment ?? Math.max(d.balance * 0.02, 25)),
    0
  );
  
  const totalMonthlyNeeds = monthlyExpenses + monthlyDebtPayments;
  const emergencyFundMonths = totalMonthlyNeeds > 0 ? liquidAssets / totalMonthlyNeeds : 0;
  
  const annualDebtPayments = monthlyDebtPayments * 12;
  const annualIncome = monthlyIncome * 12;
  const debtToIncomeRatio = annualIncome > 0 ? annualDebtPayments / annualIncome : 0;
  
  const monthlyCashflow = monthlyIncome - monthlyExpenses - monthlyDebtPayments;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, monthlyCashflow / monthlyIncome) : 0;
  
  const creditCards = profile.debts.filter((d) => d.type === 'credit_card' && d.credit_limit);
  const totalBalance = creditCards.reduce((sum, d) => sum + d.balance, 0);
  const totalLimit = creditCards.reduce((sum, d) => sum + (d.credit_limit ?? 0), 0);
  const creditUtilization = totalLimit > 0 ? totalBalance / totalLimit : 0;
  
  return {
    emergencyFundMonths,
    debtToIncomeRatio,
    monthlyCashflow,
    savingsRate,
    creditUtilization,
  };
}

function calculateHealthScore(metrics: HealthMetrics): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  
  const efScore = Math.min(100, (metrics.emergencyFundMonths / EMERGENCY_FUND.IDEAL_MONTHS) * 100);
  breakdown.emergency_fund = efScore;
  
  const dtiScore = Math.max(0, 100 - (metrics.debtToIncomeRatio / DEBT_TO_INCOME.CRITICAL) * 100);
  breakdown.debt_to_income = dtiScore;
  
  const cashflowScore = metrics.monthlyCashflow >= 0 ? Math.min(100, 50 + metrics.savingsRate * 250) : 0;
  breakdown.cashflow = cashflowScore;
  
  const savingsScore = Math.min(100, (metrics.savingsRate / SAVINGS_RATE.RECOMMENDED) * 100);
  breakdown.savings_rate = savingsScore;
  
  const cuScore = Math.max(0, 100 - metrics.creditUtilization * 100);
  breakdown.credit_utilization = cuScore;
  
  const score =
    efScore * HEALTH_SCORE_WEIGHTS.EMERGENCY_FUND +
    dtiScore * HEALTH_SCORE_WEIGHTS.DEBT_TO_INCOME +
    cashflowScore * HEALTH_SCORE_WEIGHTS.CASHFLOW +
    savingsScore * HEALTH_SCORE_WEIGHTS.SAVINGS_RATE +
    cuScore * HEALTH_SCORE_WEIGHTS.CREDIT_UTILIZATION;
  
  return { score: Math.round(score), breakdown };
}

function getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// =============================================================================
// ACTION GENERATION
// =============================================================================

interface ActionCandidate {
  action: Omit<RecommendedAction, 'action_id' | 'priority'>;
  score: number;
}

function generateActionCandidates(
  profile: UserFinancialProfile,
  metrics: HealthMetrics,
  signals: FinancialSignal[]
): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  
  const monthlyIncome = profile.monthly_income;
  const monthlyExpenses = profile.monthly_fixed_expenses;
  const totalDebt = profile.debts.reduce((sum, d) => sum + d.balance, 0);
  
  // 1. CRITICAL: Negative cashflow
  if (metrics.monthlyCashflow < 0) {
    candidates.push({
      action: {
        action_type: 'reduce_expense',
        title: 'Address Negative Cashflow Immediately',
        description: `You're spending ${format(Math.abs(metrics.monthlyCashflow))} more than you earn each month. This is unsustainable.`,
        impact: {
          monthly_savings: Math.abs(metrics.monthlyCashflow),
          risk_reduction: 'Prevents debt spiral',
        },
        effort_level: 'high',
        urgency: 'immediate',
        steps: [
          'List all monthly subscriptions and cancel non-essentials',
          'Review last 3 months of spending for patterns',
          'Identify the top 3 expense categories to reduce',
          'Create a strict budget and track daily spending',
        ],
        reason_codes: ['NEGATIVE_CASHFLOW'],
      },
      score: 100,
    });
  }
  
  // 2. Build emergency fund
  if (metrics.emergencyFundMonths < EMERGENCY_FUND.MINIMUM_MONTHS) {
    const monthlyDebtPayments = profile.debts.reduce(
      (sum, d) => sum + (d.minimum_payment ?? d.balance * 0.02), 0
    );
    const targetAmount = (monthlyExpenses + monthlyDebtPayments) * EMERGENCY_FUND.MINIMUM_MONTHS;
    const currentAmount = profile.cash_balance + (profile.savings_balance ?? 0) + (profile.emergency_fund ?? 0);
    const amountNeeded = targetAmount - currentAmount;
    
    const isCritical = metrics.emergencyFundMonths < EMERGENCY_FUND.CRITICAL_MONTHS;
    
    candidates.push({
      action: {
        action_type: 'build_emergency_fund',
        title: isCritical ? 'Build Emergency Fund (Critical)' : 'Grow Your Emergency Fund',
        description: `You have ${metrics.emergencyFundMonths.toFixed(1)} months of expenses saved. ${isCritical ? 'This is dangerously low.' : `Aim for ${EMERGENCY_FUND.MINIMUM_MONTHS} months.`}`,
        impact: {
          total_savings: amountNeeded,
          risk_reduction: 'Protection against unexpected expenses',
          time_to_complete: metrics.monthlyCashflow > 0 
            ? `${Math.ceil(amountNeeded / metrics.monthlyCashflow)} months`
            : 'Requires positive cashflow first',
        },
        effort_level: 'medium',
        urgency: isCritical ? 'immediate' : 'this_month',
        steps: [
          'Open a high-yield savings account if you don\'t have one',
          `Set up automatic transfer of ${format(Math.min(Math.max(0, metrics.monthlyCashflow * 0.5), amountNeeded / 6))} per month`,
          'Direct any windfalls (tax refund, bonus) to emergency fund',
        ],
        reason_codes: ['EMERGENCY_FUND_INADEQUATE'],
      },
      score: isCritical ? 95 : 70,
    });
  }
  
  // 3. Pay down high-interest debt
  const highInterestDebts = profile.debts.filter((d) => d.apr >= INTEREST_RATES.HIGH_APR && d.balance > 0);
  if (highInterestDebts.length > 0) {
    const highestAPRDebt = highInterestDebts.reduce((max, d) => d.apr > max.apr ? d : max);
    const monthlyInterestCost = highestAPRDebt.balance * (highestAPRDebt.apr / 100 / 12);
    
    candidates.push({
      action: {
        action_type: 'pay_debt',
        title: `Attack High-Interest Debt: ${highestAPRDebt.name ?? highestAPRDebt.type}`,
        description: `This ${highestAPRDebt.apr}% APR debt costs you ${format(monthlyInterestCost)} in interest every month.`,
        impact: {
          monthly_savings: monthlyInterestCost,
          total_savings: highestAPRDebt.balance * (highestAPRDebt.apr / 100 / 2),
          risk_reduction: 'Reduces financial stress and improves credit',
        },
        effort_level: 'medium',
        urgency: highestAPRDebt.apr >= INTEREST_RATES.PREDATORY_APR ? 'immediate' : 'this_week',
        steps: [
          `Pay minimum on all debts except ${highestAPRDebt.name ?? highestAPRDebt.type}`,
          `Put all extra money toward this ${format(highestAPRDebt.balance)} balance`,
          'Consider balance transfer to 0% APR card if eligible',
        ],
        reason_codes: ['HIGH_INTEREST_DEBT'],
      },
      score: highestAPRDebt.apr >= INTEREST_RATES.PREDATORY_APR ? 90 : 75,
    });
  }
  
  // 4. Reduce high credit utilization
  const highUtilizationCards = profile.debts.filter(
    (d) => d.type === 'credit_card' && d.credit_limit && d.balance / d.credit_limit > 0.3
  );
  if (highUtilizationCards.length > 0) {
    const worstCard = highUtilizationCards.reduce(
      (max, d) => (d.balance / (d.credit_limit ?? 1)) > (max.balance / (max.credit_limit ?? 1)) ? d : max
    );
    const currentUtil = worstCard.balance / (worstCard.credit_limit ?? 1);
    const targetBalance = (worstCard.credit_limit ?? 0) * 0.3;
    const amountToPayDown = worstCard.balance - targetBalance;
    
    candidates.push({
      action: {
        action_type: 'pay_debt',
        title: `Lower Credit Utilization on ${worstCard.name ?? 'Credit Card'}`,
        description: `Your ${(currentUtil * 100).toFixed(0)}% utilization is hurting your credit score. Get under 30%.`,
        impact: {
          total_savings: amountToPayDown,
          risk_reduction: 'Potential credit score boost of 20-50 points',
        },
        effort_level: 'medium',
        urgency: currentUtil > 0.9 ? 'this_week' : 'this_month',
        steps: [
          `Pay down ${format(amountToPayDown)} to reach 30% utilization`,
          'Make multiple payments per month to keep reported balance low',
          'Request credit limit increase (without hard inquiry if possible)',
        ],
        reason_codes: ['HIGH_CREDIT_UTILIZATION'],
      },
      score: currentUtil > 0.7 ? 65 : 50,
    });
  }
  
  // 5. Review subscriptions
  if (metrics.savingsRate < SAVINGS_RATE.MINIMUM && metrics.monthlyCashflow >= 0) {
    candidates.push({
      action: {
        action_type: 'review_subscriptions',
        title: 'Audit Your Subscriptions',
        description: 'Monthly subscriptions often go unnoticed. A quick review could free up cash.',
        impact: {
          monthly_savings: monthlyIncome * 0.03,
          risk_reduction: 'Improved cashflow flexibility',
        },
        effort_level: 'low',
        urgency: 'this_week',
        steps: [
          'Check bank/card statements for recurring charges',
          'List all subscriptions (streaming, software, memberships)',
          'Cancel anything unused in the last 30 days',
          'Downgrade plans where possible',
        ],
        reason_codes: ['CASHFLOW_AT_RISK'],
      },
      score: 45,
    });
  }
  
  // 6. Automate savings
  if (metrics.monthlyCashflow > 200 && metrics.emergencyFundMonths >= EMERGENCY_FUND.MINIMUM_MONTHS) {
    candidates.push({
      action: {
        action_type: 'automate_savings',
        title: 'Automate Your Financial Success',
        description: 'Your finances are healthy enough to put savings on autopilot.',
        impact: {
          monthly_savings: metrics.monthlyCashflow * 0.8,
          risk_reduction: 'Consistent wealth building',
        },
        effort_level: 'low',
        urgency: 'this_month',
        steps: [
          'Set up automatic transfer to savings on payday',
          'If no debt, consider automatic investment contributions',
          'Review and increase automation amount quarterly',
        ],
        reason_codes: ['POSITIVE_CASHFLOW'],
      },
      score: 35,
    });
  }
  
  // 7. Celebrate if doing well
  if (metrics.emergencyFundMonths >= EMERGENCY_FUND.IDEAL_MONTHS && totalDebt === 0 && metrics.savingsRate >= SAVINGS_RATE.RECOMMENDED) {
    candidates.push({
      action: {
        action_type: 'maintain_course',
        title: 'You\'re Crushing It! 🎉',
        description: 'Your finances are in excellent shape. Keep doing what you\'re doing!',
        impact: {
          risk_reduction: 'Financial independence on track',
        },
        effort_level: 'low',
        urgency: 'when_possible',
        steps: [
          'Continue your excellent habits',
          'Consider increasing investment contributions',
          'Review insurance coverage and estate planning',
        ],
        reason_codes: ['CALCULATION_COMPLETE'],
      },
      score: 10,
    });
  }
  
  // 8. Negotiate bills
  if (metrics.savingsRate < SAVINGS_RATE.RECOMMENDED) {
    candidates.push({
      action: {
        action_type: 'negotiate_bills',
        title: 'Negotiate Your Regular Bills',
        description: 'Many service providers will reduce your rate if you just ask.',
        impact: {
          monthly_savings: monthlyExpenses * 0.05,
          time_to_complete: '2-3 hours total',
        },
        effort_level: 'low',
        urgency: 'this_quarter',
        steps: [
          'Call internet/cable provider and ask for promotional rate',
          'Shop insurance quotes and use for negotiation',
          'Check if you qualify for any utility assistance programs',
        ],
        reason_codes: ['CASHFLOW_AT_RISK'],
      },
      score: 30,
    });
  }
  
  return candidates;
}

// =============================================================================
// MAIN ENGINE
// =============================================================================

export function generateNextBestActions(
  profile: UserFinancialProfile,
  maxActions: number = 5
): NextBestActionResponse {
  const metrics = calculateHealthMetrics(profile);
  const { score: healthScore } = calculateHealthScore(metrics);
  const grade = getHealthGrade(healthScore);
  
  const signals = detectAllSignals(profile);
  const criticalSignals = getCriticalSignals(signals);
  const positiveSignals = getPositiveSignals(signals);
  
  const candidates = generateActionCandidates(profile, metrics, signals);
  const sortedCandidates = candidates.sort((a, b) => b.score - a.score).slice(0, maxActions);
  
  const actions: RecommendedAction[] = sortedCandidates.map((c, index) => ({
    action_id: `action_${index + 1}`,
    priority: index + 1,
    ...c.action,
  }));
  
  const totalDebt = profile.debts.reduce((sum, d) => sum + d.balance, 0);
  
  let summary: string;
  if (grade === 'A') {
    summary = 'Your finances are in excellent shape. Focus on optimization and growth.';
  } else if (grade === 'B') {
    summary = 'Your finances are solid with room for improvement. Address the items below to level up.';
  } else if (grade === 'C') {
    summary = 'Your finances need attention. Focus on the top priority items to improve stability.';
  } else if (grade === 'D') {
    summary = 'Your finances are stressed. Take immediate action on the top items below.';
  } else {
    summary = 'Your financial situation is critical. Immediate action is required.';
  }
  
  const strengths = positiveSignals.map((s) => s.title);
  const concerns = criticalSignals.map((s) => s.title);
  
  signals
    .filter((s) => s.severity === 'warning')
    .slice(0, 3)
    .forEach((s) => {
      if (!concerns.includes(s.title)) {
        concerns.push(s.title);
      }
    });
  
  const topAction = actions[0];
  let explanation = `Based on your financial profile (Grade: ${grade}), `;
  if (topAction) {
    explanation += `your top priority should be: ${topAction.title}. `;
    if (actions.length > 1) {
      explanation += `After that, focus on ${actions.slice(1, 3).map((a) => a.title.toLowerCase()).join(' and ')}.`;
    }
  }
  
  const hasCompleteData = profile.monthly_income > 0 && profile.monthly_fixed_expenses > 0;
  const confidence = hasCompleteData ? 0.85 : 0.6;
  
  return {
    actions,
    health_assessment: {
      score: healthScore,
      grade,
      summary,
      strengths: strengths.length > 0 ? strengths : ['Keep building positive financial habits'],
      concerns: concerns.length > 0 ? concerns : ['No critical concerns identified'],
    },
    explanation,
    key_metrics: {
      monthly_cashflow: metrics.monthlyCashflow,
      debt_to_income_ratio: metrics.debtToIncomeRatio,
      emergency_fund_months: metrics.emergencyFundMonths,
      total_debt: totalDebt,
      savings_rate: metrics.savingsRate,
    },
    confidence,
    metadata: {
      request_id: `nba_${Date.now()}`,
      timestamp: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      computation_time_ms: 0,
      ai_explanation_used: false,
    },
  };
}
