/**
 * Obsidian Decision Engine - Affordability Tests
 * 
 * Tests for the affordability calculation engine.
 */

import { describe, it, expect } from 'vitest';
import { calculateAffordability, calculateMetrics } from '../src/core/affordability/affordCalculator.js';
import type { UserFinancialProfile, PurchaseRequest } from '../src/models/types.js';

// =============================================================================
// TEST DATA
// =============================================================================

const healthyProfile: UserFinancialProfile = {
  monthly_income: 6000,
  monthly_fixed_expenses: 3000,
  cash_balance: 15000,
  savings_balance: 5000,
  debts: [
    {
      type: 'credit_card',
      balance: 2000,
      apr: 18.99,
      minimum_payment: 50,
      credit_limit: 10000,
    },
  ],
};

const stressedProfile: UserFinancialProfile = {
  monthly_income: 4000,
  monthly_fixed_expenses: 3500,
  cash_balance: 1000,
  debts: [
    {
      type: 'credit_card',
      balance: 8000,
      apr: 24.99,
      minimum_payment: 200,
      credit_limit: 10000,
    },
    {
      type: 'personal_loan',
      balance: 5000,
      apr: 12.0,
      minimum_payment: 150,
    },
  ],
};

const smallPurchase: PurchaseRequest = {
  amount: 50,
  category: 'dining',
  payment_method: 'debit',
};

const mediumPurchase: PurchaseRequest = {
  amount: 500,
  category: 'electronics',
  payment_method: 'credit_card',
};

const largePurchase: PurchaseRequest = {
  amount: 3000,
  category: 'appliances',
  payment_method: 'cash',
};

// =============================================================================
// METRICS CALCULATION TESTS
// =============================================================================

describe('calculateMetrics', () => {
  it('should correctly calculate monthly cashflow', () => {
    const metrics = calculateMetrics(healthyProfile);
    
    // Income - expenses - debt payments
    // 6000 - 3000 - 50 = 2950
    expect(metrics.monthlyCashflow).toBeCloseTo(2950, 0);
  });

  it('should correctly calculate liquid assets', () => {
    const metrics = calculateMetrics(healthyProfile);
    
    // cash + savings
    expect(metrics.liquidAssets).toBe(20000);
  });

  it('should correctly calculate emergency fund months', () => {
    const metrics = calculateMetrics(healthyProfile);
    
    // liquid assets / (expenses + debt payments)
    // 20000 / (3000 + 50) = 6.56
    expect(metrics.emergencyFundMonths).toBeGreaterThan(6);
  });

  it('should correctly calculate credit utilization', () => {
    const metrics = calculateMetrics(healthyProfile);
    
    // 2000 / 10000 = 0.2
    expect(metrics.creditUtilization).toBe(0.2);
  });

  it('should handle profile with no debts', () => {
    const debtFreeProfile: UserFinancialProfile = {
      monthly_income: 5000,
      monthly_fixed_expenses: 2500,
      cash_balance: 10000,
      debts: [],
    };

    const metrics = calculateMetrics(debtFreeProfile);
    
    expect(metrics.totalDebt).toBe(0);
    expect(metrics.monthlyDebtPayments).toBe(0);
    expect(metrics.creditUtilization).toBe(0);
    expect(metrics.monthlyCashflow).toBe(2500);
  });
});

// =============================================================================
// AFFORDABILITY DECISION TESTS
// =============================================================================

describe('calculateAffordability', () => {
  describe('Healthy profile scenarios', () => {
    it('should approve small purchases with YES', () => {
      const result = calculateAffordability(healthyProfile, smallPurchase);
      
      expect(result.decision).toBe('YES');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should approve medium purchases with healthy finances', () => {
      const result = calculateAffordability(healthyProfile, mediumPurchase);
      
      expect(['YES', 'CONDITIONAL']).toContain(result.decision);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should include impact analysis', () => {
      const result = calculateAffordability(healthyProfile, largePurchase);
      
      expect(result.impact.projectedCashBalance).toBeDefined();
      expect(result.impact.monthsOfBufferRemaining).toBeDefined();
      expect(result.impact.bufferConsumptionPercent).toBeDefined();
    });
  });

  describe('Stressed profile scenarios', () => {
    it('should reject large purchases when financially stressed', () => {
      const result = calculateAffordability(stressedProfile, largePurchase);
      
      expect(['NO', 'DEFER']).toContain(result.decision);
      expect(result.riskLevel).not.toBe('LOW');
    });

    it('should provide recommendations when declining', () => {
      const result = calculateAffordability(stressedProfile, largePurchase);
      
      if (result.decision !== 'YES') {
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should provide alternatives', () => {
      const result = calculateAffordability(stressedProfile, largePurchase);
      
      if (result.decision !== 'YES') {
        expect(result.alternatives.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle zero balance purchase', () => {
      const zeroPurchase: PurchaseRequest = {
        amount: 0,
        category: 'other',
        payment_method: 'cash',
      };

      // This should not throw
      expect(() => calculateAffordability(healthyProfile, zeroPurchase)).not.toThrow();
    });

    it('should handle purchase exceeding all liquid assets', () => {
      const hugePurchase: PurchaseRequest = {
        amount: 100000,
        category: 'luxury',
        payment_method: 'cash',
      };

      const result = calculateAffordability(healthyProfile, hugePurchase);
      
      expect(result.decision).toBe('NO');
      expect(result.impact.projectedCashBalance).toBeLessThan(0);
    });

    it('should include reason codes', () => {
      const result = calculateAffordability(healthyProfile, mediumPurchase);
      
      expect(result.reasonCodes.length).toBeGreaterThan(0);
    });
  });

  describe('Payment method handling', () => {
    it('should calculate credit utilization impact for credit card purchases', () => {
      const result = calculateAffordability(healthyProfile, mediumPurchase);
      
      expect(result.impact.creditUtilizationChange).not.toBeNull();
    });

    it('should calculate cashflow impact for financed purchases', () => {
      const financedPurchase: PurchaseRequest = {
        amount: 2000,
        category: 'appliances',
        payment_method: 'financing',
        financing_terms: {
          apr: 0,
          term_months: 12,
          down_payment: 200,
        },
      };

      const result = calculateAffordability(healthyProfile, financedPurchase);
      
      expect(result.impact.newMonthlyCashflow).not.toBeNull();
    });
  });
});

// =============================================================================
// RULE EVALUATION TESTS
// =============================================================================

describe('Rule evaluation', () => {
  it('should evaluate multiple rules', () => {
    const result = calculateAffordability(healthyProfile, mediumPurchase);
    
    expect(result.ruleEvaluation.rules.length).toBeGreaterThan(0);
  });

  it('should calculate weighted score', () => {
    const result = calculateAffordability(healthyProfile, mediumPurchase);
    
    expect(result.ruleEvaluation.weightedScore).toBeGreaterThanOrEqual(0);
    expect(result.ruleEvaluation.weightedScore).toBeLessThanOrEqual(1);
  });

  it('should track pass and fail counts', () => {
    const result = calculateAffordability(healthyProfile, mediumPurchase);
    
    const totalRules = result.ruleEvaluation.passCount + result.ruleEvaluation.failCount;
    expect(totalRules).toBeGreaterThan(0);
  });
});
