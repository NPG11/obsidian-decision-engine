/**
 * Obsidian Decision Engine - Decision Response Types
 * 
 * These types define the structure of all responses from the decision engine.
 * Every response includes deterministic results, confidence scores, and
 * human-readable explanations.
 * 
 * @module models/DecisionResponse
 */

import { z } from 'zod';

// =============================================================================
// DECISION OUTCOMES
// =============================================================================

/**
 * Primary decision outcome for binary/ternary decisions.
 */
export const DecisionOutcomeSchema = z.enum([
  'YES',           // Recommended to proceed
  'NO',            // Not recommended to proceed
  'CONDITIONAL',   // Can proceed with conditions/modifications
  'DEFER',         // Recommend waiting/delaying
  'INSUFFICIENT_DATA' // Cannot make determination
]);

export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

/**
 * Severity levels for risk assessments.
 */
export const RiskLevelSchema = z.enum([
  'LOW',
  'MODERATE',
  'HIGH',
  'CRITICAL'
]);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// =============================================================================
// REASON CODES
// =============================================================================

/**
 * Standardized reason codes for decisions.
 * These enable programmatic handling by client applications.
 */
export const ReasonCodeSchema = z.enum([
  // Cash flow related
  'POSITIVE_CASHFLOW',
  'NEGATIVE_CASHFLOW',
  'CASHFLOW_AT_RISK',
  'INSUFFICIENT_BUFFER',
  'HEALTHY_BUFFER',
  
  // Debt related
  'HIGH_DEBT_TO_INCOME',
  'ACCEPTABLE_DEBT_TO_INCOME',
  'HIGH_CREDIT_UTILIZATION',
  'LOW_CREDIT_UTILIZATION',
  'HIGH_INTEREST_DEBT',
  'DEBT_FREE',
  
  // Savings related
  'EMERGENCY_FUND_INADEQUATE',
  'EMERGENCY_FUND_ADEQUATE',
  'SAVINGS_DEPLETED',
  'SAVINGS_HEALTHY',
  
  // Purchase specific
  'AFFORDABLE_PURCHASE',
  'UNAFFORDABLE_PURCHASE',
  'PURCHASE_STRAINS_BUDGET',
  'LUXURY_WHILE_IN_DEBT',
  'FINANCING_RECOMMENDED',
  'CASH_PURCHASE_OK',
  
  // Income related
  'STABLE_INCOME',
  'VARIABLE_INCOME_RISK',
  'INCOME_INSUFFICIENT',
  
  // Behavioral patterns
  'OVERSPENDING_PATTERN',
  'RESPONSIBLE_SPENDING',
  'IMPULSE_PURCHASE_RISK',
  
  // General
  'CALCULATION_COMPLETE',
  'PARTIAL_DATA',
  'DATA_QUALITY_ISSUE',
  'RULE_OVERRIDE_APPLIED'
]);

export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

// =============================================================================
// CONFIDENCE & METADATA
// =============================================================================

/**
 * Confidence score with breakdown of contributing factors.
 */
export const ConfidenceScoreSchema = z.object({
  /** Overall confidence in the decision (0.0 to 1.0) */
  overall: z.number().min(0).max(1),
  
  /** Confidence breakdown by factor */
  factors: z.object({
    data_quality: z.number().min(0).max(1),
    rule_clarity: z.number().min(0).max(1),
    historical_accuracy: z.number().min(0).max(1).optional(),
  }).optional(),
  
  /** Factors that lowered confidence */
  uncertainty_reasons: z.array(z.string()).optional(),
});

export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;

/**
 * Metadata about the decision process.
 */
