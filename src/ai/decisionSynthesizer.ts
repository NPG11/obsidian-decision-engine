/**
 * Obsidian Decision Engine - Decision Synthesizer
 * 
 * Combines deterministic calculations with AI-generated explanations
 * to produce final decision responses.
 * 
 * Flow:
 * 1. Receive calculation results (already computed)
 * 2. Generate AI explanation if enabled
 * 3. Fall back to template-based explanation if AI unavailable
 * 4. Assemble final response
 * 
 * @module ai/decisionSynthesizer
 */

import { generateCompletion, isLLMAvailable } from './llmClient.js';
import {
  SYSTEM_PROMPTS,
  buildAffordabilityPrompt,
  buildDebtPayoffPrompt,
  buildNextBestActionPrompt,
} from './reasoningPrompt.js';
import type { AffordabilityCalculation } from '../core/affordability/affordTypes.js';
import type { StrategyComparison, DebtInsights } from '../core/debt/debtTypes.js';
import type { NextBestActionResponse } from '../models/DecisionResponse.js';
import type { PurchaseRequest } from '../models/types.js';
import { format } from '../utils/money.js';

// =============================================================================
// AFFORDABILITY SYNTHESIS
// =============================================================================

/**
 * Generate explanation for affordability decision.
 */
export async function synthesizeAffordabilityExplanation(
  calculation: AffordabilityCalculation,
  purchase: PurchaseRequest,
  useAI: boolean = true
): Promise<{ explanation: string; aiUsed: boolean }> {
  // If AI is disabled or unavailable, use template
  if (!useAI || !isLLMAvailable()) {
    return {
      explanation: generateTemplateAffordabilityExplanation(calculation, purchase),
      aiUsed: false,
    };
  }
  
  try {
    const prompt = buildAffordabilityPrompt({
      decision: calculation.decision,
      confidence: calculation.confidence,
      purchaseAmount: purchase.amount,
      purchaseCategory: purchase.category,
      monthlyIncome: calculation.metrics.monthlyIncome,
      monthlyCashflow: calculation.metrics.monthlyCashflow,
      emergencyFundMonths: calculation.metrics.emergencyFundMonths,
      projectedCashBalance: calculation.impact.projectedCashBalance,
      reasonCodes: calculation.reasonCodes,
      recommendations: calculation.recommendations,
    });
    
    const explanation = await generateCompletion(prompt, {
      systemPrompt: SYSTEM_PROMPTS.AFFORDABILITY_ADVISOR,
      temperature: 0.3,
    });
    
    if (explanation) {
      return { explanation, aiUsed: true };
    }
  } catch (error) {
    console.error('AI synthesis error:', error);
  }
  
  // Fallback to template
  return {
    explanation: generateTemplateAffordabilityExplanation(calculation, purchase),
    aiUsed: false,
  };
}

/**
 * Template-based affordability explanation (fallback).
 */
function generateTemplateAffordabilityExplanation(
  calculation: AffordabilityCalculation,
  purchase: PurchaseRequest
): string {
  const { decision, metrics, impact, recommendations } = calculation;
  const purchaseStr = format(purchase.amount);
  
  let explanation = '';
  
  switch (decision) {
    case 'YES':
      explanation = `Good news! This ${purchaseStr} ${purchase.category} purchase looks affordable for you. `;
      explanation += `With ${format(metrics.monthlyCashflow)} in monthly cashflow and ${metrics.emergencyFundMonths.toFixed(1)} months of expenses saved, `;
      explanation += `you'll still have ${format(impact.projectedCashBalance)} and ${impact.monthsOfBufferRemaining.toFixed(1)} months of buffer after this purchase.`;
      break;
      
    case 'CONDITIONAL':
      explanation = `This ${purchaseStr} purchase is possible, but with some caution. `;
      explanation += `Your finances can technically support it, but it would leave you with only ${impact.monthsOfBufferRemaining.toFixed(1)} months of buffer. `;
      if (recommendations.length > 0) {
        explanation += `Consider: ${recommendations[0]}.`;
      }
      break;
      
    case 'DEFER':
      explanation = `I'd recommend waiting on this ${purchaseStr} purchase. `;
      explanation += `While it's not impossible, the timing isn't ideal. `;
      explanation += `Your current buffer of ${metrics.emergencyFundMonths.toFixed(1)} months would drop significantly. `;
      if (recommendations.length > 0) {
        explanation += `Instead, ${recommendations[0].toLowerCase()}.`;
      }
      break;
      
    case 'NO':
      explanation = `This ${purchaseStr} purchase isn't recommended right now. `;
      if (impact.projectedCashBalance < 0) {
        explanation += `It would put your cash balance in the negative. `;
      } else if (impact.monthsOfBufferRemaining < 1) {
        explanation += `It would leave you with less than a month of expenses as a safety net. `;
      }
      if (recommendations.length > 0) {
        explanation += `Here's what you can do instead: ${recommendations.slice(0, 2).join('. ')}.`;
      }
      break;
      
    default:
      explanation = `Based on the analysis, we recommend caution with this ${purchaseStr} purchase.`;
  }
  
  return explanation;
}

