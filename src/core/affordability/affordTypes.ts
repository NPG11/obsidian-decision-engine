/**
 * Obsidian Decision Engine - Affordability Types
 * 
 * Type definitions specific to affordability calculations.
 * 
 * @module core/affordability/affordTypes
 */

import { z } from 'zod';
import {
  UserFinancialProfileSchema,
  PurchaseRequestSchema,
} from '../../models/types.js';
import { ReasonCode, RiskLevel, DecisionOutcome } from '../../models/DecisionResponse.js';

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Input schema for affordability check.
 */
export const AffordabilityRequestSchema = z.object({
  /** User's financial profile */
  user: UserFinancialProfileSchema,
  
  /** The purchase to evaluate */
  purchase: PurchaseRequestSchema,
  
  /** Optional: Override confidence threshold */
  confidence_threshold: z.number().min(0).max(1).optional(),
  
  /** Optional: Include detailed simulation */
  include_simulation: z.boolean().optional(),
  
  /** Optional: Include AI explanation */
  include_ai_explanation: z.boolean().default(true),
});

export type AffordabilityRequest = z.infer<typeof AffordabilityRequestSchema>;

// =============================================================================
// INTERNAL CALCULATION TYPES
// =============================================================================

/**
 * Calculated financial metrics for affordability decision.
 */
export interface AffordabilityMetrics {
  /** Monthly income after taxes */
  monthlyIncome: number;
  
  /** Total monthly fixed expenses */
  monthlyExpenses: number;
  
  /** Monthly debt payments (minimums) */
  monthlyDebtPayments: number;
  
  /** Net monthly cashflow (income - expenses - debt payments) */
  monthlyCashflow: number;
  
  /** Current liquid assets (cash + savings) */
  liquidAssets: number;
  
  /** Total debt balance */
  totalDebt: number;
  
  /** Debt-to-income ratio */
  debtToIncomeRatio: number;
  
  /** Credit utilization (for revolving credit) */
  creditUtilization: number;
  
  /** Months of expenses covered by liquid assets */
  emergencyFundMonths: number;
  
  /** Savings rate as decimal */
  savingsRate: number;
}

/**
 * Purchase impact analysis.
 */
export interface PurchaseImpact {
  /** Cash balance after purchase */
  projectedCashBalance: number;
  
  /** Months of buffer remaining after purchase */
  monthsOfBufferRemaining: number;
  
  /** New monthly cashflow (if recurring/financing) */
  newMonthlyCashflow: number | null;
  
  /** New debt-to-income ratio (if using credit) */
  newDebtToIncomeRatio: number | null;
  
  /** Change in credit utilization */
  creditUtilizationChange: number | null;
  
  /** Percentage of buffer consumed */
  bufferConsumptionPercent: number;
  
  /** Purchase as percentage of monthly income */
  purchaseToIncomeRatio: number;
}

/**
 * Result of rule evaluation.
 */
export interface RuleResult {
  /** Rule identifier */
  ruleId: string;
  
  /** Whether the rule passed */
  passed: boolean;
  
  /** Reason codes from this rule */
  reasonCodes: ReasonCode[];
  
  /** Weight of this rule in final decision */
  weight: number;
  
  /** Human-readable explanation */
  explanation: string;
  
  /** Data used in evaluation */
  data?: Record<string, unknown>;
}

/**
 * Aggregated rule evaluation results.
 */
export interface RuleEvaluationResult {
  /** All rules evaluated */
  rules: RuleResult[];
  
  /** Aggregated pass count */
  passCount: number;
  
  /** Aggregated fail count */
  failCount: number;
  
  /** Weighted score (0-1) */
  weightedScore: number;
  
  /** All reason codes */
  allReasonCodes: ReasonCode[];
  
  /** Suggested decision based on rules */
  suggestedDecision: DecisionOutcome;
  
  /** Suggested risk level */
  suggestedRiskLevel: RiskLevel;
}

/**
 * Complete affordability calculation result (pre-AI synthesis).
 */
export interface AffordabilityCalculation {
  /** Input metrics */
  metrics: AffordabilityMetrics;
  
  /** Purchase impact analysis */
  impact: PurchaseImpact;
  
  /** Rule evaluation results */
  ruleEvaluation: RuleEvaluationResult;
  
  /** Final decision */
  decision: DecisionOutcome;
  
  /** Confidence score */
  confidence: number;
  
  /** Risk level */
  riskLevel: RiskLevel;
  
  /** Reason codes */
  reasonCodes: ReasonCode[];
  
  /** Recommended actions (if decision is not YES) */
  recommendations: string[];
  
  /** Alternative strategies */
  alternatives: Array<{
    strategy: string;
    description: string;
    savings?: number;
    timeline?: string;
  }>;
}
