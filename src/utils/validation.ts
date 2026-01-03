/**
 * Obsidian Decision Engine - Validation Utilities
 * 
 * Input validation and sanitization functions.
 * All API inputs pass through these validators.
 * 
 * @module utils/validation
 */

import { z, ZodError, ZodSchema } from 'zod';
import { INPUT_LIMITS } from '../config/limits.js';
import type { UserFinancialProfile, PurchaseRequest } from '../models/types.js';

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// =============================================================================
// CORE VALIDATION FUNCTION
// =============================================================================

/**
 * Validate data against a Zod schema.
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      };
    }
    throw error;
  }
}

/**
 * Validate data and throw if invalid.
 */
export function validateOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorMessage: string = 'Validation failed'
): T {
  const result = validate(schema, data);
  
  if (!result.success) {
    const error = new Error(errorMessage);
    (error as Error & { validationErrors: ValidationError[] }).validationErrors = result.errors;
    throw error;
  }
  
  return result.data;
}

// =============================================================================
// SANITIZATION FUNCTIONS
// =============================================================================

/**
 * Sanitize a monetary amount.
 * - Ensures non-negative
 * - Rounds to 2 decimal places
 * - Caps at maximum allowed
 */
export function sanitizeMoney(
  amount: number,
  maxAmount: number = INPUT_LIMITS.MAX_PURCHASE_AMOUNT
): number {
  if (!Number.isFinite(amount)) return 0;
  const sanitized = Math.max(0, amount);
  const capped = Math.min(sanitized, maxAmount);
  return Math.round(capped * 100) / 100;
}

/**
 * Sanitize a percentage value.
 * - Ensures between 0 and 100
 * - Rounds to 2 decimal places
 */
export function sanitizePercentage(percentage: number): number {
  if (!Number.isFinite(percentage)) return 0;
  const sanitized = Math.max(0, Math.min(100, percentage));
  return Math.round(sanitized * 100) / 100;
}

/**
 * Sanitize a string input.
 * - Trims whitespace
 * - Removes control characters
 * - Truncates to max length
 */
export function sanitizeString(
  str: string,
  maxLength: number = INPUT_LIMITS.MAX_DESCRIPTION_LENGTH
): string {
  if (typeof str !== 'string') return '';
  
  // Remove control characters except newlines and tabs
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim and truncate
  return cleaned.trim().slice(0, maxLength);
}

// =============================================================================
// SPECIFIC VALIDATORS
// =============================================================================

/**
 * Check if a value is a valid APR.
 */
export function isValidAPR(apr: unknown): apr is number {
  return (
    typeof apr === 'number' &&
    Number.isFinite(apr) &&
    apr >= 0 &&
    apr <= 100
  );
}

/**
 * Check if a value is a valid credit score.
 */
export function isValidCreditScore(score: unknown): score is number {
  return (
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 300 &&
    score <= 850
  );
}

/**
 * Check if a value is a valid confidence score.
 */
export function isValidConfidence(confidence: unknown): confidence is number {
  return (
    typeof confidence === 'number' &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1
  );
}

/**
 * Check if an email is valid.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =============================================================================
// ARRAY VALIDATORS
// =============================================================================

/**
 * Ensure an array doesn't exceed max length.
 */
export function limitArray<T>(array: T[], maxLength: number): T[] {
  return array.slice(0, maxLength);
}

/**
 * Remove duplicates from an array based on a key.
 */
