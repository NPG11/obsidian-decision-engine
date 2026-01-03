/**
 * Obsidian Decision Engine - Money Utilities
 * 
 * All monetary calculations use the Decimal library to avoid
 * floating-point precision errors. This module provides safe
 * arithmetic and conversion functions.
 * 
 * CRITICAL: Never use native JavaScript arithmetic for money.
 * Always use these functions.
 * 
 * @module utils/money
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents money as a Decimal for safe arithmetic.
 */
export type Money = Decimal;

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert dollars to cents (integer).
 * Use this for storage or when integer representation is needed.
 */
export function dollarsToCents(dollars: number): number {
  return new Decimal(dollars).times(100).round().toNumber();
}

/**
 * Convert cents to dollars.
 */
export function centsToDollars(cents: number): number {
  return new Decimal(cents).dividedBy(100).toNumber();
}

/**
 * Create a Money value from a dollar amount.
 */
export function money(dollars: number): Money {
  return new Decimal(dollars);
}

/**
 * Convert Money to a display-friendly dollar amount (2 decimal places).
 */
export function toDisplayDollars(amount: Money): number {
  return amount.toDecimalPlaces(2).toNumber();
}

// =============================================================================
// ARITHMETIC FUNCTIONS
// =============================================================================

/**
 * Add multiple money amounts.
 */
export function add(...amounts: (Money | number)[]): Money {
  return amounts.reduce<Money>(
    (sum, amount) => sum.plus(amount instanceof Decimal ? amount : money(amount)),
    money(0)
  );
}

/**
 * Subtract money amounts (first - rest).
 */
export function subtract(from: Money | number, ...amounts: (Money | number)[]): Money {
  const fromMoney = from instanceof Decimal ? from : money(from);
  return amounts.reduce<Money>(
    (result, amount) => result.minus(amount instanceof Decimal ? amount : money(amount)),
    fromMoney
  );
}

/**
 * Multiply money by a factor.
 */
export function multiply(amount: Money | number, factor: number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.times(factor);
}

/**
 * Divide money by a divisor.
 */
export function divide(amount: Money | number, divisor: number): Money {
  if (divisor === 0) {
    throw new Error('Cannot divide by zero');
  }
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.dividedBy(divisor);
}

// =============================================================================
// PERCENTAGE FUNCTIONS
// =============================================================================

/**
 * Calculate percentage of an amount.
 * @param amount The base amount
 * @param percentage The percentage as a number (e.g., 24.99 for 24.99%)
 */
export function percentage(amount: Money | number, percent: number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.times(percent).dividedBy(100);
}

/**
 * Calculate what percentage one amount is of another.
 * @returns Percentage as a number (e.g., 25 for 25%)
 */
export function asPercentage(part: Money | number, whole: Money | number): number {
  const partMoney = part instanceof Decimal ? part : money(part);
  const wholeMoney = whole instanceof Decimal ? whole : money(whole);
  
  if (wholeMoney.isZero()) {
    return 0;
  }
  
  return partMoney.dividedBy(wholeMoney).times(100).toDecimalPlaces(2).toNumber();
}

/**
 * Convert APR to monthly interest rate.
 * @param apr Annual Percentage Rate (e.g., 24.99)
 * @returns Monthly rate as decimal (e.g., 0.0208)
 */
export function aprToMonthlyRate(apr: number): number {
  return new Decimal(apr).dividedBy(100).dividedBy(12).toNumber();
}

/**
 * Calculate monthly interest on a balance.
 * @param balance Current balance
 * @param apr Annual Percentage Rate
 * @returns Interest for one month
 */
export function monthlyInterest(balance: Money | number, apr: number): Money {
  const balanceMoney = balance instanceof Decimal ? balance : money(balance);
  const monthlyRate = aprToMonthlyRate(apr);
  return balanceMoney.times(monthlyRate);
}

// =============================================================================
// COMPARISON FUNCTIONS
// =============================================================================

/**
 * Check if amount is positive.
 */
export function isPositive(amount: Money | number): boolean {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.isPositive();
}

/**
 * Check if amount is negative.
 */
export function isNegative(amount: Money | number): boolean {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.isNegative();
}

/**
 * Check if amount is zero.
 */
export function isZero(amount: Money | number): boolean {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.isZero();
}

/**
 * Get the larger of two amounts.
 */
export function max(a: Money | number, b: Money | number): Money {
  const aMoney = a instanceof Decimal ? a : money(a);
  const bMoney = b instanceof Decimal ? b : money(b);
  return Decimal.max(aMoney, bMoney);
}

/**
 * Get the smaller of two amounts.
 */
export function min(a: Money | number, b: Money | number): Money {
  const aMoney = a instanceof Decimal ? a : money(a);
  const bMoney = b instanceof Decimal ? b : money(b);
  return Decimal.min(aMoney, bMoney);
}

/**
 * Compare two amounts.
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
export function compare(a: Money | number, b: Money | number): -1 | 0 | 1 {
  const aMoney = a instanceof Decimal ? a : money(a);
  const bMoney = b instanceof Decimal ? b : money(b);
  return aMoney.comparedTo(bMoney) as -1 | 0 | 1;
}

// =============================================================================
// ROUNDING FUNCTIONS
// =============================================================================

/**
 * Round money to 2 decimal places (standard currency).
 */
export function round(amount: Money | number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Round up to the nearest cent.
 */
export function ceil(amount: Money | number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.toDecimalPlaces(2, Decimal.ROUND_UP);
}

/**
 * Round down to the nearest cent.
 */
export function floor(amount: Money | number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return amountMoney.toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

// =============================================================================
// FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format money as a currency string.
 * @param amount The amount to format
 * @param currency Currency code (default: USD)
 * @param locale Locale for formatting (default: en-US)
 */
export function format(
  amount: Money | number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMoney.toNumber());
}

/**
 * Format money as a compact string (e.g., $1.2K, $3.5M).
 */
export function formatCompact(
  amount: Money | number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amountMoney.toNumber());
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a value is a valid monetary amount.
 */
export function isValidMoney(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value)) return false;
  if (Number.isNaN(value)) return false;
  return true;
}

/**
 * Ensure an amount is non-negative, returning 0 if negative.
 */
export function nonNegative(amount: Money | number): Money {
  const amountMoney = amount instanceof Decimal ? amount : money(amount);
  return Decimal.max(amountMoney, money(0));
}

// =============================================================================
// AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Sum an array of amounts.
 */
export function sum(amounts: (Money | number)[]): Money {
  return amounts.reduce<Money>(
    (total, amount) => total.plus(amount instanceof Decimal ? amount : money(amount)),
    money(0)
  );
}

/**
 * Calculate average of amounts.
 */
export function average(amounts: (Money | number)[]): Money {
  if (amounts.length === 0) return money(0);
  return divide(sum(amounts), amounts.length);
}
