/**
 * Obsidian Decision Engine - Debt Simulator
 * 
 * Month-by-month debt payoff simulation engine.
 * Simulates various strategies and compares outcomes.
 * 
 * CRITICAL: All calculations use precise decimal arithmetic.
 * No floating-point rounding errors in financial calculations.
 * 
 * @module core/debt/debtSimulator
 */

import type { DebtAccount, UserFinancialProfile } from '../../models/types.js';
import type {
  DebtState,
  DebtPayment,
  MonthlySimulationState,
  StrategySimulationResult,
  StrategyComparison,
  DebtInsights,
  DebtStrategy,
} from './debtTypes.js';
import { getStrategySorter, allocateExtraPayments, getStrategyDescription } from './payoffStrategies.js';
import { money, multiply, subtract, toDisplayDollars, add, divide } from '../../utils/money.js';
import { now, addMonths, toMonthYear, toDateString } from '../../utils/dates.js';
import { DEBT_PAYOFF } from '../../config/thresholds.js';

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize debt state from a debt account.
 */
function initializeDebtState(debt: DebtAccount, index: number): DebtState {
  const minimumPayment = debt.minimum_payment ?? calculateMinimumPayment(debt);
  
  return {
    id: debt.id ?? `debt_${index}`,
    name: debt.name ?? `${debt.type}_${index}`,
    type: debt.type,
    balance: debt.balance,
    apr: debt.apr,
    minimumPayment,
    creditLimit: debt.credit_limit,
    isPaidOff: debt.balance <= 0,
  };
}

/**
 * Calculate minimum payment if not provided.
 */
function calculateMinimumPayment(debt: DebtAccount): number {
  switch (debt.type) {
    case 'credit_card':
      return Math.max(
        debt.balance * DEBT_PAYOFF.MIN_CREDIT_CARD_PAYMENT_PERCENT,
        DEBT_PAYOFF.MIN_PAYMENT_FLOOR,
        debt.balance // Can't pay more than balance
      );
    case 'mortgage':
      // Estimate 30-year mortgage payment
      return calculateAmortizedPayment(debt.balance, debt.apr, 360);
    case 'auto_loan':
    case 'personal_loan':
      // Estimate 5-year loan payment
      return calculateAmortizedPayment(debt.balance, debt.apr, 60);
    case 'student_loan':
      // Estimate 10-year loan payment
      return calculateAmortizedPayment(debt.balance, debt.apr, 120);
    default:
      return Math.max(debt.balance * 0.03, DEBT_PAYOFF.MIN_PAYMENT_FLOOR);
  }
}

/**
 * Calculate amortized payment for a loan.
 */
function calculateAmortizedPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0) return 0;
  
  const monthlyRate = annualRate / 100 / 12;
  
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  
  const payment =
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  
  return Math.round(payment * 100) / 100;
}

// =============================================================================
// SINGLE MONTH SIMULATION
// =============================================================================

/**
 * Simulate one month of debt payments.
 */