export const DecisionMetadataSchema = z.object({
  /** Unique ID for this decision request */
  request_id: z.string(),
  
  /** Timestamp of when decision was made (ISO 8601) */
  timestamp: z.string().datetime(),
  
  /** Engine version that made this decision */
  engine_version: z.string(),
  
  /** Optional idempotency key used for this request */
  idempotency_key: z.string().nullable().optional(),
  
  /** Time taken to compute decision in milliseconds */
  computation_time_ms: z.number().nonnegative(),
  
  /** Whether AI was used for explanation synthesis */
  ai_explanation_used: z.boolean(),
  
  /** Rules that were evaluated */
  rules_evaluated: z.array(z.string()).optional(),
  
  /** Debug information (only in development mode) */
  debug: z.record(z.unknown()).optional(),
});

export type DecisionMetadata = z.infer<typeof DecisionMetadataSchema>;

// =============================================================================
// AFFORDABILITY DECISION RESPONSE
// =============================================================================

/**
 * Response from the affordability decision endpoint.
 */
export const AffordabilityDecisionSchema = z.object({
  /** Primary decision outcome */
  decision: DecisionOutcomeSchema,
  
  /** Confidence in this decision */
  confidence: z.number().min(0).max(1),
  
  /** Detailed confidence breakdown */
  confidence_details: ConfidenceScoreSchema.optional(),
  
  /** Machine-readable reason codes */
  reason_codes: z.array(ReasonCodeSchema),
  
  /** Human-readable explanation */
  explanation: z.string(),
  
  /** Detailed explanation breakdown */
  explanation_details: z.object({
    summary: z.string(),
    key_factors: z.array(z.string()),
    risks: z.array(z.string()),
    opportunities: z.array(z.string()).optional(),
  }).optional(),
  
  /** Risk level assessment */
  risk_level: RiskLevelSchema,
  
  /** Recommended alternative plan if decision is not YES */
  recommended_plan: z.array(z.string()).optional(),
  
  /** Financial impact projections */
  impact_analysis: z.object({
    /** Cash balance after purchase */
    projected_cash_balance: z.number(),
    
    /** Months of expenses remaining as buffer */
    months_of_buffer_remaining: z.number(),
    
    /** New monthly cashflow after purchase (if recurring) */
    new_monthly_cashflow: z.number().optional(),
    
    /** New debt-to-income ratio (if using credit) */
    new_debt_to_income: z.number().optional(),
    
    /** Credit utilization change (if using credit card) */
    credit_utilization_change: z.number().optional(),
  }),
  
  /** Alternative purchase strategies */
  alternatives: z.array(z.object({
    strategy: z.string(),
    description: z.string(),
    savings: z.number().optional(),
    timeline: z.string().optional(),
  })).optional(),
  
  /** Request metadata */
  metadata: DecisionMetadataSchema,
});

export type AffordabilityDecision = z.infer<typeof AffordabilityDecisionSchema>;

// =============================================================================
// DEBT PAYOFF PLAN RESPONSE
// =============================================================================

/**
 * A single month in a debt payoff simulation.
 */
export const DebtPayoffMonthSchema = z.object({
  month: z.number().int().positive(),
  date: z.string(),
  payments: z.array(z.object({
    debt_id: z.string(),
    debt_name: z.string(),
    payment_amount: z.number(),
    principal_paid: z.number(),
    interest_paid: z.number(),
    remaining_balance: z.number(),
  })),
  total_payment: z.number(),
  total_remaining_debt: z.number(),
  debts_paid_off_this_month: z.array(z.string()),
});

export type DebtPayoffMonth = z.infer<typeof DebtPayoffMonthSchema>;

/**
 * Summary of a debt payoff strategy.
 */
export const DebtStrategySummarySchema = z.object({
  strategy_name: z.enum(['avalanche', 'snowball', 'hybrid', 'minimum_only']),
  total_months_to_payoff: z.number().int(),
  total_interest_paid: z.number(),
  total_amount_paid: z.number(),
  monthly_payment_required: z.number(),
  payoff_order: z.array(z.object({
    debt_id: z.string(),
    debt_name: z.string(),
    months_to_payoff: z.number().int(),
    interest_paid: z.number(),
  })),
});

