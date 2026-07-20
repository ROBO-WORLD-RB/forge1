/**
 * AI Service Abstraction
 * Provides a unified interface for different AI providers (OpenRouter, Gemini, Ollama)
 * Allows switching between cloud and local models
 */

import { sendGeminiMessage } from './geminiService';
import { sendOllamaMessage, checkOllamaHealth, OllamaMessage } from './ollamaService';
import {
  sendOpenRouterMessage,
  isOpenRouterConfigured,
  OpenRouterMessage,
  type AiChatMode,
} from './openrouterService';
import { logger } from '../utils/logger';

export type AIProvider = 'openrouter' | 'gemini' | 'ollama';
export type { AiChatMode };

export interface AIResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[];
  provider: AIProvider;
  urgencyFlag?: boolean;
  mode?: AiChatMode;
}

export interface AIServiceConfig {
  provider: AIProvider;
  useSearch?: boolean; // Only for Gemini
  mode?: AiChatMode;
}

function resolveDefaultProvider(): AIProvider {
  const fromEnv = import.meta.env.VITE_AI_PROVIDER as AIProvider | undefined;
  // Production default is OpenRouter; gemini/ollama remain as unused fallbacks in code only
  if (fromEnv === 'gemini' || fromEnv === 'ollama') {
    return fromEnv;
  }
  return 'openrouter';
}

const DEFAULT_PROVIDER: AIProvider = resolveDefaultProvider();

// Conversation history for providers that keep context client-side
let ollamaConversationHistory: OllamaMessage[] = [];
let openrouterConversationHistory: OpenRouterMessage[] = [];

/**
 * Get the current AI provider status
 */
export async function getProviderStatus(): Promise<{
  openrouter: { available: boolean; reason?: string };
  gemini: { available: boolean; reason?: string };
  ollama: { available: boolean; reason?: string };
}> {
  const openrouterAvailable = isOpenRouterConfigured();
  const geminiAvailable = !!import.meta.env.VITE_GEMINI_API_KEY || !!process.env.API_KEY;
  const ollamaAvailable = await checkOllamaHealth();

  return {
    openrouter: {
      available: openrouterAvailable,
      reason: openrouterAvailable
        ? undefined
        : 'Configure OpenRouter: set VITE_OPENROUTER_API_KEY or deploy ai-chat Edge Function with OPENROUTER_API_KEY',
    },
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
    if (provider === 'openrouter') {
      const response = await sendOpenRouterMessage(message, openrouterConversationHistory, {
        mode: config.mode || 'general',
      });

      openrouterConversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.text }
      );
      if (openrouterConversationHistory.length > 20) {
        openrouterConversationHistory = openrouterConversationHistory.slice(-20);
      }

      return {
        ...response,
        provider: 'openrouter',
        urgencyFlag: response.urgencyFlag,
        mode: response.mode || config.mode,
      };
    }

    if (provider === 'ollama') {
      const response = await sendOllamaMessage(message, ollamaConversationHistory);

      ollamaConversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.text }
      );

      if (ollamaConversationHistory.length > 20) {
        ollamaConversationHistory = ollamaConversationHistory.slice(-20);
      }

      return {
        ...response,
        provider: 'ollama',
      };
    }

    // Gemini provider
    const response = await sendGeminiMessage(message, useSearch);
    return {
      ...response,
      provider: 'gemini',
    };
  } catch (error) {
    logger.error('AI service error', { provider, error }, 'aiService');

    // Fallback chain: primary → openrouter → gemini
    const status = await getProviderStatus();

    if (provider !== 'openrouter' && status.openrouter.available) {
      logger.info('Falling back to OpenRouter', {}, 'aiService');
      const response = await sendOpenRouterMessage(message, openrouterConversationHistory, {
        mode: config.mode || 'general',
      });
      return { ...response, provider: 'openrouter', urgencyFlag: response.urgencyFlag };
    }

    if (provider === 'ollama' && status.gemini.available) {
      logger.info('Falling back to Gemini', {}, 'aiService');
      const response = await sendGeminiMessage(message, useSearch);
      return { ...response, provider: 'gemini' };
    }

    throw error;
  }
}

/**
 * Clear conversation history (for Ollama / OpenRouter)
 */
export function clearConversationHistory(): void {
  ollamaConversationHistory = [];
  openrouterConversationHistory = [];
  logger.info('Conversation history cleared', {}, 'aiService');
}

/**
 * Get the recommended provider based on availability
 * UI always uses OpenRouter; gemini/ollama are unused fallbacks.
 */
export async function getRecommendedProvider(): Promise<AIProvider> {
  return 'openrouter';
}

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'OpenRouter Free';
    case 'ollama':
      return 'Gemma 3 (Local)';
    case 'gemini':
      return 'Gemini Flash';
    default:
      return 'AI Assistant';
  }
}