function simulateMonth(
  debts: DebtState[],
  extraPayment: number,
  strategy: DebtStrategy,
  month: number,
  startDate: ReturnType<typeof now>,
  totalInterestSoFar: number,
  freedUpMinimums: number
): MonthlySimulationState {
  // Get strategy sorter and sort active debts
  const sorter = getStrategySorter(strategy);
  const sortedDebts = sorter(debts);
  
  // Allocate extra payments according to strategy
  const extraAllocations = allocateExtraPayments(
    debts,
    sortedDebts,
    extraPayment,
    freedUpMinimums
  );
  
  const payments: DebtPayment[] = [];
  const updatedDebts: DebtState[] = [];
  const debtsPaidOff: string[] = [];
  
  let totalPaymentThisMonth = 0;
  let totalInterestThisMonth = 0;
  let totalPrincipalThisMonth = 0;
  let newFreedUpMinimums = 0;
  
  // Process each debt
  for (const debt of debts) {
    if (debt.isPaidOff || debt.balance <= 0) {
      updatedDebts.push({ ...debt, isPaidOff: true, balance: 0 });
      continue;
    }
    
    // Calculate monthly interest
    const monthlyRate = debt.apr / 100 / 12;
    const interestCharge = toDisplayDollars(multiply(debt.balance, monthlyRate));
    
    // Calculate total payment (minimum + extra)
    const extraForThisDebt = extraAllocations.get(debt.id) ?? 0;
    const desiredPayment = debt.minimumPayment + extraForThisDebt;
    
    // Balance after interest
    const balanceWithInterest = toDisplayDollars(add(debt.balance, interestCharge));
    
    // Actual payment is capped at balance with interest
    const actualPayment = Math.min(desiredPayment, balanceWithInterest);
    
    // Interest portion (pay interest first)
    const interestPaid = Math.min(interestCharge, actualPayment);
    
    // Principal portion
    const principalPaid = actualPayment - interestPaid;
    
    // New balance
    const newBalance = Math.max(0, toDisplayDollars(subtract(balanceWithInterest, actualPayment)));
    
    // Check if paid off
    const isPaidOff = newBalance <= 0.01; // Allow for tiny rounding
    
    if (isPaidOff) {
      debtsPaidOff.push(debt.id);
      newFreedUpMinimums += debt.minimumPayment;
    }
    
    // Record payment
    payments.push({
      debtId: debt.id,
      debtName: debt.name,
      paymentAmount: actualPayment,
      principalPaid,
      interestPaid,
      remainingBalance: isPaidOff ? 0 : newBalance,
    });
    
    // Update debt state
    updatedDebts.push({
      ...debt,
      balance: isPaidOff ? 0 : newBalance,
      isPaidOff,
    });
    
    totalPaymentThisMonth += actualPayment;
    totalInterestThisMonth += interestPaid;
    totalPrincipalThisMonth += principalPaid;
  }
  
  // Calculate totals
  const totalRemainingDebt = updatedDebts.reduce((sum, d) => sum + d.balance, 0);
  
  // Update debts array in place for next iteration
  debts.length = 0;
  debts.push(...updatedDebts);
  
  return {
    month,
    date: toMonthYear(addMonths(startDate, month - 1)),
    debts: updatedDebts,
    payments,
    totalPayment: Math.round(totalPaymentThisMonth * 100) / 100,
    totalInterestPaid: Math.round((totalInterestSoFar + totalInterestThisMonth) * 100) / 100,
    totalPrincipalPaid: Math.round(totalPrincipalThisMonth * 100) / 100,
    totalRemainingDebt: Math.round(totalRemainingDebt * 100) / 100,
    debtsPaidOffThisMonth: debtsPaidOff,
    extraPaymentApplied: extraPayment + freedUpMinimums,
  };
}

// =============================================================================
// FULL SIMULATION
// =============================================================================

/**
 * Run complete debt payoff simulation for a strategy.
 */
