/**
 * Obsidian Decision Engine - Affordability API Endpoint
 * 
 * POST /api/v1/affordability
 * 
 * Evaluates whether a user can afford a proposed purchase.
 * 
 * @module api/afford
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AffordabilityRequestSchema } from '../core/affordability/affordTypes.js';
import { calculateAffordability } from '../core/affordability/affordCalculator.js';
import { synthesizeAffordabilityExplanation } from '../ai/decisionSynthesizer.js';
import { getRuleExplanations } from '../core/affordability/affordRules.js';
import type { AffordabilityDecision } from '../models/DecisionResponse.js';
import {
  validateProfileConsistency,
  validateProfileLimits,
  validatePurchaseLimits,
} from '../utils/validation.js';
import { getIdempotentResponse, storeIdempotentResponse } from '../utils/idempotency.js';
import { ENGINE_VERSION } from '../config/constants.js';

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerAffordabilityRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/affordability
   * 
   * Evaluate purchase affordability.
   */
  fastify.post('/api/v1/affordability', {
    schema: {
      description: 'Evaluate whether a user can afford a proposed purchase',
      tags: ['Decisions'],
      body: {
        type: 'object',
        required: ['user', 'purchase'],
        properties: {
          user: { type: 'object' },
          purchase: { type: 'object' },
          confidence_threshold: { type: 'number' },
          include_simulation: { type: 'boolean' },
          include_ai_explanation: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            confidence: { type: 'number' },
            reason_codes: { type: 'array', items: { type: 'string' } },
            explanation: { type: 'string' },
            risk_level: { type: 'string' },
            recommended_plan: { type: 'array', items: { type: 'string' } },
            impact_analysis: { type: 'object' },
            alternatives: { type: 'array' },
            metadata: { type: 'object' },
          },
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
      const validationResult = AffordabilityRequestSchema.safeParse(request.body);
      
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
      
      const { user, purchase, include_ai_explanation = true } = validationResult.data;
      
      // Enforce limits and consistency checks
      const limitErrors = [
        ...validateProfileLimits(user),
        ...validateProfileConsistency({
          monthly_income: user.monthly_income,
          monthly_fixed_expenses: user.monthly_fixed_expenses,
          cash_balance: user.cash_balance,
          debts: user.debts,
        }),
        ...validatePurchaseLimits(purchase),
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
      
      // Perform deterministic calculation
      const calculation = calculateAffordability(user, purchase);
      
      // Generate explanation (AI or template)
      const { explanation, aiUsed } = await synthesizeAffordabilityExplanation(
        calculation,
        purchase,
        include_ai_explanation
      );
      
      // Get detailed rule explanations
      const ruleExplanations = getRuleExplanations(calculation.ruleEvaluation.rules);
      
      // Build response
      const response: AffordabilityDecision = {
        decision: calculation.decision,
        confidence: Math.round(calculation.confidence * 100) / 100,
        confidence_details: {
          overall: calculation.confidence,
          factors: {
            data_quality: 0.9, // Could be calculated based on input completeness
            rule_clarity: calculation.ruleEvaluation.weightedScore,
          },
        },
        reason_codes: calculation.reasonCodes,
        explanation,
        explanation_details: {
          summary: explanation,
          key_factors: ruleExplanations.slice(0, 4),
          risks: calculation.recommendations,
          opportunities: calculation.alternatives.map((a) => a.description),
        },
        risk_level: calculation.riskLevel,
        recommended_plan: calculation.recommendations,
        impact_analysis: {
          projected_cash_balance: calculation.impact.projectedCashBalance,
          months_of_buffer_remaining: calculation.impact.monthsOfBufferRemaining,
          new_monthly_cashflow: calculation.impact.newMonthlyCashflow ?? undefined,
          new_debt_to_income: calculation.impact.newDebtToIncomeRatio ?? undefined,
          credit_utilization_change: calculation.impact.creditUtilizationChange ?? undefined,
        },
        alternatives: calculation.alternatives,
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          idempotency_key: idempotencyKey ?? null,
          computation_time_ms: Date.now() - startTime,
          ai_explanation_used: aiUsed,
          rules_evaluated: calculation.ruleEvaluation.rules.map((r) => r.ruleId),
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
