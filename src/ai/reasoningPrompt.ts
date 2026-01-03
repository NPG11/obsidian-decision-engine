/**
 * Obsidian Decision Engine - AI Reasoning Prompts
 * 
 * Prompt templates for LLM explanation synthesis.
 * These prompts take deterministic calculation results and
 * generate human-friendly explanations.
 * 
 * @module ai/reasoningPrompt
 */

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

export const SYSTEM_PROMPTS = {
  /**
   * Base financial advisor persona.
   */
  FINANCIAL_ADVISOR: `You are a knowledgeable, empathetic financial advisor providing clear, actionable guidance. 
Your explanations should be:
- Clear and jargon-free (explain any financial terms you use)
- Empathetic and non-judgmental
- Actionable with specific next steps
- Honest about trade-offs and risks
- Encouraging while being realistic

Never invent numbers or statistics. Only reference data provided to you.
Keep responses concise - aim for 2-3 paragraphs maximum.`,

  /**
   * Affordability decision explanation persona.
   */
  AFFORDABILITY_ADVISOR: `You are a financial advisor helping someone make a purchase decision.
Your job is to take the analysis results and explain them in a friendly, clear way.

Rules:
- Never make up numbers - only use what's provided
- Be direct about the recommendation but empathetic
- Focus on the most important 2-3 factors
- Provide specific, actionable alternatives if the answer isn't "yes"
- Keep it conversational, not formal

Response length: 2-3 short paragraphs.`,

  /**
   * Debt payoff advisor persona.
   */
  DEBT_ADVISOR: `You are a debt payoff specialist helping someone create a plan to become debt-free.
Your explanations should motivate while being realistic.

Rules:
- Celebrate small wins (like debts that can be paid off quickly)
- Explain the strategy recommendation clearly
- Use specific numbers from the analysis
- Acknowledge the emotional weight of debt
- Keep tone encouraging but practical

Response length: 2-3 paragraphs.`,

  /**
   * Next best action advisor persona.
   */
  ACTION_ADVISOR: `You are a personal finance coach providing prioritized action items.
Help the user understand why these actions matter and how to get started.

Rules:
- Explain the "why" behind each priority
- Make first steps concrete and achievable
- Acknowledge their current situation fairly
- Connect actions to their overall financial health
- Keep it motivating without being preachy

Response length: 3-4 short paragraphs.`,
};

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

/**
 * Generate prompt for affordability explanation.
 */
export function buildAffordabilityPrompt(data: {
  decision: string;
  confidence: number;
  purchaseAmount: number;
  purchaseCategory: string;
  monthlyIncome: number;
  monthlyCashflow: number;
  emergencyFundMonths: number;
  projectedCashBalance: number;
  reasonCodes: string[];
  recommendations: string[];
}): string {
  return `Please explain this affordability analysis to the user in a friendly, clear way.

ANALYSIS RESULTS:
- Decision: ${data.decision}
- Confidence: ${(data.confidence * 100).toFixed(0)}%
- Purchase: $${data.purchaseAmount.toLocaleString()} (${data.purchaseCategory})

USER'S SITUATION:
- Monthly income: $${data.monthlyIncome.toLocaleString()}
- Monthly cashflow (after expenses): $${data.monthlyCashflow.toLocaleString()}
- Emergency fund: ${data.emergencyFundMonths.toFixed(1)} months of expenses
- Cash after purchase would be: $${data.projectedCashBalance.toLocaleString()}

KEY FACTORS:
${data.reasonCodes.map((code) => `- ${formatReasonCode(code)}`).join('\n')}

${data.recommendations.length > 0 ? `RECOMMENDATIONS:\n${data.recommendations.map((r) => `- ${r}`).join('\n')}` : ''}

Write a 2-3 paragraph explanation that:
1. States the decision clearly upfront
2. Explains the main reasons why
3. ${data.decision === 'YES' ? 'Confirms this is a good choice' : 'Provides specific alternatives or next steps'}`;
}

/**
 * Generate prompt for debt payoff explanation.
 */
