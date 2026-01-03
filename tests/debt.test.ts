/**
 * Obsidian Decision Engine - Debt Simulator Tests
 * 
 * Tests for the debt payoff simulation engine.
 */

import { describe, it, expect } from 'vitest';
import {
  simulateStrategy,
  compareStrategies,
  generateDebtInsights,
} from '../src/core/debt/debtSimulator.js';
import {
  sortByAvalanche,
  sortBySnowball,
  sortByHybrid,
} from '../src/core/debt/payoffStrategies.js';
import type { DebtAccount } from '../src/models/types.js';

// =============================================================================
// TEST DATA
// =============================================================================

const testDebts: DebtAccount[] = [
  {
    id: 'cc1',
    type: 'credit_card',
    name: 'High Interest Card',
    balance: 5000,
    apr: 24.99,
    minimum_payment: 100,
    credit_limit: 10000,
  },
  {
    id: 'cc2',
    type: 'credit_card',
    name: 'Low Balance Card',
    balance: 500,
    apr: 18.99,
    minimum_payment: 25,
    credit_limit: 3000,
  },
  {
    id: 'loan1',
    type: 'personal_loan',
    name: 'Personal Loan',
    balance: 8000,
    apr: 12.0,
    minimum_payment: 200,
  },
];

// =============================================================================
// STRATEGY SORTING TESTS
// =============================================================================

describe('Debt sorting strategies', () => {
  const debtStates = testDebts.map((d) => ({
    id: d.id ?? '',
    name: d.name ?? d.type,
    type: d.type,
    balance: d.balance,
    apr: d.apr,
    minimumPayment: d.minimum_payment ?? 25,
    creditLimit: d.credit_limit,
    isPaidOff: false,
  }));

  describe('Avalanche (highest APR first)', () => {
    it('should sort by APR descending', () => {
      const sorted = sortByAvalanche(debtStates);
      
      expect(sorted[0]?.id).toBe('cc1'); // 24.99% APR
      expect(sorted[1]?.id).toBe('cc2'); // 18.99% APR
      expect(sorted[2]?.id).toBe('loan1'); // 12% APR
    });

    it('should filter out paid debts', () => {
      const withPaid = [
        ...debtStates,
        { ...debtStates[0]!, id: 'paid', isPaidOff: true },
      ];
      
      const sorted = sortByAvalanche(withPaid);
      
      expect(sorted.find((d) => d.id === 'paid')).toBeUndefined();
    });
  });

  describe('Snowball (smallest balance first)', () => {
    it('should sort by balance ascending', () => {
      const sorted = sortBySnowball(debtStates);
      
      expect(sorted[0]?.id).toBe('cc2'); // $500
      expect(sorted[1]?.id).toBe('cc1'); // $5000
      expect(sorted[2]?.id).toBe('loan1'); // $8000
    });
  });

  describe('Hybrid (balanced approach)', () => {
    it('should return sorted debts', () => {
      const sorted = sortByHybrid(debtStates);
      
      expect(sorted.length).toBe(3);
      // Hybrid considers both APR and balance
    });

    it('should handle single debt', () => {
      const sorted = sortByHybrid([debtStates[0]!]);
      
      expect(sorted.length).toBe(1);
    });
  });
});

// =============================================================================
// SIMULATION TESTS
// =============================================================================