// =============================================================================
// DEBT PAYOFF SYNTHESIS
// =============================================================================

/**
 * Generate explanation for debt payoff plan.
 */
export async function synthesizeDebtExplanation(
  comparison: StrategyComparison,
  insights: DebtInsights,
  useAI: boolean = true
): Promise<{ explanation: string; aiUsed: boolean }> {
  if (!useAI || !isLLMAvailable()) {
    return {
      explanation: generateTemplateDebtExplanation(comparison, insights),
      aiUsed: false,
    };
  }
  
  try {
    const recommendedResult = comparison.strategies.find(
      (s) => s.strategy === comparison.recommendedStrategy
    );
    
    const prompt = buildDebtPayoffPrompt({
      recommendedStrategy: comparison.recommendedStrategy,
      totalDebt: insights.totalDebt,
      totalInterestPaid: recommendedResult?.totalInterestPaid ?? 0,
      monthsToPayoff: recommendedResult?.totalMonths ?? 0,
      debtFreeDate: insights.debtFreeDate,
      savingsVsMinimum: comparison.savingsVsMinimum,
      quickWins: insights.quickWins,
      highestAPRDebt: insights.highestAPRDebt ?? undefined,
    });
    
    const explanation = await generateCompletion(prompt, {
      systemPrompt: SYSTEM_PROMPTS.DEBT_ADVISOR,
      temperature: 0.3,
    });
    
    if (explanation) {
      return { explanation, aiUsed: true };
    }
  } catch (error) {
    console.error('AI synthesis error:', error);
  }
  
  return {
    explanation: generateTemplateDebtExplanation(comparison, insights),
    aiUsed: false,
  };
}

/**
 * Template-based debt explanation (fallback).
 */
function generateTemplateDebtExplanation(
  comparison: StrategyComparison,
  insights: DebtInsights
): string {
  const recommendedResult = comparison.strategies.find(
    (s) => s.strategy === comparison.recommendedStrategy
  );
  
  let explanation = '';
  
  // Strategy recommendation
  switch (comparison.recommendedStrategy) {
    case 'avalanche':
      explanation = `The avalanche method is your best bet for paying off ${format(insights.totalDebt)} in debt. `;
      explanation += `By targeting your highest-interest debt first, you'll save ${format(comparison.savingsVsMinimum)} in interest. `;
      break;
    case 'snowball':
      explanation = `The snowball method is recommended for your situation. `;
      explanation += `While you might pay a bit more in interest, the quick wins from paying off smaller debts first will help keep you motivated. `;
      break;
    case 'hybrid':
      explanation = `A hybrid approach balances interest savings with psychological wins. `;
      break;
    default:
      explanation = `Here's your personalized debt payoff plan. `;
  }
  
  // Timeline
  if (recommendedResult) {
    explanation += `Following this plan, you'll be debt-free in ${recommendedResult.totalMonths} months (by ${insights.debtFreeDate}). `;
  }
  
  // Quick wins
  if (insights.quickWins.length > 0) {
    explanation += `Good news: ${insights.quickWins[0]}.`;
  }
  
  // First step
  if (insights.highestAPRDebt && comparison.recommendedStrategy === 'avalanche') {
    explanation += ` Start by focusing extra payments on your ${insights.highestAPRDebt.name} (${insights.highestAPRDebt.apr}% APR).`;
  }
  
  return explanation;
}

// =============================================================================
// NEXT BEST ACTION SYNTHESIS
// =============================================================================

/**
 * Generate explanation for next best actions.
 */
export async function synthesizeNextBestActionExplanation(
  response: NextBestActionResponse,
  useAI: boolean = true
): Promise<{ explanation: string; aiUsed: boolean }> {
  if (!useAI || !isLLMAvailable()) {
    return {
      explanation: response.explanation, // Already has template explanation
      aiUsed: false,
    };
  }
  
  try {
    const prompt = buildNextBestActionPrompt({
      healthGrade: response.health_assessment.grade,
      healthScore: response.health_assessment.score,
      actions: response.actions.map((a) => ({
        title: a.title,
        description: a.description,
        urgency: a.urgency,
      })),
      strengths: response.health_assessment.strengths,
      concerns: response.health_assessment.concerns,
      keyMetrics: {
        monthlyCashflow: response.key_metrics.monthly_cashflow,
        emergencyFundMonths: response.key_metrics.emergency_fund_months,
        totalDebt: response.key_metrics.total_debt,
        savingsRate: response.key_metrics.savings_rate,
      },
    });
    
    const explanation = await generateCompletion(prompt, {
      systemPrompt: SYSTEM_PROMPTS.ACTION_ADVISOR,
      temperature: 0.4,
    });
    
    if (explanation) {
      return { explanation, aiUsed: true };
    }
  } catch (error) {
    console.error('AI synthesis error:', error);
  }
  
  return {
    explanation: response.explanation,
    aiUsed: false,
  };
}
