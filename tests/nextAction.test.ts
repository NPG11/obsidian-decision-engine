/**
 * Obsidian Decision Engine - Next Best Action Tests
 * 
 * Tests for the next best action recommendation engine.
 */

import { describe, it, expect } from 'vitest';
import { generateNextBestActions } from '../src/core/actions/nextBestAction.js';
import { detectAllSignals, detectRiskSignals } from '../src/core/signals/financialSignals.js';
import type { UserFinancialProfile } from '../src/models/types.js';

// =============================================================================
// TEST DATA
// =============================================================================

const excellentProfile: UserFinancialProfile = {
  monthly_income: 10000,
  monthly_fixed_expenses: 4000,
  cash_balance: 30000,
  savings_balance: 20000,
  emergency_fund: 10000,
  debts: [],
  credit_score: 780,
};

const healthyProfile: UserFinancialProfile = {
  monthly_income: 6000,
  monthly_fixed_expenses: 3500,
  cash_balance: 8000,
  savings_balance: 4000,
  debts: [
    {
      type: 'credit_card',
      balance: 1500,
      apr: 18.99,
      minimum_payment: 50,
      credit_limit: 10000,
    },
  ],
};

const stressedProfile: UserFinancialProfile = {
  monthly_income: 4000,
  monthly_fixed_expenses: 3200,
  cash_balance: 500,
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
      apr: 15.0,
      minimum_payment: 150,
    },
  ],
};

const criticalProfile: UserFinancialProfile = {
  monthly_income: 3000,
  monthly_fixed_expenses: 3200, // Negative cashflow!
  cash_balance: 200,
  debts: [
    {
      type: 'credit_card',
      balance: 9500,
      apr: 29.99,
      minimum_payment: 250,
      credit_limit: 10000,
    },
    {
      type: 'payday_loan',
      balance: 1000,
      apr: 400.0, // Predatory
      minimum_payment: 100,
    },
  ],
};

// =============================================================================
// SIGNAL DETECTION TESTS
// =============================================================================