export type DebtStrategySummary = z.infer<typeof DebtStrategySummarySchema>;

/**
 * Complete debt payoff plan response.
 */
export const DebtPayoffPlanSchema = z.object({
  /** Recommended strategy */
  recommended_strategy: z.enum(['avalanche', 'snowball', 'hybrid']),
  
  /** Why this strategy is recommended */
  recommendation_reason: z.string(),
  
  /** Summary comparison of all strategies */
  strategy_comparison: z.array(DebtStrategySummarySchema),
  
  /** Detailed month-by-month plan for recommended strategy */
  monthly_schedule: z.array(DebtPayoffMonthSchema),
  
  /** Key metrics and insights */
  insights: z.object({
    potential_interest_savings: z.number(),
    debt_free_date: z.string(),
    highest_interest_debt: z.string(),
    quick_wins: z.array(z.string()),
  }),
  
  /** Human-readable explanation */
  explanation: z.string(),
  
  /** Risk assessment for this plan */
  risk_level: RiskLevelSchema,
  
  /** Confidence in plan feasibility */
  confidence: z.number().min(0).max(1),
  
  /** Request metadata */
  metadata: DecisionMetadataSchema,
});

export type DebtPayoffPlan = z.infer<typeof DebtPayoffPlanSchema>;

// =============================================================================
// NEXT BEST ACTION RESPONSE
// =============================================================================

/**
 * A single recommended action.
 */
export const RecommendedActionSchema = z.object({
  /** Unique identifier for this action */
  action_id: z.string(),
  
  /** Priority rank (1 = highest priority) */
  priority: z.number().int().positive(),
  
  /** Type of action */
  action_type: z.enum([
    'pay_debt',
    'build_emergency_fund',
    'reduce_expense',
    'increase_income',
    'delay_purchase',
    'refinance_debt',
    'automate_savings',
    'review_subscriptions',
    'negotiate_bills',
    'seek_assistance',
    'maintain_course',
    'celebrate_milestone'
  ]),
  
  /** Short action title */
  title: z.string(),
  
  /** Detailed description of what to do */
  description: z.string(),
  
  /** Expected financial impact */
  impact: z.object({
    monthly_savings: z.number().optional(),
    total_savings: z.number().optional(),
    time_to_complete: z.string().optional(),
    risk_reduction: z.string().optional(),
  }),
  
  /** Effort required */
  effort_level: z.enum(['low', 'medium', 'high']),
  
  /** Urgency of this action */
  urgency: z.enum(['immediate', 'this_week', 'this_month', 'this_quarter', 'when_possible']),
  
  /** Specific steps to take */
  steps: z.array(z.string()).optional(),
  
  /** Reason codes supporting this recommendation */
  reason_codes: z.array(ReasonCodeSchema),
});

export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;

/**
 * Next best action response.
 */
export const NextBestActionResponseSchema = z.object({
  /** Prioritized list of recommended actions */
  actions: z.array(RecommendedActionSchema),
  
  /** Overall financial health assessment */
  health_assessment: z.object({
    score: z.number().min(0).max(100),
    grade: z.enum(['A', 'B', 'C', 'D', 'F']),
    summary: z.string(),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
  }),
  
  /** Human-readable explanation of priorities */
  explanation: z.string(),
  
  /** Key metrics driving recommendations */
  key_metrics: z.object({
    monthly_cashflow: z.number(),
    debt_to_income_ratio: z.number(),
    emergency_fund_months: z.number(),
    total_debt: z.number(),
    savings_rate: z.number(),
  }),
  
  /** Confidence in recommendations */
  confidence: z.number().min(0).max(1),
  
  /** Request metadata */
  metadata: DecisionMetadataSchema,
});

export type NextBestActionResponse = z.infer<typeof NextBestActionResponseSchema>;

// =============================================================================
// ERROR RESPONSE
// =============================================================================

/**
 * Standardized error response.
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    request_id: z.string(),
    timestamp: z.string().datetime(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
