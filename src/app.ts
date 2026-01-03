/**
 * Obsidian Decision Engine - Main Application
 * 
 * Fastify application setup with all plugins and routes.
 * 
 * @module app
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { registerHealthRoutes } from './api/health.js';
import { registerAffordabilityRoutes } from './api/afford.js';
import { registerDebtRoutes } from './api/debt.js';
import { registerNextActionRoutes } from './api/nextAction.js';
import { RATE_LIMITS } from './config/limits.js';
import { ENGINE_VERSION } from './config/constants.js';

// =============================================================================
// APPLICATION FACTORY
// =============================================================================

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production' 
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // ==========================================================================
  // PLUGINS
  // ==========================================================================

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: RATE_LIMITS.REQUESTS_PER_MINUTE,
    timeWindow: RATE_LIMITS.WINDOW_MS,
    keyGenerator: (request) => {
      // Use API key if present, otherwise IP
      return (request.headers['x-api-key'] as string) ?? request.ip;
    },
    errorResponseBuilder: (request, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        retry_after_seconds: Math.ceil(context.ttl / 1000),
      },
    }),
  });

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Obsidian Decision Engine API',
        description: 'B2B AI Financial Decision Infrastructure for Fintech Applications',
        version: '1.0.0',
        contact: {
          name: 'Obsidian Financial Technologies',
          email: 'api@obsidian.finance',
        },
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' },
        { url: 'https://api.obsidian.finance', description: 'Production' },
      ],
      tags: [
        { name: 'Decisions', description: 'Financial decision endpoints' },
        { name: 'System', description: 'Health and monitoring' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // ==========================================================================
  // HOOKS
  // ==========================================================================

  // API Key validation (optional - can be disabled for development)
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for health/docs endpoints
    const publicPaths = ['/health', '/ready', '/live', '/docs'];
    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    // Skip auth in development if no API key is configured
    const requiredApiKey = process.env.API_KEY;
    if (!requiredApiKey || process.env.NODE_ENV === 'development') {
      return;
    }

    const providedKey = request.headers['x-api-key'];
    if (providedKey !== requiredApiKey) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing API key',
        },
      });
    }
  });

  // Request logging
  fastify.addHook('onRequest', async (request) => {
    request.log.info({ url: request.url, method: request.method }, 'Incoming request');
  });

  // Response time header
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-ID', request.id);
    reply.header('X-Response-Time', `${reply.elapsedTime}ms`);
  });

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // Health check routes
  await registerHealthRoutes(fastify);

  // Decision engine routes
  await registerAffordabilityRoutes(fastify);
  await registerDebtRoutes(fastify);
  await registerNextActionRoutes(fastify);

  // Root endpoint
  fastify.get('/', async (request, reply) => {
    return reply.send({
      name: 'Obsidian Decision Engine',
      version: '1.0.0',
      description: 'B2B AI Financial Decision Infrastructure',
      documentation: '/docs',
      health: '/health',
      endpoints: {
        affordability: 'POST /api/v1/affordability',
        debt_payoff: 'POST /api/v1/debt/payoff-plan',
        next_action: 'POST /api/v1/next-action',
        health_score: 'POST /api/v1/health-score',
      },
      engine_version: ENGINE_VERSION,
    });
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation,
        },
      });
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
        },
      });
    }

    // Generic error response
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR',
        message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
      },
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  return fastify;
}