export function buildDebtPayoffPrompt(data: {
  recommendedStrategy: string;
  totalDebt: number;
  totalInterestPaid: number;
  monthsToPayoff: number;
  debtFreeDate: string;
  savingsVsMinimum: number;
  quickWins: string[];
  highestAPRDebt?: { name: string; apr: number; balance: number };
}): string {
  return `Please explain this debt payoff analysis to the user.

RECOMMENDED STRATEGY: ${data.recommendedStrategy.toUpperCase()}

DEBT OVERVIEW:
- Total debt: $${data.totalDebt.toLocaleString()}
- Time to payoff: ${data.monthsToPayoff} months
- Debt-free date: ${data.debtFreeDate}
- Total interest you'll pay: $${data.totalInterestPaid.toLocaleString()}
- Interest saved vs minimum payments: $${data.savingsVsMinimum.toLocaleString()}

${data.highestAPRDebt ? `HIGHEST PRIORITY DEBT:\n- ${data.highestAPRDebt.name}: ${data.highestAPRDebt.apr}% APR, $${data.highestAPRDebt.balance.toLocaleString()} balance` : ''}

${data.quickWins.length > 0 ? `QUICK WINS (payable in 3 months or less):\n${data.quickWins.map((w) => `- ${w}`).join('\n')}` : ''}

Write a 2-3 paragraph explanation that:
1. Explains why ${data.recommendedStrategy} is the best strategy for their situation
2. Highlights the debt-free date and savings
3. Gives them a clear first step to start`;
}

/**
 * Generate prompt for next best action explanation.
 */
export function buildNextBestActionPrompt(data: {
  healthGrade: string;
  healthScore: number;
  actions: Array<{ title: string; description: string; urgency: string }>;
  strengths: string[];
  concerns: string[];
  keyMetrics: {
    monthlyCashflow: number;
    emergencyFundMonths: number;
    totalDebt: number;
    savingsRate: number;
  };
}): string {
  return `Please provide a motivating summary of this financial health assessment.

OVERALL HEALTH:
- Grade: ${data.healthGrade}
- Score: ${data.healthScore}/100

KEY METRICS:
- Monthly cashflow: $${data.keyMetrics.monthlyCashflow.toLocaleString()}
- Emergency fund: ${data.keyMetrics.emergencyFundMonths.toFixed(1)} months
- Total debt: $${data.keyMetrics.totalDebt.toLocaleString()}
- Savings rate: ${(data.keyMetrics.savingsRate * 100).toFixed(0)}%

STRENGTHS:
${data.strengths.map((s) => `- ${s}`).join('\n')}

CONCERNS:
${data.concerns.map((c) => `- ${c}`).join('\n')}

TOP 3 PRIORITIES:
${data.actions.slice(0, 3).map((a, i) => `${i + 1}. ${a.title} (${a.urgency})\n   ${a.description}`).join('\n')}

Write a 3-4 paragraph explanation that:
1. Acknowledges where they are (grade) without being judgmental
2. Celebrates their strengths
3. Explains the top priority and why it matters most
4. Ends with an encouraging call to action`;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert reason codes to human-readable strings.
 */
function formatReasonCode(code: string): string {
  const mappings: Record<string, string> = {
    POSITIVE_CASHFLOW: 'Positive monthly cashflow',
    NEGATIVE_CASHFLOW: 'Negative monthly cashflow',
    CASHFLOW_AT_RISK: 'Cashflow at risk',
    INSUFFICIENT_BUFFER: 'Insufficient emergency buffer',
    HEALTHY_BUFFER: 'Healthy emergency buffer',
    HIGH_DEBT_TO_INCOME: 'High debt-to-income ratio',
    ACCEPTABLE_DEBT_TO_INCOME: 'Acceptable debt-to-income ratio',
    HIGH_CREDIT_UTILIZATION: 'High credit card utilization',
    LOW_CREDIT_UTILIZATION: 'Low credit utilization',
    HIGH_INTEREST_DEBT: 'High interest rate debt present',
    DEBT_FREE: 'No debt',
    EMERGENCY_FUND_INADEQUATE: 'Emergency fund below recommended level',
    EMERGENCY_FUND_ADEQUATE: 'Adequate emergency fund',
    SAVINGS_DEPLETED: 'Savings would be depleted',
    SAVINGS_HEALTHY: 'Healthy savings level',
    AFFORDABLE_PURCHASE: 'Purchase is affordable',
    UNAFFORDABLE_PURCHASE: 'Purchase is not affordable',
    PURCHASE_STRAINS_BUDGET: 'Purchase strains the budget',
    LUXURY_WHILE_IN_DEBT: 'Non-essential purchase while carrying debt',
    FINANCING_RECOMMENDED: 'Financing recommended',
    CASH_PURCHASE_OK: 'Cash purchase is reasonable',
    STABLE_INCOME: 'Stable income',
    VARIABLE_INCOME_RISK: 'Variable income adds risk',
  };
  
  return mappings[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

/**
 * Build a concise summary from key factors.
 */
export function buildFactorSummary(factors: string[]): string {
  if (factors.length === 0) return 'All factors look good.';
  if (factors.length === 1) return factors[0]!;
  if (factors.length === 2) return `${factors[0]} and ${factors[1]}`;
  
  const last = factors[factors.length - 1];
  const rest = factors.slice(0, -1);
  return `${rest.join(', ')}, and ${last}`;
}