export function simulateStrategy(
  debts: DebtAccount[],
  strategy: DebtStrategy,
  extraMonthlyPayment: number,
  maxMonths: number = DEBT_PAYOFF.MAX_SIMULATION_MONTHS
): StrategySimulationResult {
  // Initialize debt states
  const debtStates = debts.map((d, i) => initializeDebtState(d, i));
  
  // Track original balances for payoff order
  const originalBalances = new Map(
    debtStates.map((d) => [d.id, { balance: d.balance, name: d.name }])
  );
  
  const schedule: MonthlySimulationState[] = [];
  const payoffOrder: StrategySimulationResult['payoffOrder'] = [];
  const debtInterestPaid = new Map<string, number>();
  
  // Initialize interest tracking
  debtStates.forEach((d) => debtInterestPaid.set(d.id, 0));
  
  const startDate = now();
  let totalInterestPaid = 0;
  let totalAmountPaid = 0;
  let freedUpMinimums = 0;
  let month = 0;
  
  // Calculate total minimum payment
  const totalMinimumPayment = debtStates.reduce((sum, d) => sum + d.minimumPayment, 0);
  
  // Simulate until all debts paid or max months reached
  while (month < maxMonths) {
    // Check if all debts are paid
    const hasRemainingDebt = debtStates.some((d) => !d.isPaidOff && d.balance > 0);
    if (!hasRemainingDebt) break;
    
    month++;
    
    // Simulate one month
    const monthState = simulateMonth(
      debtStates,
      extraMonthlyPayment,
      strategy,
      month,
      startDate,
      totalInterestPaid,
      freedUpMinimums
    );
    
    // Update totals
    totalInterestPaid = monthState.totalInterestPaid;
    totalAmountPaid += monthState.totalPayment;
    
    // Track interest per debt
    monthState.payments.forEach((p) => {
      const current = debtInterestPaid.get(p.debtId) ?? 0;
      debtInterestPaid.set(p.debtId, current + p.interestPaid);
    });
    
    // Track freed up minimums from debts paid off
    monthState.debtsPaidOffThisMonth.forEach((debtId) => {
      const debt = debtStates.find((d) => d.id === debtId);
      if (debt) {
        freedUpMinimums += debt.minimumPayment;
        
        // Record payoff
        const original = originalBalances.get(debtId);
        payoffOrder.push({
          debtId,
          debtName: original?.name ?? debtId,
          monthsToPayoff: month,
          interestPaid: debtInterestPaid.get(debtId) ?? 0,
          originalBalance: original?.balance ?? 0,
        });
      }
    });
    
    schedule.push(monthState);
  }
  
  // Add any remaining debts to payoff order (not paid off in time)
  debtStates.forEach((d) => {
    if (!d.isPaidOff && d.balance > 0) {
      const original = originalBalances.get(d.id);
      payoffOrder.push({
        debtId: d.id,
        debtName: d.name,
        monthsToPayoff: maxMonths + 999, // Indicate not paid off
        interestPaid: debtInterestPaid.get(d.id) ?? 0,
        originalBalance: original?.balance ?? 0,
      });
    }
  });
  
  return {
    strategy,
    totalMonths: month,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
    monthlyPaymentRequired: totalMinimumPayment + extraMonthlyPayment,
    schedule,
    payoffOrder,
  };
}

// =============================================================================
// STRATEGY COMPARISON
// =============================================================================

/**
 * Compare all strategies and recommend the best one.
 */
export function compareStrategies(
  debts: DebtAccount[],
  extraMonthlyPayment: number,
  maxMonths: number = DEBT_PAYOFF.MAX_SIMULATION_MONTHS
): StrategyComparison {
  const strategies: DebtStrategy[] = ['avalanche', 'snowball', 'hybrid', 'minimum_only'];
  
  // Run all simulations
  const results = strategies.map((strategy) =>
    simulateStrategy(debts, strategy, strategy === 'minimum_only' ? 0 : extraMonthlyPayment, maxMonths)
  );
  
  // Find minimum interest (avalanche should win this)
  const minInterest = Math.min(...results.map((r) => r.totalInterestPaid));
  const maxInterest = Math.max(...results.map((r) => r.totalInterestPaid));
  
  // Find fastest payoff
  const minMonths = Math.min(...results.map((r) => r.totalMonths));
  
  // Find minimum-only result for comparison
  const minimumOnlyResult = results.find((r) => r.strategy === 'minimum_only');
  const savingsVsMinimum = minimumOnlyResult
    ? minimumOnlyResult.totalInterestPaid - minInterest
    : 0;
  
  // Determine recommendation
  let recommendedStrategy: DebtStrategy = 'avalanche';
  let recommendationReason: string;
  
  const avalancheResult = results.find((r) => r.strategy === 'avalanche');
  const snowballResult = results.find((r) => r.strategy === 'snowball');
  const hybridResult = results.find((r) => r.strategy === 'hybrid');
  
  // Check if snowball has quick wins that might be worth the extra interest
  const hasQuickSnowballWins = snowballResult && avalancheResult &&
    snowballResult.payoffOrder.length > 0 &&
    snowballResult.payoffOrder[0]!.monthsToPayoff <= 3;
  
  const interestDifferential = avalancheResult && snowballResult
    ? snowballResult.totalInterestPaid - avalancheResult.totalInterestPaid
    : 0;
  
  // Recommend based on situation
  if (interestDifferential > 500 || !hasQuickSnowballWins) {
    recommendedStrategy = 'avalanche';
    recommendationReason = `The avalanche method saves you the most money (${formatMoney(minInterest)} in interest total). Focus on your highest-rate debt first.`;
  } else if (hasQuickSnowballWins && interestDifferential < 200) {
    recommendedStrategy = 'snowball';
    recommendationReason = `The snowball method gives you quick wins while only costing ${formatMoney(interestDifferential)} more in interest. The psychological momentum may help you stay motivated.`;
  } else {
    recommendedStrategy = 'hybrid';
    recommendationReason = `The hybrid approach balances interest savings with quick wins, making it a good middle-ground strategy for your situation.`;
  }
  
  // Calculate time saved
  const timeSavedMonths = minimumOnlyResult
    ? minimumOnlyResult.totalMonths - minMonths
    : 0;
  
  return {
    strategies: results,
    recommendedStrategy,
    recommendationReason,
    savingsVsMinimum: Math.round(savingsVsMinimum * 100) / 100,
    savingsVsWorst: Math.round((maxInterest - minInterest) * 100) / 100,
    timeSavedMonths,
  };
}

