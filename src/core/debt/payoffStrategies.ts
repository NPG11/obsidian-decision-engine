/**
 * Obsidian Decision Engine - Debt Payoff Strategies
 * 
 * Implementation of various debt payoff strategies.
 * Each strategy determines the order in which debts are paid off.
 * 
 * @module core/debt/payoffStrategies
 */

import type { DebtState, DebtStrategy } from './debtTypes.js';

/**
 * Sort debts by avalanche strategy (highest APR first).
 * This is mathematically optimal - minimizes total interest paid.
 */
export function sortByAvalanche(debts: DebtState[]): DebtState[] {
  return [...debts]
    .filter((d) => !d.isPaidOff && d.balance > 0)
    .sort((a, b) => {
      // Primary: highest APR first
      if (b.apr !== a.apr) return b.apr - a.apr;
      // Secondary: lowest balance (for ties)
      return a.balance - b.balance;
    });
}

/**
 * Sort debts by snowball strategy (smallest balance first).
 * Provides psychological wins to maintain motivation.
 */
export function sortBySnowball(debts: DebtState[]): DebtState[] {
  return [...debts]
    .filter((d) => !d.isPaidOff && d.balance > 0)
    .sort((a, b) => {
      // Primary: lowest balance first
      if (a.balance !== b.balance) return a.balance - b.balance;
      // Secondary: highest APR (for ties)
      return b.apr - a.apr;
    });
}

/**
 * Sort debts by hybrid strategy.
 * Combines APR and balance considerations with a scoring system.
 * 
 * Score = (APR_weight * normalized_APR) + (balance_weight * (1 - normalized_balance))
 * 
 * Higher scores are paid first.
 */
export function sortByHybrid(debts: DebtState[]): DebtState[] {
  const activeDebts = debts.filter((d) => !d.isPaidOff && d.balance > 0);
  
  if (activeDebts.length === 0) return [];
  
  // Find min/max for normalization
  const maxAPR = Math.max(...activeDebts.map((d) => d.apr));
  const minAPR = Math.min(...activeDebts.map((d) => d.apr));
  const maxBalance = Math.max(...activeDebts.map((d) => d.balance));
  const minBalance = Math.min(...activeDebts.map((d) => d.balance));
  
  // Weights for scoring (APR slightly more important)
  const APR_WEIGHT = 0.6;
  const BALANCE_WEIGHT = 0.4;
  
  // Calculate scores
  const scoredDebts = activeDebts.map((debt) => {
    // Normalize APR (0-1, higher APR = higher score)
    const normalizedAPR = maxAPR === minAPR ? 1 : (debt.apr - minAPR) / (maxAPR - minAPR);
    
    // Normalize balance (0-1, lower balance = higher score)
    const normalizedBalance = maxBalance === minBalance
      ? 1
      : 1 - (debt.balance - minBalance) / (maxBalance - minBalance);
    
    const score = APR_WEIGHT * normalizedAPR + BALANCE_WEIGHT * normalizedBalance;
    
    return { debt, score };
  });
  
  // Sort by score (highest first)
  return scoredDebts
    .sort((a, b) => b.score - a.score)
    .map((item) => item.debt);
}

/**
 * Sort debts for minimum-only payments (maintains original order).
 * This is just for comparison - no prioritization strategy.
 */
export function sortByMinimumOnly(debts: DebtState[]): DebtState[] {
  return [...debts].filter((d) => !d.isPaidOff && d.balance > 0);
}

/**
 * Get the appropriate sorting function for a strategy.
 */
export function getStrategySorter(
  strategy: DebtStrategy
): (debts: DebtState[]) => DebtState[] {
  switch (strategy) {
    case 'avalanche':
      return sortByAvalanche;
    case 'snowball':
      return sortBySnowball;
    case 'hybrid':
      return sortByHybrid;
    case 'minimum_only':
      return sortByMinimumOnly;
    default:
      return sortByAvalanche;
  }
}

/**
 * Get a human-readable description of a strategy.
 */
export function getStrategyDescription(strategy: DebtStrategy): string {
  switch (strategy) {
    case 'avalanche':
      return 'Pay off highest interest rate debts first to minimize total interest paid';
    case 'snowball':
      return 'Pay off smallest balances first for quick wins and momentum';
    case 'hybrid':
      return 'Balance between interest savings and quick wins using a weighted scoring system';
    case 'minimum_only':
      return 'Pay only minimum payments (baseline comparison)';
  }
}

/**
 * Determine if a debt should be targeted for extra payments.
 * Returns true if this debt should receive extra payment this month.
 */
export function shouldTargetDebt(
  debt: DebtState,
  sortedDebts: DebtState[]
): boolean {
  if (debt.isPaidOff || debt.balance <= 0) return false;
  
  // The first debt in the sorted list (highest priority) gets extra payments
  const targetDebt = sortedDebts[0];
  return targetDebt !== undefined && targetDebt.id === debt.id;
}

/**
 * Calculate how much extra payment to allocate to each debt.
 * After paying minimums, extra payment goes to the target debt.
 * 
 * @param debts All active debts
 * @param sortedDebts Debts sorted by strategy priority
 * @param extraPayment Total extra payment available
 * @param freedUpMinimums Minimums freed from paid-off debts
 * @returns Map of debt ID to extra payment amount
 */
export function allocateExtraPayments(
  debts: DebtState[],
  sortedDebts: DebtState[],
  extraPayment: number,
  freedUpMinimums: number
): Map<string, number> {
  const allocations = new Map<string, number>();
  
  // Initialize all debts with 0 extra
  debts.forEach((d) => allocations.set(d.id, 0));
  
  // Total available extra = user's extra + freed minimums
  let remainingExtra = extraPayment + freedUpMinimums;
  
  // Apply to debts in priority order
  for (const debt of sortedDebts) {
    if (remainingExtra <= 0) break;
    if (debt.isPaidOff || debt.balance <= 0) continue;
    
    // Apply as much as possible to this debt
    const amountToApply = Math.min(remainingExtra, debt.balance);
    allocations.set(debt.id, amountToApply);
    remainingExtra -= amountToApply;
    
    // If debt isn't fully paid, we're done allocating
    if (amountToApply < debt.balance) break;
  }
  
  return allocations;
}