export function deduplicateBy<T>(
  array: T[],
  keyFn: (item: T) => string
): T[] {
  const seen = new Set<string>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// BUSINESS RULE VALIDATORS
// =============================================================================

/**
 * Validate that income is sufficient for expenses.
 */
export function validateIncomeCoversExpenses(
  monthlyIncome: number,
  monthlyExpenses: number
): boolean {
  return monthlyIncome >= monthlyExpenses;
}

/**
 * Validate debt account consistency.
 * - Minimum payment shouldn't exceed balance
 * - Credit limit shouldn't be less than balance (for revolving credit)
 */
export function validateDebtAccount(debt: {
  balance: number;
  minimum_payment?: number;
  credit_limit?: number;
  type: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (debt.minimum_payment && debt.minimum_payment > debt.balance) {
    errors.push({
      field: 'minimum_payment',
      message: 'Minimum payment cannot exceed balance',
      code: 'invalid_minimum_payment',
    });
  }
  
  if (
    debt.type === 'credit_card' &&
    debt.credit_limit &&
    debt.credit_limit < debt.balance
  ) {
    errors.push({
      field: 'credit_limit',
      message: 'Credit limit cannot be less than balance',
      code: 'invalid_credit_limit',
    });
  }
  
  return errors;
}

// =============================================================================
// COMPOSITE VALIDATORS
// =============================================================================

/**
 * Validate a complete financial profile has internally consistent data.
 */
export function validateProfileConsistency(profile: {
  monthly_income: number;
  monthly_fixed_expenses: number;
  cash_balance: number;
  debts: Array<{
    balance: number;
    minimum_payment?: number;
    credit_limit?: number;
    type: string;
  }>;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Validate each debt account
  profile.debts.forEach((debt, index) => {
    const debtErrors = validateDebtAccount(debt);
    debtErrors.forEach((err) => {
      errors.push({
        ...err,
        field: `debts[${index}].${err.field}`,
      });
    });
  });
  
  // Check for unrealistic scenarios (optional warnings)
  const totalMinPayments = profile.debts.reduce(
    (sum, d) => sum + (d.minimum_payment ?? 0),
    0
  );
  
  const availableForDebt = profile.monthly_income - profile.monthly_fixed_expenses;
  
  if (totalMinPayments > availableForDebt && availableForDebt > 0) {
    errors.push({
      field: 'debts',
      message: 'Total minimum payments exceed available income after expenses',
      code: 'insufficient_income_for_debt',
    });
  }
  
  return errors;
}

// =============================================================================
// LIMIT CHECKS
// =============================================================================

/**
 * Validate high-level input limits for a financial profile to avoid runaway payloads.
 */
export function validateProfileLimits(profile: UserFinancialProfile): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (profile.debts.length > INPUT_LIMITS.MAX_DEBT_ACCOUNTS) {
    errors.push({
      field: 'debts',
      message: `Too many debt accounts (max ${INPUT_LIMITS.MAX_DEBT_ACCOUNTS})`,
      code: 'too_many_debts',
    });
  }
  
  if (profile.monthly_income > INPUT_LIMITS.MAX_ANNUAL_INCOME / 12) {
    errors.push({
      field: 'monthly_income',
      message: `Monthly income exceeds allowed maximum (${INPUT_LIMITS.MAX_ANNUAL_INCOME / 12})`,
      code: 'income_out_of_bounds',
    });
  }
  
  if (profile.debts.some((d) => d.balance > INPUT_LIMITS.MAX_DEBT_BALANCE)) {
    errors.push({
      field: 'debts.balance',
      message: `One or more debts exceed maximum balance (${INPUT_LIMITS.MAX_DEBT_BALANCE})`,
      code: 'debt_balance_out_of_bounds',
    });
  }
  
  return errors;
}

/**
 * Validate purchase limits to guard against unreasonable payloads.
 */
export function validatePurchaseLimits(purchase: PurchaseRequest): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (purchase.amount > INPUT_LIMITS.MAX_PURCHASE_AMOUNT) {
    errors.push({
      field: 'purchase.amount',
      message: `Purchase amount exceeds maximum (${INPUT_LIMITS.MAX_PURCHASE_AMOUNT})`,
      code: 'purchase_amount_out_of_bounds',
    });
  }
  
  if (purchase.description && purchase.description.length > INPUT_LIMITS.MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'purchase.description',
      message: `Description exceeds maximum length (${INPUT_LIMITS.MAX_DESCRIPTION_LENGTH})`,
      code: 'description_too_long',
    });
  }
  
  return errors;
}
