/**
 * Obsidian Decision Engine - LLM Client
 * 
 * Abstracted LLM client for explanation synthesis.
 * Supports OpenAI API and compatible providers (Anthropic, local Ollama, etc.)
 * 
 * CRITICAL: The LLM is ONLY used for natural language generation.
 * ALL financial calculations are done deterministically before this step.
 * 
 * @module ai/llmClient
 */

import OpenAI from 'openai';
import { COMPUTATION_LIMITS } from '../config/limits.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

function getConfig(): LLMConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseURL: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL ?? 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? '500', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE ?? '0.3'),
    timeout: COMPUTATION_LIMITS.LLM_TIMEOUT_MS,
  };
}

// =============================================================================
// CLIENT INITIALIZATION
// =============================================================================

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const config = getConfig();
    
    client = new OpenAI({
      apiKey: config.apiKey || 'dummy-key', // Allow dummy for testing
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
  }
  
  return client;
}

/**
 * Check if LLM is configured and available.
 */
export function isLLMAvailable(): boolean {
  const config = getConfig();
  return Boolean(config.apiKey) && config.apiKey !== 'dummy-key';
}

// =============================================================================
// COMPLETION FUNCTIONS
// =============================================================================

export interface CompletionOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Generate a completion from the LLM.
 * 
 * @param prompt The user prompt
 * @param options Optional configuration overrides
 * @returns The generated text or null if unavailable
 */
export async function generateCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string | null> {
  if (!isLLMAvailable()) {
    return null;
  }
  
  const config = getConfig();
  const openai = getClient();
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }
    
    messages.push({
      role: 'user',
      content: prompt,
    });
    
    const response = await openai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
    });
    
    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error('LLM completion error:', error);
    return null;
  }
}

/**
 * Generate a streaming completion from the LLM.
 */
export async function* generateStreamingCompletion(
  prompt: string,
  options: CompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  if (!isLLMAvailable()) {
    return;
  }
  
  const config = getConfig();
  const openai = getClient();
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }
    
    messages.push({
      role: 'user',
      content: prompt,
    });
    
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error('LLM streaming error:', error);
  }
}

// =============================================================================
// STRUCTURED OUTPUT
// =============================================================================

/**
 * Generate a structured JSON response from the LLM.
 * Uses JSON mode to ensure valid output.
 */
export async function generateStructuredOutput<T>(
  prompt: string,
  options: CompletionOptions = {}
): Promise<T | null> {
  if (!isLLMAvailable()) {
    return null;
  }
  
  const config = getConfig();
  const openai = getClient();
  
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    const systemPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\nYou must respond with valid JSON only.`
      : 'You are a helpful assistant. Respond with valid JSON only.';
    
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
    
    messages.push({
      role: 'user',
      content: prompt,
    });
    
    const response = await openai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('LLM structured output error:', error);
    return null;
  }
}

// =============================================================================
// RESET (for testing)
// =============================================================================

export function resetClient(): void {
  client = null;
}
