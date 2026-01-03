/**
 * Obsidian Decision Engine - Health Check Endpoints
 * 
 * System health and monitoring endpoints.
 * 
 * @module api/health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { isLLMAvailable } from '../ai/llmClient.js';
import { ENGINE_VERSION, ENVIRONMENT } from '../config/constants.js';

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * 
   * Basic health check.
   */
  fastify.get('/health', {
    schema: {
      description: 'Basic health check',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /health/detailed
   * 
   * Detailed health check with component status.
   */
  fastify.get('/health/detailed', {
    schema: {
      description: 'Detailed health check with component status',
      tags: ['System'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const components = {
      api: { status: 'healthy', latency_ms: 0 },
      calculation_engine: { status: 'healthy' },
      ai_service: { 
        status: isLLMAvailable() ? 'healthy' : 'unavailable',
        fallback_available: true,
      },
    };

    const overallStatus = Object.values(components).every(
      (c) => c.status === 'healthy' || c.status === 'unavailable'
    ) ? 'healthy' : 'degraded';

    return reply.status(200).send({
      status: overallStatus,
      version: ENGINE_VERSION,
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      components,
      environment: ENVIRONMENT,
    });
  });

  /**
   * GET /ready
   * 
   * Readiness probe for Kubernetes/container orchestration.
   */
  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe',
      tags: ['System'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Add any startup checks here
    return reply.status(200).send({ ready: true });
  });

  /**
   * GET /live
   * 
   * Liveness probe for Kubernetes/container orchestration.
   */
  fastify.get('/live', {
    schema: {
      description: 'Liveness probe',
      tags: ['System'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ alive: true });
  });
}
