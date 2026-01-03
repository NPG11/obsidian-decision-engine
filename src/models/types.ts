/**
 * Obsidian Decision Engine - Core Financial Types
 * 
 * These types form the foundation of all financial calculations.
 * All monetary values are represented as numbers in cents to avoid
 * floating-point precision issues. The Decimal library is used for
 * all calculations.
 * 
 * @module models/types
 */

import { z } from 'zod';

// =============================================================================
// CURRENCY & MONEY TYPES
// =============================================================================

/**
 * Represents a monetary amount in the smallest currency unit (cents for USD).
 * All internal calculations use cents to avoid floating-point errors.
 */
export type CentsAmount = number;

/**
 * Represents a monetary amount in dollars (for API input/output).
 * Converted to cents internally for all calculations.
 */
export type DollarAmount = number;

/**
 * Currency codes supported by the engine.
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

// =============================================================================
// DEBT TYPES
// =============================================================================

/**
 * Types of debt accounts recognized by the engine.
 */
export const DebtTypeSchema = z.enum([
  'credit_card',
  'personal_loan',
  'auto_loan',
  'student_loan',
  'mortgage',
  'medical_debt',
  'payday_loan',
  'buy_now_pay_later',
  'other'
]);

export type DebtType = z.infer<typeof DebtTypeSchema>;

/**
 * A single debt account with all relevant details for calculations.
 */
export const DebtAccountSchema = z.object({
  /** Unique identifier for this debt */
  id: z.string().optional(),
  
  /** Type of debt - affects prioritization strategies */
  type: DebtTypeSchema,
  
  /** Current outstanding balance in dollars */
  balance: z.number().nonnegative(),
  
  /** Annual Percentage Rate as a percentage (e.g., 24.99 for 24.99%) */
  apr: z.number().min(0).max(100),
  
  /** Minimum monthly payment in dollars */
  minimum_payment: z.number().nonnegative().optional(),
  
  /** Credit limit (for revolving credit like credit cards) */
  credit_limit: z.number().nonnegative().optional(),
  
  /** Name/label for this debt (e.g., "Chase Sapphire") */
  name: z.string().optional(),
  
  /** Whether this is a promotional/intro APR that will change */
  is_promotional_rate: z.boolean().optional(),
  
  /** Date when promotional rate expires (ISO 8601) */
  promotional_rate_expires: z.string().datetime().optional(),
  
  /** APR after promotional period ends */
  post_promotional_apr: z.number().min(0).max(100).optional(),
});

export type DebtAccount = z.infer<typeof DebtAccountSchema>;

// =============================================================================
// INCOME & EXPENSE TYPES
// =============================================================================

/**
 * Frequency of recurring income or expenses.
 */
export const FrequencySchema = z.enum([
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'annually',
  'one_time'
]);

export type Frequency = z.infer<typeof FrequencySchema>;

/**
 * Categories for income sources.
 */
export const IncomeTypeSchema = z.enum([
  'salary',
  'hourly_wages',
  'self_employment',
  'freelance',
  'rental_income',
  'investment_income',
  'social_security',
  'pension',
  'disability',
  'child_support',
  'alimony',
  'side_hustle',
  'bonus',
  'other'
]);

export type IncomeType = z.infer<typeof IncomeTypeSchema>;

/**
 * Categories for expenses.
 */
export const ExpenseCategorySchema = z.enum([
  'housing',
  'utilities',
  'transportation',
  'insurance',
  'food_groceries',
  'food_dining',
  'healthcare',
  'childcare',
  'education',
  'entertainment',
  'subscriptions',
  'personal_care',
  'clothing',
  'debt_payments',
  'savings',
  'investments',
  'gifts_donations',
  'taxes',
  'other'
]);

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

/**
 * A recurring income source.
 */
export const IncomeSourceSchema = z.object({
  type: IncomeTypeSchema,
  amount: z.number().nonnegative(),
  frequency: FrequencySchema,
  is_variable: z.boolean().optional(),
  description: z.string().optional(),
});

export type IncomeSource = z.infer<typeof IncomeSourceSchema>;

/**
 * A recurring expense.
 */
