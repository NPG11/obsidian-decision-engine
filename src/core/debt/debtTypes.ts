/**
 * Obsidian Decision Engine - Debt Types
 * 
 * Type definitions for debt payoff simulation and planning.
 * 
 * @module core/debt/debtTypes
 */

import { z } from 'zod';
import { UserFinancialProfileSchema, DebtAccountSchema } from '../../models/types.js';

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Debt payoff strategy options.
 */
export const DebtStrategySchema = z.enum([
  'avalanche',    // Pay highest APR first (mathematically optimal)
  'snowball',     // Pay smallest balance first (psychological wins)
  'hybrid',       // Balance between avalanche and snowball
  'minimum_only', // Just pay minimums (baseline comparison)
]);

export type DebtStrategy = z.infer<typeof DebtStrategySchema>;

/**
 * Request for debt payoff simulation.
 */
export const DebtPayoffRequestSchema = z.object({
  /** User's financial profile */
  user: UserFinancialProfileSchema,
  
  /** Additional monthly amount available for debt payoff */
  extra_monthly_payment: z.number().nonnegative().optional(),
  
  /** Specific strategy to simulate (if not provided, all are compared) */
  strategy: DebtStrategySchema.optional(),
  
  /** Include full month-by-month schedule */
  include_schedule: z.boolean().default(true),
  
  /** Maximum months to simulate */
  max_months: z.number().int().positive().default(360),
  
  /** Include AI explanation */
  include_ai_explanation: z.boolean().default(true),
});

export type DebtPayoffRequest = z.infer<typeof DebtPayoffRequestSchema>;

// =============================================================================
// SIMULATION TYPES
// =============================================================================

/**
 * State of a single debt at a point in time.
 */
export interface DebtState {
  id: string;
  name: string;
  type: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  creditLimit?: number;
  isPaidOff: boolean;
}

/**
 * A single payment made to a debt in a month.
 */
export interface DebtPayment {
  debtId: string;
  debtName: string;
  paymentAmount: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

/**
 * State after simulating one month.
 */
export interface MonthlySimulationState {
  month: number;
  date: string;
  debts: DebtState[];
  payments: DebtPayment[];
  totalPayment: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalRemainingDebt: number;
  debtsPaidOffThisMonth: string[];
  extraPaymentApplied: number;
}

/**
 * Complete result of a strategy simulation.
 */
export interface StrategySimulationResult {
  strategy: DebtStrategy;
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  monthlyPaymentRequired: number;
  schedule: MonthlySimulationState[];
  payoffOrder: Array<{
    debtId: string;
    debtName: string;
    monthsToPayoff: number;
    interestPaid: number;
    originalBalance: number;
  }>;
}

/**
 * Comparison of multiple strategies.
 */
export interface StrategyComparison {
  strategies: StrategySimulationResult[];
  recommendedStrategy: DebtStrategy;
  recommendationReason: string;
  savingsVsMinimum: number;
  savingsVsWorst: number;
  timeSavedMonths: number;
}

/**
 * Insights derived from debt analysis.
 */
export interface DebtInsights {
  totalDebt: number;
  averageAPR: number;
  highestAPRDebt: {
    id: string;
    name: string;
    apr: number;
    balance: number;
  } | null;
  lowestBalanceDebt: {
    id: string;
    name: string;
    balance: number;
  } | null;
  quickWins: string[];
  potentialInterestSavings: number;
  debtFreeDate: string;
  monthlyMinimumRequired: number;
}
