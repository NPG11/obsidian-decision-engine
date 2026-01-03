/**
 * Obsidian Decision Engine - Next Best Action API Endpoint
 * 
 * POST /api/v1/next-action
 * 
 * Analyzes user's financial situation and returns prioritized actions.
 * 
 * @module api/nextAction
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { UserFinancialProfileSchema } from '../models/types.js';
import { generateNextBestActions, NextBestActionRequestSchema } from '../core/actions/nextBestAction.js';
import { synthesizeNextBestActionExplanation } from '../ai/decisionSynthesizer.js';
import { OUTPUT_LIMITS } from '../config/limits.js';
import { validateProfileLimits, validateProfileConsistency } from '../utils/validation.js';
import { getIdempotentResponse, storeIdempotentResponse } from '../utils/idempotency.js';
import { ENGINE_VERSION } from '../config/constants.js';

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerNextActionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/next-action
   * 
   * Get prioritized financial actions.
   */
  fastify.post('/api/v1/next-action', {
    schema: {
      description: 'Get prioritized next best financial actions',
      tags: ['Decisions'],
      body: {
        type: 'object',
        required: ['user'],
        properties: {
          user: { type: 'object' },
          max_actions: { type: 'number' },
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
      const body = request.body as { 
        user: unknown; 
        max_actions?: number; 
        include_ai_explanation?: boolean 
      };
      
      // Validate user profile
      const userValidation = UserFinancialProfileSchema.safeParse(body.user);
      
      if (!userValidation.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid user financial profile',
            details: userValidation.error.flatten(),
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const maxActions = Math.min(
        body.max_actions ?? OUTPUT_LIMITS.DEFAULT_ACTIONS,
        OUTPUT_LIMITS.MAX_ACTIONS
      );
      const includeAI = body.include_ai_explanation ?? true;
      
      const limitErrors = [
        ...validateProfileLimits(userValidation.data),
        ...validateProfileConsistency({
          monthly_income: userValidation.data.monthly_income,
          monthly_fixed_expenses: userValidation.data.monthly_fixed_expenses,
          cash_balance: userValidation.data.cash_balance,
          debts: userValidation.data.debts,
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
      
      // Generate recommendations
      const response = generateNextBestActions(userValidation.data, maxActions);
      
      // Generate AI explanation if enabled
      const { explanation, aiUsed } = await synthesizeNextBestActionExplanation(
        response,
        includeAI
      );
      
      // Update response with final values
      response.explanation = explanation;
      response.metadata.ai_explanation_used = aiUsed;
      response.metadata.request_id = requestId;
      response.metadata.computation_time_ms = Date.now() - startTime;
      response.metadata.engine_version = ENGINE_VERSION;
      response.metadata.idempotency_key = idempotencyKey ?? null;
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
  
  /**
   * POST /api/v1/health-score
   * 
   * Get just the financial health score.
   */
  fastify.post('/api/v1/health-score', {
    schema: {
      description: 'Get financial health score and grade',
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
      const body = request.body as { user: unknown };
      
      const userValidation = UserFinancialProfileSchema.safeParse(body.user);
      
      if (!userValidation.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid user financial profile',
            details: userValidation.error.flatten(),
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const limitErrors = [
        ...validateProfileLimits(userValidation.data),
        ...validateProfileConsistency({
          monthly_income: userValidation.data.monthly_income,
          monthly_fixed_expenses: userValidation.data.monthly_fixed_expenses,
          cash_balance: userValidation.data.cash_balance,
          debts: userValidation.data.debts,
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
      
      // Generate full response but only return health assessment
      const fullResponse = generateNextBestActions(userValidation.data, 0);
      
      const response = {
        health_assessment: fullResponse.health_assessment,
        key_metrics: fullResponse.key_metrics,
        metadata: {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          idempotency_key: idempotencyKey ?? null,
          computation_time_ms: Date.now() - startTime,
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
