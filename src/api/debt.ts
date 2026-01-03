/**
 * Obsidian Decision Engine - Debt Payoff API Endpoint
 * 
 * POST /api/v1/debt/payoff-plan
 * 
 * Generates optimal debt payoff strategies and simulations.
 * 
 * @module api/debt
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { DebtPayoffRequestSchema } from '../core/debt/debtTypes.js';
import {
  simulateStrategy,
  compareStrategies,
  generateDebtInsights,
} from '../core/debt/debtSimulator.js';
import { getStrategyDescription } from '../core/debt/payoffStrategies.js';
import { synthesizeDebtExplanation } from '../ai/decisionSynthesizer.js';
import type { DebtPayoffPlan, DebtStrategySummary, DebtPayoffMonth } from '../models/DecisionResponse.js';
import { OUTPUT_LIMITS } from '../config/limits.js';
import { validateProfileLimits, validateProfileConsistency } from '../utils/validation.js';
import { getIdempotentResponse, storeIdempotentResponse } from '../utils/idempotency.js';
import { ENGINE_VERSION } from '../config/constants.js';
import { z } from 'zod';
import { DebtAccountSchema } from '../models/types.js';

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerDebtRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/debt/payoff-plan
   * 
   * Generate debt payoff plan.
   */
  fastify.post('/api/v1/debt/payoff-plan', {
    schema: {
      description: 'Generate optimal debt payoff strategy and simulation',
      tags: ['Decisions'],
      body: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { type: 'object' },
          extra_monthly_payment: { type: 'number' },
          strategy: { type: 'string' },
          include_schedule: { type: 'boolean' },
          max_months: { type: 'number' },
          include_ai_explanation: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
    
    const cached = getIdempotentResponse(idempotencyKey, request.body);
    if (cached) {
      if ('conflict' in cached) {
        return reply.status(409).send({
          error: {
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Idempotency key has been used with a different payload',
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      reply.header('X-Idempotent-Replay', 'true');
      if (idempotencyKey) reply.header('X-Idempotency-Key', idempotencyKey);
      return reply.status(cached.statusCode).send(cached.payload);
    }
    
    try {
      // Validate input
      const validationResult = DebtPayoffRequestSchema.safeParse(request.body);
      
      if (!validationResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.flatten(),
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const {
        user,
        extra_monthly_payment = 100,
        strategy,
        include_schedule = true,
        max_months = 360,
        include_ai_explanation = true,
      } = validationResult.data;
      
      const limitErrors = [
        ...validateProfileLimits(user),
        ...validateProfileConsistency({
          monthly_income: user.monthly_income,
          monthly_fixed_expenses: user.monthly_fixed_expenses,
          cash_balance: user.cash_balance,
          debts: user.debts,
        }),
      ];
      
      if (limitErrors.length > 0) {
        return reply.status(400).send({
          error: {
            code: 'LIMITS_EXCEEDED',
            message: 'Input exceeds allowed limits or is inconsistent',
            details: limitErrors,
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      // Check if user has any debt
      if (!user.debts || user.debts.length === 0 || user.debts.every((d: { balance: number }) => d.balance <= 0)) {
        const response = {
          message: 'Congratulations! You have no debt to pay off.',
          recommended_strategy: null,
          strategy_comparison: [],
          monthly_schedule: [],
          insights: {
            total_debt: 0,
            potential_interest_savings: 0,
            debt_free_date: 'Already debt-free!',
            quick_wins: [],
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            engine_version: ENGINE_VERSION,
            idempotency_key: idempotencyKey ?? null,
            computation_time_ms: Date.now() - startTime,
            ai_explanation_used: false,
          },
        };
        if (idempotencyKey) reply.header('X-Idempotency-Key', idempotencyKey);
        storeIdempotentResponse(idempotencyKey, request.body, 200, response);
        return reply.status(200).send(response);
      }
      
      // Run strategy comparison
      const comparison = compareStrategies(
        user.debts,
        extra_monthly_payment,
        max_months
      );
      
      // Generate insights
      const insights = generateDebtInsights(user.debts, comparison);
      
      // Generate explanation
      const { explanation, aiUsed } = await synthesizeDebtExplanation(
        comparison,
        insights,
        include_ai_explanation
      );
      
      // Get recommended strategy result
      const recommendedResult = comparison.strategies.find(
        (s) => s.strategy === comparison.recommendedStrategy
      );
      
      // Format strategy summaries
      const strategySummaries: DebtStrategySummary[] = comparison.strategies.map((s) => ({
        strategy_name: s.strategy,
        total_months_to_payoff: s.totalMonths,
        total_interest_paid: s.totalInterestPaid,
        total_amount_paid: s.totalAmountPaid,
        monthly_payment_required: s.monthlyPaymentRequired,
        payoff_order: s.payoffOrder.map((p) => ({
          debt_id: p.debtId,
          debt_name: p.debtName,
          months_to_payoff: p.monthsToPayoff,
          interest_paid: p.interestPaid,
        })),
      }));
      
      // Format monthly schedule (limited)
      const monthlySchedule: DebtPayoffMonth[] = include_schedule && recommendedResult
        ? recommendedResult.schedule
            .slice(0, OUTPUT_LIMITS.MAX_SIMULATION_MONTHS_RETURNED)
            .map((m) => ({
              month: m.month,
              date: m.date,
              payments: m.payments.map((p) => ({
                debt_id: p.debtId,
                debt_name: p.debtName,
                payment_amount: p.paymentAmount,
                principal_paid: p.principalPaid,
                interest_paid: p.interestPaid,
                remaining_balance: p.remainingBalance,
              })),
              total_payment: m.totalPayment,
              total_remaining_debt: m.totalRemainingDebt,
              debts_paid_off_this_month: m.debtsPaidOffThisMonth,
            }))
        : [];
      
      // Determine risk level
      const riskLevel = recommendedResult && recommendedResult.totalMonths > 120
        ? 'HIGH'
        : recommendedResult && recommendedResult.totalMonths > 60
          ? 'MODERATE'
          : 'LOW';
      
      // Build response
      const response: DebtPayoffPlan = {
        recommended_strategy: comparison.recommendedStrategy,
        recommendation_reason: comparison.recommendationReason,
        strategy_comparison: strategySummaries,
        monthly_schedule: monthlySchedule,
        insights: {
          potential_interest_savings: comparison.savingsVsMinimum,
          debt_free_date: insights.debtFreeDate,
          highest_interest_debt: insights.highestAPRDebt?.name ?? 'N/A',
          quick_wins: insights.quickWins,
        },
        explanation,
        risk_level: riskLevel,
        confidence: 0.9, // High confidence for deterministic calculations
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          idempotency_key: idempotencyKey ?? null,
          computation_time_ms: Date.now() - startTime,
          ai_explanation_used: aiUsed,
        },
      };
      if (idempotencyKey) reply.header('X-Idempotency-Key', idempotencyKey);
      storeIdempotentResponse(idempotencyKey, request.body, 200, response);
      return reply.status(200).send(response);
      
    } catch (error) {
      fastify.log.error(error);
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });
  
  const DebtSimulationSchema = z.object({
    debts: z.array(DebtAccountSchema),
    strategy: z.enum(['avalanche', 'snowball', 'hybrid', 'minimum_only']),
    extra_monthly_payment: z.number().nonnegative().optional(),
    max_months: z.number().int().min(1).max(480).optional(),
  });
  
  /**
   * POST /api/v1/debt/simulate
   * 
   * Run a single strategy simulation.
   */
  fastify.post('/api/v1/debt/simulate', {
    schema: {
      description: 'Run a single debt payoff strategy simulation',
      tags: ['Decisions'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
    
    const cached = getIdempotentResponse(idempotencyKey, request.body);
    if (cached) {
      if ('conflict' in cached) {
        return reply.status(409).send({
          error: {
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Idempotency key has been used with a different payload',
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      reply.header('X-Idempotent-Replay', 'true');
      if (idempotencyKey) reply.header('X-Idempotency-Key', idempotencyKey);
      return reply.status(cached.statusCode).send(cached.payload);
    }
    
    try {
      const validationResult = DebtSimulationSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const body = validationResult.data;
      
      const limitErrors = [
        ...validateProfileLimits({
          monthly_income: 0,
          monthly_fixed_expenses: 0,
          cash_balance: 0,
          debts: body.debts,
        } as any),
      ];
      
      if (limitErrors.length > 0) {
        return reply.status(400).send({
          error: {
            code: 'LIMITS_EXCEEDED',
            message: 'Input exceeds allowed limits or is inconsistent',
            details: limitErrors,
          },
          metadata: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const result = simulateStrategy(
        body.debts,
        body.strategy,
        body.extra_monthly_payment ?? 0,
        body.max_months ?? 360
      );
      
      const response = {
        strategy: result.strategy,
        strategy_description: getStrategyDescription(result.strategy),
        total_months: result.totalMonths,
        total_interest_paid: result.totalInterestPaid,
        total_amount_paid: result.totalAmountPaid,
        monthly_payment: result.monthlyPaymentRequired,
        payoff_order: result.payoffOrder,
        schedule_preview: result.schedule.slice(0, 12), // First year only
        metadata: {
          request_id: requestId,
          computation_time_ms: Date.now() - startTime,
          engine_version: ENGINE_VERSION,
          idempotency_key: idempotencyKey ?? null,
        },
      };
      if (idempotencyKey) reply.header('X-Idempotency-Key', idempotencyKey);
      storeIdempotentResponse(idempotencyKey, request.body, 200, response);
      return reply.status(200).send(response);
      
    } catch (error) {
      fastify.log.error(error);
      
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          request_id: requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });
}
