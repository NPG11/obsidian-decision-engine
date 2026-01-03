/**
 * Obsidian Decision Engine - Idempotency Cache
 *
 * Lightweight in-memory idempotency handler for POST endpoints.
 * Intended for stateless deployments; swap with Redis/DB for distributed setups.
 *
 * @module utils/idempotency
 */

import crypto from 'crypto';
import { IDEMPOTENCY_TTL_MS } from '../config/constants.js';

type CachedResponse = {
  bodyHash: string;
  payload: unknown;
  statusCode: number;
  expiresAt: number;
};

const cache = new Map<string, CachedResponse>();

function hashBody(body: unknown): string {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  } catch {
    return 'unhashable';
  }
}

/**
 * Retrieve a cached response for an idempotency key.
 * If the stored body hash differs from the current request, returns conflict=true.
 */
export function getIdempotentResponse(
  key: string | undefined,
  body: unknown
): { statusCode: number; payload: unknown } | { conflict: true } | null {
  if (!key) return null;

  const cached = cache.get(key);
  if (!cached) return null;

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  const bodyHash = hashBody(body);
  if (cached.bodyHash !== bodyHash) {
    return { conflict: true };
  }

  return { statusCode: cached.statusCode, payload: cached.payload };
}

/**
 * Store a response for an idempotency key.
 */
export function storeIdempotentResponse(
  key: string | undefined,
  body: unknown,
  statusCode: number,
  payload: unknown
): void {
  if (!key) return;

  cache.set(key, {
    bodyHash: hashBody(body),
    statusCode,
    payload,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}