export const ExpenseSchema = z.object({
  category: ExpenseCategorySchema,
  amount: z.number().nonnegative(),
  frequency: FrequencySchema,
  is_fixed: z.boolean().optional(),
  is_essential: z.boolean().optional(),
  description: z.string().optional(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

// =============================================================================
// USER FINANCIAL PROFILE
// =============================================================================

/**
 * Complete financial profile of a user for decision-making.
 * This is the primary input to most decision endpoints.
 */
export const UserFinancialProfileSchema = z.object({
  /** Unique user identifier from the client system */
  user_id: z.string().optional(),
  
  /** Primary monthly income (simplified input) */
  monthly_income: z.number().nonnegative(),
  
  /** Detailed income sources (optional, for advanced analysis) */
  income_sources: z.array(IncomeSourceSchema).optional(),
  
  /** Total monthly fixed expenses */
  monthly_fixed_expenses: z.number().nonnegative(),
  
  /** Detailed expenses breakdown (optional, for advanced analysis) */
  expenses: z.array(ExpenseSchema).optional(),
  
  /** Current cash/checking account balance */
  cash_balance: z.number().nonnegative(),
  
  /** Current savings account balance */
  savings_balance: z.number().nonnegative().optional(),
  
  /** Emergency fund balance (if separate from savings) */
  emergency_fund: z.number().nonnegative().optional(),
  
  /** All debt accounts */
  debts: z.array(DebtAccountSchema).default([]),
  
  /** Investment account balances (401k, IRA, brokerage, etc.) */
  investment_balance: z.number().nonnegative().optional(),
  
  /** Credit score (FICO or VantageScore) */
  credit_score: z.number().int().min(300).max(850).optional(),
  
  /** Number of financial dependents */
  dependents: z.number().int().nonnegative().optional(),
  
  /** Employment status */
  employment_status: z.enum([
    'employed_full_time',
    'employed_part_time',
    'self_employed',
    'unemployed',
    'retired',
    'student'
  ]).optional(),
  
  /** Geographic location for cost-of-living adjustments */
  location: z.object({
    state: z.string().optional(),
    zip_code: z.string().optional(),
    cost_of_living_index: z.number().optional(),
  }).optional(),
  
  /** Custom metadata from client system */
  metadata: z.record(z.unknown()).optional(),
});

export type UserFinancialProfile = z.infer<typeof UserFinancialProfileSchema>;

// =============================================================================
// PURCHASE / TRANSACTION TYPES
// =============================================================================

/**
 * Categories of purchases for risk assessment.
 */
export const PurchaseCategorySchema = z.enum([
  'essential_needs',
  'housing',
  'transportation',
  'healthcare',
  'education',
  'electronics',
  'appliances',
  'furniture',
  'clothing',
  'entertainment',
  'travel',
  'dining',
  'luxury',
  'investment',
  'emergency',
  'gift',
  'subscription',
  'other'
]);

export type PurchaseCategory = z.infer<typeof PurchaseCategorySchema>;

/**
 * Payment methods available.
 */
export const PaymentMethodSchema = z.enum([
  'cash',
  'debit',
  'credit_card',
  'buy_now_pay_later',
  'financing',
  'savings',
  'mixed'
]);

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * A proposed purchase to evaluate.
 */
export const PurchaseRequestSchema = z.object({
  /** Amount of the purchase in dollars */
  amount: z.number().positive(),
  
  /** Category of the purchase */
  category: PurchaseCategorySchema,
  
  /** Intended payment method */
  payment_method: PaymentMethodSchema,
  
  /** Description of what's being purchased */
  description: z.string().optional(),
  
  /** Is this purchase time-sensitive? */
  is_urgent: z.boolean().optional(),
  
  /** Is this a recurring purchase? */
  is_recurring: z.boolean().optional(),
  
  /** If recurring, what frequency? */
  recurring_frequency: FrequencySchema.optional(),
  
  /** If financing, what are the terms? */
  financing_terms: z.object({
    apr: z.number().min(0).max(100),
    term_months: z.number().int().positive(),
    down_payment: z.number().nonnegative().optional(),
  }).optional(),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;

// =============================================================================
// TRANSACTION HISTORY (for pattern analysis)
// =============================================================================

/**
 * A historical transaction for behavioral analysis.
 */
export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  amount: z.number(),
  category: ExpenseCategorySchema,
  merchant: z.string().optional(),
  is_recurring: z.boolean().optional(),
  account_id: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// =============================================================================
// FINANCIAL GOALS
// =============================================================================

/**
 * Types of financial goals.
 */
export const GoalTypeSchema = z.enum([
  'emergency_fund',
  'debt_payoff',
  'save_for_purchase',
  'retirement',
  'investment',
  'education',
  'home_purchase',
  'travel',
  'wedding',
  'other'
]);

export type GoalType = z.infer<typeof GoalTypeSchema>;

/**
 * A financial goal with target and timeline.
 */
export const FinancialGoalSchema = z.object({
  type: GoalTypeSchema,
  target_amount: z.number().positive(),
  current_amount: z.number().nonnegative().default(0),
  target_date: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  description: z.string().optional(),
});

export type FinancialGoal = z.infer<typeof FinancialGoalSchema>;
