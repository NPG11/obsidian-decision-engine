/**
 * Obsidian Decision Engine - Date Utilities
 * 
 * Standardized date handling for financial calculations.
 * All dates are handled in UTC to avoid timezone issues.
 * 
 * @module utils/dates
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

// =============================================================================
// DATE CREATION
// =============================================================================

/**
 * Get current date in UTC.
 */
export function now(): dayjs.Dayjs {
  return dayjs.utc();
}

/**
 * Parse a date string to dayjs object.
 */
export function parse(date: string | Date): dayjs.Dayjs {
  return dayjs.utc(date);
}

/**
 * Create a date from year, month (1-12), and day.
 */
export function create(year: number, month: number, day: number): dayjs.Dayjs {
  return dayjs.utc(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

// =============================================================================
// DATE FORMATTING
// =============================================================================

/**
 * Format date as ISO 8601 string.
 */
export function toISO(date: dayjs.Dayjs): string {
  return date.toISOString();
}

/**
 * Format date as YYYY-MM-DD.
 */
export function toDateString(date: dayjs.Dayjs): string {
  return date.format('YYYY-MM-DD');
}

/**
 * Format date as human-readable string.
 */
export function toHumanReadable(date: dayjs.Dayjs): string {
  return date.format('MMMM D, YYYY');
}

/**
 * Format date as month and year (e.g., "January 2025").
 */
export function toMonthYear(date: dayjs.Dayjs): string {
  return date.format('MMMM YYYY');
}

// =============================================================================
// DATE ARITHMETIC
// =============================================================================

/**
 * Add months to a date.
 */
export function addMonths(date: dayjs.Dayjs, months: number): dayjs.Dayjs {
  return date.add(months, 'month');
}

/**
 * Add days to a date.
 */
export function addDays(date: dayjs.Dayjs, days: number): dayjs.Dayjs {
  return date.add(days, 'day');
}

/**
 * Add years to a date.
 */
export function addYears(date: dayjs.Dayjs, years: number): dayjs.Dayjs {
  return date.add(years, 'year');
}

/**
 * Get the difference between two dates in months.
 */
export function monthsBetween(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return end.diff(start, 'month');
}

/**
 * Get the difference between two dates in days.
 */
export function daysBetween(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return end.diff(start, 'day');
}

// =============================================================================
// DATE COMPARISONS
// =============================================================================

/**
 * Check if date is before another date.
 */
export function isBefore(date: dayjs.Dayjs, other: dayjs.Dayjs): boolean {
  return date.isBefore(other);
}

/**
 * Check if date is after another date.
 */
export function isAfter(date: dayjs.Dayjs, other: dayjs.Dayjs): boolean {
  return date.isAfter(other);
}

/**
 * Check if date is same or before another date.
 */
export function isSameOrBeforeDate(date: dayjs.Dayjs, other: dayjs.Dayjs): boolean {
  return date.isSameOrBefore(other, 'day');
}

/**
 * Check if date is in the past.
 */
export function isPast(date: dayjs.Dayjs): boolean {
  return date.isBefore(now());
}

/**
 * Check if date is in the future.
 */
export function isFuture(date: dayjs.Dayjs): boolean {
  return date.isAfter(now());
}

// =============================================================================
// MONTH BOUNDARY FUNCTIONS
// =============================================================================

/**
 * Get the first day of the month.
 */
export function startOfMonth(date: dayjs.Dayjs): dayjs.Dayjs {
  return date.startOf('month');
}

/**
 * Get the last day of the month.
 */
export function endOfMonth(date: dayjs.Dayjs): dayjs.Dayjs {
  return date.endOf('month');
}

/**
 * Get the number of days in the month.
 */
export function daysInMonth(date: dayjs.Dayjs): number {
  return date.daysInMonth();
}

// =============================================================================
// FINANCIAL DATE FUNCTIONS
// =============================================================================

/**
 * Generate an array of future month dates.
 * Useful for creating payment schedules.
 */
export function generateMonthlySchedule(
  startDate: dayjs.Dayjs,
  months: number
): dayjs.Dayjs[] {
  const schedule: dayjs.Dayjs[] = [];
  
  for (let i = 0; i < months; i++) {
    schedule.push(addMonths(startDate, i));
  }
  
  return schedule;
}

/**
 * Calculate the date when a debt will be paid off given
 * a starting date and number of months.
 */
export function payoffDate(startDate: dayjs.Dayjs, months: number): dayjs.Dayjs {
  return addMonths(startDate, months);
}

/**
 * Get fiscal quarter from date.
 * @returns Quarter number (1-4)
 */
export function getFiscalQuarter(date: dayjs.Dayjs): number {
  const month = date.month(); // 0-11
  return Math.floor(month / 3) + 1;
}

/**
 * Check if a date is the first of the month.
 */
export function isFirstOfMonth(date: dayjs.Dayjs): boolean {
  return date.date() === 1;
}

/**
 * Get months remaining until a target date.
 */
export function monthsUntil(targetDate: dayjs.Dayjs): number {
  const current = now();
  return Math.max(0, monthsBetween(current, targetDate));
}
