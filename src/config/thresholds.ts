/**
 * Obsidian Decision Engine - Financial Thresholds Configuration
 * 
 * All financial thresholds used in decision-making are defined here.
 * No magic numbers in the codebase - everything is configurable and documented.
 * 
 * These values are based on industry standards and financial planning best practices.
 * Override via environment variables for client-specific customization.
 * 
 * @module config/thresholds
 */

// =============================================================================
// EMERGENCY FUND THRESHOLDS
// =============================================================================

export const EMERGENCY_FUND = {
  /** Minimum months of expenses to maintain (standard recommendation) */
  MINIMUM_MONTHS: parseFloat(process.env.MIN_EMERGENCY_FUND_MONTHS ?? '3'),
  
  /** Recommended months for those with variable income */
  VARIABLE_INCOME_MONTHS: 6,
  
  /** Ideal months for complete financial security */
  IDEAL_MONTHS: 6,
  
  /** Critical level - below this is financial emergency */
  CRITICAL_MONTHS: 1,
} as const;

// =============================================================================
// DEBT-TO-INCOME RATIO THRESHOLDS
// =============================================================================

export const DEBT_TO_INCOME = {
  /** Excellent DTI - very manageable debt load */
  EXCELLENT: 0.15,
  
  /** Good DTI - healthy range */
  GOOD: 0.25,
  
  /** Acceptable DTI - manageable but should be monitored */
  ACCEPTABLE: 0.35,
  
  /** High DTI - concerning, debt payoff should be prioritized */
  HIGH: 0.43,
  
  /** Critical DTI - financial stress likely, intervention needed */
  CRITICAL: parseFloat(process.env.CRITICAL_DTI_RATIO ?? '0.5'),
} as const;

// =============================================================================
// CREDIT UTILIZATION THRESHOLDS
// =============================================================================

export const CREDIT_UTILIZATION = {
  /** Excellent utilization - optimal for credit score */
  EXCELLENT: 0.10,
  
  /** Good utilization - healthy range */
  GOOD: 0.30,
  
  /** Acceptable but elevated */
  ELEVATED: 0.50,
  
  /** High - negatively impacts credit score */
  HIGH: 0.70,
  
  /** Critical - severe credit impact */
  CRITICAL: 0.90,
} as const;

// =============================================================================
// INTEREST RATE THRESHOLDS
// =============================================================================

export const INTEREST_RATES = {
  /** Low APR - generally acceptable debt */
  LOW_APR: 7.0,
  
  /** Moderate APR - should consider paying off */
  MODERATE_APR: 12.0,
  
  /** High APR - prioritize payoff */
  HIGH_APR: parseFloat(process.env.HIGH_APR_THRESHOLD ?? '15.0'),
  
  /** Very High APR - urgent payoff needed */
  VERY_HIGH_APR: 20.0,
  
  /** Predatory APR - financial emergency */
  PREDATORY_APR: 30.0,
} as const;

// =============================================================================
// CASHFLOW THRESHOLDS
// =============================================================================

export const CASHFLOW = {
  /** Minimum positive cashflow ratio (income vs expenses) */
  MINIMUM_POSITIVE_RATIO: 1.0,
  
  /** Healthy cashflow ratio */
  HEALTHY_RATIO: 1.2,
  
  /** Excellent cashflow ratio - enables aggressive saving/investing */
  EXCELLENT_RATIO: 1.5,
  
  /** Recommended savings rate (percentage of income) */
  RECOMMENDED_SAVINGS_RATE: 0.20,
  
  /** Minimum savings rate to maintain progress */
  MINIMUM_SAVINGS_RATE: 0.10,
} as const;

// =============================================================================
// AFFORDABILITY THRESHOLDS
// =============================================================================

export const AFFORDABILITY = {
  /** 
   * Maximum percentage of monthly buffer a single purchase should consume
   * Without impacting financial stability
   */
  MAX_BUFFER_CONSUMPTION: 0.25,
  
  /** 
   * Threshold for "small purchase" that doesn't need deep analysis
   * As percentage of monthly income
   */
  SMALL_PURCHASE_THRESHOLD: 0.05,
  
  /** 
   * Large purchase threshold - requires additional scrutiny
   * As percentage of monthly income
   */
  LARGE_PURCHASE_THRESHOLD: 0.25,
  
  /** 
   * Major purchase threshold - significant financial decision
   * As percentage of monthly income
   */
  MAJOR_PURCHASE_THRESHOLD: 0.50,
  
  /**
   * Minimum buffer that must remain after any purchase (in months of expenses)
   */
  MINIMUM_POST_PURCHASE_BUFFER_MONTHS: 1,
} as const;

// =============================================================================
// SAVINGS RATE THRESHOLDS
// =============================================================================

export const SAVINGS_RATE = {
  /** Minimum recommended savings rate */
  MINIMUM: 0.10,
  
  /** Standard recommended savings rate */
  RECOMMENDED: 0.20,
  
  /** Aggressive savings rate for early financial independence */
  AGGRESSIVE: 0.30,
  
  /** Very aggressive - FIRE movement target */
  FIRE: 0.50,
} as const;

// =============================================================================
// FINANCIAL HEALTH SCORE WEIGHTS
// =============================================================================

export const HEALTH_SCORE_WEIGHTS = {
  /** Weight for emergency fund adequacy */
  EMERGENCY_FUND: 0.25,
  
  /** Weight for debt-to-income ratio */
  DEBT_TO_INCOME: 0.25,
  
  /** Weight for positive cashflow */
  CASHFLOW: 0.20,
  
  /** Weight for savings rate */
  SAVINGS_RATE: 0.15,
  
  /** Weight for credit utilization */
  CREDIT_UTILIZATION: 0.15,
} as const;

// =============================================================================
// RISK CATEGORIZATION
// =============================================================================

export const RISK_THRESHOLDS = {
  /** Score below this is CRITICAL risk */
  CRITICAL: 25,
  
  /** Score below this is HIGH risk */
  HIGH: 50,
  
  /** Score below this is MODERATE risk */
  MODERATE: 75,
  
  /** Score above MODERATE is LOW risk */
  LOW: 75,
} as const;

// =============================================================================
// DEBT PAYOFF CONFIGURATION
// =============================================================================

export const DEBT_PAYOFF = {
  /** Default extra payment amount if not specified */
  DEFAULT_EXTRA_PAYMENT: 100,
  
  /** Maximum months to simulate */
  MAX_SIMULATION_MONTHS: 360, // 30 years
  
  /** Minimum payment percentage for credit cards (of balance) */
  MIN_CREDIT_CARD_PAYMENT_PERCENT: 0.02,
  
  /** Fixed minimum payment floor */
  MIN_PAYMENT_FLOOR: 25,
} as const;
