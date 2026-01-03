/**
 * Obsidian Decision Engine - Shared Constants
 *
 * Centralized shared constants for versioning and defaults.
 *
 * @module config/constants
 */

export const ENGINE_VERSION = process.env.ENGINE_VERSION ?? '1.0.0';
export const ENVIRONMENT = process.env.NODE_ENV ?? 'development';

// Idempotency cache TTL (ms). Default: 10 minutes.
export const IDEMPOTENCY_TTL_MS = parseInt(process.env.IDEMPOTENCY_TTL_MS ?? '600000', 10);