// =============================================================================
// INSIGHTS GENERATION
// =============================================================================

/**
 * Generate insights from debt analysis.
 */
export function generateDebtInsights(
  debts: DebtAccount[],
  comparison: StrategyComparison
): DebtInsights {
  const activeDebts = debts.filter((d) => d.balance > 0);
  
  // Total debt
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.balance, 0);
  
  // Average APR (weighted by balance)
  const weightedAPRSum = activeDebts.reduce((sum, d) => sum + d.apr * d.balance, 0);
  const averageAPR = totalDebt > 0 ? weightedAPRSum / totalDebt : 0;
  
  // Highest APR debt
  const highestAPRDebt = activeDebts.length > 0
    ? activeDebts.reduce((max, d) => (d.apr > max.apr ? d : max))
    : null;
  
  // Lowest balance debt
  const lowestBalanceDebt = activeDebts.length > 0
    ? activeDebts.reduce((min, d) => (d.balance < min.balance ? d : min))
    : null;
  
  // Quick wins (debts payable in 3 months or less with recommended strategy)
  const recommendedResult = comparison.strategies.find(
    (s) => s.strategy === comparison.recommendedStrategy
  );
  const quickWins = recommendedResult?.payoffOrder
    .filter((p) => p.monthsToPayoff <= 3)
    .map((p) => `Pay off ${p.debtName} (${formatMoney(p.originalBalance)}) in ${p.monthsToPayoff} months`)
    ?? [];
  
  // Monthly minimum required
  const monthlyMinimumRequired = activeDebts.reduce(
    (sum, d) => sum + (d.minimum_payment ?? calculateMinimumPayment(d)),
    0
  );
  
  // Debt-free date
  const debtFreeDate = recommendedResult
    ? toDateString(addMonths(now(), recommendedResult.totalMonths))
    : 'Unknown';
  
  return {
    totalDebt: Math.round(totalDebt * 100) / 100,
    averageAPR: Math.round(averageAPR * 100) / 100,
    highestAPRDebt: highestAPRDebt
      ? {
          id: highestAPRDebt.id ?? 'unknown',
          name: highestAPRDebt.name ?? highestAPRDebt.type,
          apr: highestAPRDebt.apr,
          balance: highestAPRDebt.balance,
        }
      : null,
    lowestBalanceDebt: lowestBalanceDebt
      ? {
          id: lowestBalanceDebt.id ?? 'unknown',
          name: lowestBalanceDebt.name ?? lowestBalanceDebt.type,
          balance: lowestBalanceDebt.balance,
        }
      : null,
    quickWins,
    potentialInterestSavings: comparison.savingsVsMinimum,
    debtFreeDate,
    monthlyMinimumRequired: Math.round(monthlyMinimumRequired * 100) / 100,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