describe('simulateStrategy', () => {
  it('should simulate avalanche strategy', () => {
    const result = simulateStrategy(testDebts, 'avalanche', 200);
    
    expect(result.strategy).toBe('avalanche');
    expect(result.totalMonths).toBeGreaterThan(0);
    expect(result.totalInterestPaid).toBeGreaterThan(0);
    expect(result.totalAmountPaid).toBeGreaterThan(0);
  });

  it('should simulate snowball strategy', () => {
    const result = simulateStrategy(testDebts, 'snowball', 200);
    
    expect(result.strategy).toBe('snowball');
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  it('should track payoff order', () => {
    const result = simulateStrategy(testDebts, 'avalanche', 200);
    
    expect(result.payoffOrder.length).toBe(3);
    result.payoffOrder.forEach((debt) => {
      expect(debt.monthsToPayoff).toBeGreaterThan(0);
      expect(debt.interestPaid).toBeGreaterThanOrEqual(0);
    });
  });

  it('should generate monthly schedule', () => {
    const result = simulateStrategy(testDebts, 'avalanche', 200);
    
    expect(result.schedule.length).toBeGreaterThan(0);
    
    const firstMonth = result.schedule[0]!;
    expect(firstMonth.month).toBe(1);
    expect(firstMonth.payments.length).toBeGreaterThan(0);
    expect(firstMonth.totalPayment).toBeGreaterThan(0);
  });

  it('should handle minimum-only payments', () => {
    const result = simulateStrategy(testDebts, 'minimum_only', 0);
    
    expect(result.strategy).toBe('minimum_only');
    // With minimum only, payoff takes much longer
    expect(result.totalMonths).toBeGreaterThan(
      simulateStrategy(testDebts, 'avalanche', 200).totalMonths
    );
  });

  it('should respect max months limit', () => {
    const result = simulateStrategy(testDebts, 'minimum_only', 0, 24);
    
    // Simulation should stop at max months even if debt remains
    expect(result.schedule.length).toBeLessThanOrEqual(24);
  });

  it('should correctly calculate interest', () => {
    const result = simulateStrategy(testDebts, 'avalanche', 0, 1);
    
    const firstMonth = result.schedule[0]!;
    const ccPayment = firstMonth.payments.find((p) => p.debtId === 'cc1');
    
    // Monthly interest = balance * (APR / 12)
    // 5000 * (0.2499 / 12) ≈ 104.13
    expect(ccPayment?.interestPaid).toBeGreaterThan(100);
    expect(ccPayment?.interestPaid).toBeLessThan(110);
  });
});

// =============================================================================
// STRATEGY COMPARISON TESTS
// =============================================================================

describe('compareStrategies', () => {
  it('should compare all strategies', () => {
    const comparison = compareStrategies(testDebts, 200);
    
    expect(comparison.strategies.length).toBe(4); // avalanche, snowball, hybrid, minimum_only
    expect(comparison.recommendedStrategy).toBeDefined();
    expect(comparison.recommendationReason).toBeDefined();
  });

  it('should calculate savings vs minimum', () => {
    const comparison = compareStrategies(testDebts, 200);
    
    expect(comparison.savingsVsMinimum).toBeGreaterThanOrEqual(0);
  });

  it('should calculate time saved', () => {
    const comparison = compareStrategies(testDebts, 200);
    
    expect(comparison.timeSavedMonths).toBeGreaterThanOrEqual(0);
  });

  it('avalanche should have lowest total interest', () => {
    const comparison = compareStrategies(testDebts, 200);
    
    const avalancheResult = comparison.strategies.find((s) => s.strategy === 'avalanche');
    const snowballResult = comparison.strategies.find((s) => s.strategy === 'snowball');
    
    expect(avalancheResult?.totalInterestPaid).toBeLessThanOrEqual(
      snowballResult?.totalInterestPaid ?? Infinity
    );
  });
});

// =============================================================================
// INSIGHTS TESTS
// =============================================================================

describe('generateDebtInsights', () => {
  it('should calculate total debt', () => {
    const comparison = compareStrategies(testDebts, 200);
    const insights = generateDebtInsights(testDebts, comparison);
    
    // 5000 + 500 + 8000 = 13500
    expect(insights.totalDebt).toBe(13500);
  });

  it('should identify highest APR debt', () => {
    const comparison = compareStrategies(testDebts, 200);
    const insights = generateDebtInsights(testDebts, comparison);
    
    expect(insights.highestAPRDebt?.apr).toBe(24.99);
    expect(insights.highestAPRDebt?.name).toBe('High Interest Card');
  });

  it('should identify lowest balance debt', () => {
    const comparison = compareStrategies(testDebts, 200);
    const insights = generateDebtInsights(testDebts, comparison);
    
    expect(insights.lowestBalanceDebt?.balance).toBe(500);
  });

  it('should calculate monthly minimum required', () => {
    const comparison = compareStrategies(testDebts, 200);
    const insights = generateDebtInsights(testDebts, comparison);
    
    // 100 + 25 + 200 = 325
    expect(insights.monthlyMinimumRequired).toBe(325);
  });

  it('should provide debt-free date', () => {
    const comparison = compareStrategies(testDebts, 200);
    const insights = generateDebtInsights(testDebts, comparison);
    
    expect(insights.debtFreeDate).toBeDefined();
    expect(insights.debtFreeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('should handle empty debt array', () => {
    const result = simulateStrategy([], 'avalanche', 200);
    
    expect(result.totalMonths).toBe(0);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.schedule.length).toBe(0);
  });

  it('should handle single debt', () => {
    const singleDebt: DebtAccount[] = [testDebts[0]!];
    const result = simulateStrategy(singleDebt, 'avalanche', 200);
    
    expect(result.payoffOrder.length).toBe(1);
  });

  it('should handle zero balance debts', () => {
    const withZero: DebtAccount[] = [
      ...testDebts,
      { type: 'credit_card', balance: 0, apr: 20 },
    ];
    
    const result = simulateStrategy(withZero, 'avalanche', 200);
    
    // Zero balance debt should be ignored
    expect(result.payoffOrder.length).toBe(3);
  });

  it('should handle very high extra payment (instant payoff)', () => {
    const result = simulateStrategy(testDebts, 'avalanche', 50000);
    
    // With huge extra payment, should pay off quickly
    expect(result.totalMonths).toBe(1);
  });
});
