/**
 * AI Service Abstraction
 * Provides a unified interface for different AI providers (Gemini, Ollama)
 * Allows switching between cloud and local models
 */

import { sendGeminiMessage, GeminiResponse } from './geminiService';
import { sendOllamaMessage, checkOllamaHealth, OllamaResponse, OllamaMessage } from './ollamaService';
import { logger } from '../utils/logger';

export type AIProvider = 'gemini' | 'ollama';

export interface AIResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[];
  provider: AIProvider;
}

export interface AIServiceConfig {
  provider: AIProvider;
  useSearch?: boolean; // Only for Gemini
}

// Default to Ollama for local development, can be changed via env
const DEFAULT_PROVIDER: AIProvider = 
  (import.meta.env.VITE_AI_PROVIDER as AIProvider) || 'ollama';

// Store conversation history for Ollama (maintains context)
let ollamaConversationHistory: OllamaMessage[] = [];

/**
 * Get the current AI provider status
 */
export async function getProviderStatus(): Promise<{
  gemini: { available: boolean; reason?: string };
  ollama: { available: boolean; reason?: string };
}> {
  const geminiAvailable = !!import.meta.env.VITE_GEMINI_API_KEY || !!process.env.API_KEY;
  const ollamaAvailable = await checkOllamaHealth();

  return {
    gemini: {
      available: geminiAvailable,
      reason: geminiAvailable ? undefined : 'API key not configured',
    },
    ollama: {
      available: ollamaAvailable,
      reason: ollamaAvailable ? undefined : 'Ollama not running. Start with: ollama serve',
    },
  };
}

/**
 * Send a message to the AI
 * Automatically selects provider based on config or availability
 */
export async function sendAIMessage(
  message: string,
  config: AIServiceConfig = { provider: DEFAULT_PROVIDER }
): Promise<AIResponse> {
  const { provider, useSearch = false } = config;

  logger.debug('Sending AI message', { provider, useSearch }, 'aiService');

  try {
    if (provider === 'ollama') {
      const response = await sendOllamaMessage(message, ollamaConversationHistory);
      
      // Update conversation history for context
      ollamaConversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.text }
      );
      
      // Keep history manageable (last 10 exchanges)
      if (ollamaConversationHistory.length > 20) {
        ollamaConversationHistory = ollamaConversationHistory.slice(-20);
      }

      return {
        ...response,
        provider: 'ollama',
      };
    } else {
      // Gemini provider
      const response = await sendGeminiMessage(message, useSearch);
      return {
        ...response,
        provider: 'gemini',
      };
    }
  } catch (error) {
    logger.error('AI service error', { provider, error }, 'aiService');
    
    // If primary provider fails, try fallback
    if (provider === 'ollama') {
      logger.info('Ollama failed, checking if Gemini is available', {}, 'aiService');
      const status = await getProviderStatus();
      if (status.gemini.available) {
        logger.info('Falling back to Gemini', {}, 'aiService');
        const response = await sendGeminiMessage(message, useSearch);
        return { ...response, provider: 'gemini' };
      }
    }

    throw error;
  }
}

/**
 * Clear conversation history (for Ollama)
 */
export function clearConversationHistory(): void {
  ollamaConversationHistory = [];
  logger.info('Conversation history cleared', {}, 'aiService');
}

/**
 * Get the recommended provider based on availability
 */
export async function getRecommendedProvider(): Promise<AIProvider> {
  const status = await getProviderStatus();
  
  // Prefer Ollama if available (local, free, private)
  if (status.ollama.available) {
    return 'ollama';
  }
  
  // Fall back to Gemini if available
  if (status.gemini.available) {
    return 'gemini';
  }
  
  // Default to Ollama (will show connection error)
  return 'ollama';
}

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'ollama':
      return 'Gemma 3 (Local)';
    case 'gemini':
      return 'Gemini Flash';
    default:
      return 'AI Assistant';
  }
}