describe('Signal detection', () => {
  describe('Risk signals', () => {
    it('should detect low emergency fund', () => {
      const signals = detectRiskSignals(stressedProfile);
      
      const efSignal = signals.find(
        (s) => s.id.includes('EMERGENCY_FUND')
      );
      expect(efSignal).toBeDefined();
    });

    it('should not flag adequate emergency fund', () => {
      const signals = detectRiskSignals(excellentProfile);
      
      const criticalEF = signals.find(
        (s) => s.id === 'EMERGENCY_FUND_CRITICAL'
      );
      expect(criticalEF).toBeUndefined();
    });

    it('should detect critical DTI', () => {
      const signals = detectRiskSignals(criticalProfile);
      
      const dtiSignal = signals.find(
        (s) => s.id.includes('DTI')
      );
      expect(dtiSignal).toBeDefined();
    });
  });

  describe('All signals', () => {
    it('should return signals sorted by priority', () => {
      const signals = detectAllSignals(stressedProfile);
      
      for (let i = 1; i < signals.length; i++) {
        expect(signals[i - 1]!.priority).toBeGreaterThanOrEqual(signals[i]!.priority);
      }
    });

    it('should detect positive signals for healthy profile', () => {
      const signals = detectAllSignals(excellentProfile);
      
      const positiveSignals = signals.filter((s) => s.severity === 'positive');
      expect(positiveSignals.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// HEALTH SCORE TESTS
// =============================================================================

describe('Health score calculation', () => {
  it('should give excellent profile high grade', () => {
    const result = generateNextBestActions(excellentProfile);
    
    expect(['A', 'B']).toContain(result.health_assessment.grade);
    expect(result.health_assessment.score).toBeGreaterThan(80);
  });

  it('should give healthy profile decent grade', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(['B', 'C']).toContain(result.health_assessment.grade);
    expect(result.health_assessment.score).toBeGreaterThan(60);
  });

  it('should give stressed profile lower grade', () => {
    const result = generateNextBestActions(stressedProfile);
    
    expect(['C', 'D', 'F']).toContain(result.health_assessment.grade);
  });

  it('should give critical profile failing grade', () => {
    const result = generateNextBestActions(criticalProfile);
    
    expect(['D', 'F']).toContain(result.health_assessment.grade);
    expect(result.health_assessment.score).toBeLessThan(60);
  });

  it('should provide summary and strengths/concerns', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(result.health_assessment.summary).toBeDefined();
    expect(result.health_assessment.strengths.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// ACTION GENERATION TESTS
// =============================================================================

describe('Action generation', () => {
  it('should generate prioritized actions', () => {
    const result = generateNextBestActions(stressedProfile);
    
    expect(result.actions.length).toBeGreaterThan(0);
    
    // Actions should have priority 1, 2, 3...
    result.actions.forEach((action, index) => {
      expect(action.priority).toBe(index + 1);
    });
  });

  it('should recommend addressing negative cashflow first', () => {
    const result = generateNextBestActions(criticalProfile);
    
    const firstAction = result.actions[0];
    expect(firstAction?.urgency).toBe('immediate');
  });

  it('should recommend emergency fund for stressed profile', () => {
    const result = generateNextBestActions(stressedProfile);
    
    const efAction = result.actions.find(
      (a) => a.action_type === 'build_emergency_fund'
    );
    expect(efAction).toBeDefined();
  });

  it('should recommend debt payoff for high-interest debt', () => {
    const result = generateNextBestActions(stressedProfile);
    
    const debtAction = result.actions.find(
      (a) => a.action_type === 'pay_debt'
    );
    expect(debtAction).toBeDefined();
  });

  it('should recommend automation for healthy profile', () => {
    const result = generateNextBestActions(excellentProfile);
    
    const automateAction = result.actions.find(
      (a) => a.action_type === 'automate_savings' || a.action_type === 'maintain_course'
    );
    expect(automateAction).toBeDefined();
  });

  it('should respect max_actions limit', () => {
    const result = generateNextBestActions(stressedProfile, 3);
    
    expect(result.actions.length).toBeLessThanOrEqual(3);
  });

  it('should include action steps', () => {
    const result = generateNextBestActions(stressedProfile);
    
    const actionWithSteps = result.actions.find((a) => a.steps && a.steps.length > 0);
    expect(actionWithSteps).toBeDefined();
  });
});

// =============================================================================
// KEY METRICS TESTS
// =============================================================================

describe('Key metrics', () => {
  it('should calculate monthly cashflow correctly', () => {
    const result = generateNextBestActions(healthyProfile);
    
    // income - expenses - debt payments
    // 6000 - 3500 - 50 = 2450
    expect(result.key_metrics.monthly_cashflow).toBeCloseTo(2450, 0);
  });

  it('should calculate total debt correctly', () => {
    const result = generateNextBestActions(stressedProfile);
    
    // 8000 + 5000 = 13000
    expect(result.key_metrics.total_debt).toBe(13000);
  });

  it('should calculate emergency fund months', () => {
    const result = generateNextBestActions(excellentProfile);
    
    // (30000 + 20000 + 10000) / 4000 = 15
    expect(result.key_metrics.emergency_fund_months).toBeGreaterThan(10);
  });

  it('should handle zero debt profile', () => {
    const result = generateNextBestActions(excellentProfile);
    
    expect(result.key_metrics.total_debt).toBe(0);
    expect(result.key_metrics.debt_to_income_ratio).toBe(0);
  });
});

// =============================================================================
// RESPONSE FORMAT TESTS
// =============================================================================

describe('Response format', () => {
  it('should include all required fields', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(result.actions).toBeDefined();
    expect(result.health_assessment).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.key_metrics).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('should have valid confidence score', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should include timestamp in metadata', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(result.metadata.timestamp).toBeDefined();
    expect(new Date(result.metadata.timestamp).getTime()).not.toBeNaN();
  });

  it('should include request_id in metadata', () => {
    const result = generateNextBestActions(healthyProfile);
    
    expect(result.metadata.request_id).toBeDefined();
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('should handle profile with zero income', () => {
    const zeroIncome: UserFinancialProfile = {
      monthly_income: 0,
      monthly_fixed_expenses: 1000,
      cash_balance: 5000,
      debts: [],
    };

    const result = generateNextBestActions(zeroIncome);
    
    expect(result.health_assessment.grade).toBe('F');
    expect(result.key_metrics.savings_rate).toBe(0);
  });

  it('should handle profile with extreme debt', () => {
    const extremeDebt: UserFinancialProfile = {
      monthly_income: 5000,
      monthly_fixed_expenses: 2000,
      cash_balance: 1000,
      debts: [
        { type: 'credit_card', balance: 50000, apr: 25.0, minimum_payment: 1000 },
        { type: 'personal_loan', balance: 30000, apr: 15.0, minimum_payment: 800 },
      ],
    };

    const result = generateNextBestActions(extremeDebt);
    
    expect(result.health_assessment.grade).toBe('F');
    expect(result.actions[0]?.urgency).toBe('immediate');
  });

  it('should handle profile with many debts', () => {
    const manyDebts: UserFinancialProfile = {
      monthly_income: 8000,
      monthly_fixed_expenses: 3000,
      cash_balance: 5000,
      debts: Array(10).fill(null).map((_, i) => ({
        type: 'credit_card' as const,
        balance: 1000 + i * 500,
        apr: 15 + i,
        minimum_payment: 25 + i * 5,
      })),
    };

    expect(() => generateNextBestActions(manyDebts)).not.toThrow();
  });
});
