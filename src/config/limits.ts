/**
 * Obsidian Decision Engine - System Limits Configuration
 * 
 * Rate limits, size constraints, and operational boundaries.
 * 
 * @module config/limits
 */

// =============================================================================
// API RATE LIMITS
// =============================================================================

export const RATE_LIMITS = {
  /** Requests per minute per API key */
  REQUESTS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  
  /** Window size in milliseconds */
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  
  /** Burst allowance (requests allowed in quick succession) */
  BURST_LIMIT: 10,
  
  /** Delay after rate limit hit (ms) */
  RETRY_AFTER_MS: 5000,
} as const;

// =============================================================================
// INPUT VALIDATION LIMITS
// =============================================================================

export const INPUT_LIMITS = {
  /** Maximum number of debt accounts per user */
  MAX_DEBT_ACCOUNTS: 50,
  
  /** Maximum number of income sources per user */
  MAX_INCOME_SOURCES: 20,
  
  /** Maximum number of expense entries per user */
  MAX_EXPENSES: 100,
  
  /** Maximum number of transactions for analysis */
  MAX_TRANSACTIONS: 1000,
  
  /** Maximum purchase amount (sanity check) */
  MAX_PURCHASE_AMOUNT: 10_000_000, // $10M
  
  /** Maximum annual income (sanity check) */
  MAX_ANNUAL_INCOME: 100_000_000, // $100M
  
  /** Maximum debt balance (sanity check) */
  MAX_DEBT_BALANCE: 50_000_000, // $50M
  
  /** Maximum description length */
  MAX_DESCRIPTION_LENGTH: 500,
  
  /** Maximum metadata object size in bytes */
  MAX_METADATA_SIZE: 10_000,
} as const;

// =============================================================================
// OUTPUT LIMITS
// =============================================================================

export const OUTPUT_LIMITS = {
  /** Maximum number of recommended actions to return */
  MAX_ACTIONS: 10,
  
  /** Default number of actions to return */
  DEFAULT_ACTIONS: 5,
  
  /** Maximum number of months in debt simulation to return */
  MAX_SIMULATION_MONTHS_RETURNED: 120,
  
  /** Maximum explanation length (characters) */
  MAX_EXPLANATION_LENGTH: 2000,
  
  /** Maximum number of alternative strategies */
  MAX_ALTERNATIVES: 5,
} as const;

// =============================================================================
// COMPUTATION LIMITS
// =============================================================================

export const COMPUTATION_LIMITS = {
  /** Maximum time for a single decision (ms) */
  MAX_DECISION_TIME_MS: 10_000,
  
  /** Maximum time for AI explanation generation (ms) */
  MAX_AI_TIME_MS: 5_000,
  
  /** Maximum iterations for debt simulation */
  MAX_SIMULATION_ITERATIONS: 500,
  
  /** Timeout for external LLM calls (ms) */
  LLM_TIMEOUT_MS: 30_000,
} as const;

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

export const CACHE_CONFIG = {
  /** TTL for decision cache (ms) */
  DECISION_CACHE_TTL_MS: 60_000, // 1 minute
  
  /** TTL for explanation cache (ms) */
  EXPLANATION_CACHE_TTL_MS: 300_000, // 5 minutes
  
  /** Maximum cache entries */
  MAX_CACHE_ENTRIES: 1000,
} as const;

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

export const LOGGING = {
  /** Log level */
  LEVEL: process.env.LOG_LEVEL ?? 'info',
  
  /** Whether to include request bodies in logs */
  LOG_REQUEST_BODIES: process.env.NODE_ENV !== 'production',
  
  /** Whether to include response bodies in logs */
  LOG_RESPONSE_BODIES: process.env.NODE_ENV !== 'production',
  
  /** Maximum length of logged strings */
  MAX_LOG_STRING_LENGTH: 1000,
} as const;
