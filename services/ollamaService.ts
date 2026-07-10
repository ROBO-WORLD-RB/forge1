/**
 * Ollama Service for Local LLM Integration
 * Connects to locally running Ollama with gemma3:4b model
 */

import { aiLimiter, RateLimitError } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { analytics } from '../utils/analytics';

// Ollama API endpoint
// In development, use Vite proxy to avoid CORS issues
// In production, use direct URL (requires CORS configuration on Ollama)
const OLLAMA_BASE_URL = import.meta.env.DEV 
  ? '/ollama'  // Vite proxy
  : (import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434');
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'gemma3:4b';

export interface OllamaResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[]; // Empty for local models
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// System prompt for Forge AI
const FORGE_SYSTEM_PROMPT = `You are 'Forge AI', a helpful assistant for the Forge marketplace app connecting blue-collar workers (electricians, plumbers, carpenters, painters, etc.) in Ghana and Nigeria.

Your responsibilities:
- Help users find workers for their projects
- Provide estimates for project costs in GHS (Ghana Cedis) or NGN (Nigerian Naira)
- Give DIY advice and tips
- Answer questions about home repairs and maintenance
- Be professional, friendly, and concise

Important context:
- Workers in Ghana charge in GHS (Ghana Cedis)
- Workers in Nigeria charge in NGN (Nigerian Naira)
- Common services: electrical work, plumbing, carpentry, painting, HVAC/AC, cleaning
- Always be helpful and suggest finding a professional for complex or dangerous tasks`;

/**
 * Check if Ollama is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    // Only log as warning if it's not a connection error (which is expected if Ollama isn't running)
    const isConnError = error instanceof TypeError && error.message.includes('fetch');
    if (!isConnError) {
      logger.warn('Ollama health check failed', { error }, 'ollamaService');
    } else {
      logger.debug('Ollama not detected (local model unavailable)', {}, 'ollamaService');
    }
    return false;
  }
}

/**
 * Get list of available models from Ollama
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    logger.error('Failed to get Ollama models', { error }, 'ollamaService');
    return [];
  }
}

/**
 * Send a message to the local Ollama model
 */
export async function sendOllamaMessage(
  message: string,
  conversationHistory: OllamaMessage[] = []
): Promise<OllamaResponse> {
  // Rate limiting check
  const rateCheck = aiLimiter.check();
  if (!rateCheck.allowed) {
    logger.warn('AI rate limit exceeded', { retryAfter: rateCheck.retryAfter }, 'ollamaService');
    throw new RateLimitError(rateCheck.retryAfter!);
  }

  try {
    logger.debug('Sending message to Ollama', { 
      model: OLLAMA_MODEL, 
      messageLength: message.length 
    }, 'ollamaService');

    // Build messages array with system prompt and history
    const messages: OllamaMessage[] = [
      { role: 'system', content: FORGE_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const requestBody: OllamaChatRequest = {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 1024,
      }
    };

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data: OllamaChatResponse = await response.json();
    const text = data.message?.content || "I'm sorry, I couldn't generate a response.";

    logger.info('Ollama response received', { 
      responseLength: text.length,
      model: OLLAMA_MODEL,
      evalCount: data.eval_count
    }, 'ollamaService');
    
    analytics.track('ai_chat', { 
      provider: 'ollama',
      model: OLLAMA_MODEL,
      messageLength: message.length 
    });

    return { 
      text, 
      groundingUrls: [] // Local models don't have web search
    };

  } catch (error) {
    logger.error('Ollama API Error', { 
      error: error instanceof Error ? error.message : error 
    }, 'ollamaService');
    
    analytics.track('ai_error', { 
      provider: 'ollama',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });

    if (error instanceof RateLimitError) {
      return {
        text: `You're sending messages too quickly. Please wait ${error.retryAfter} seconds and try again.`,
        groundingUrls: []
      };
    }

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        text: "I can't connect to the local AI model. Please make sure Ollama is running with: `ollama serve`",
        groundingUrls: []
      };
    }

    return {
      text: "I apologize, but I'm having trouble processing your request. Please try again.",
      groundingUrls: []
    };
  }
}

/**
 * Stream response from Ollama (for future use)
 */
export async function* streamOllamaMessage(
  message: string,
  conversationHistory: OllamaMessage[] = []
): AsyncGenerator<string, void, unknown> {
  const messages: OllamaMessage[] = [
    { role: 'system', content: FORGE_SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error('Failed to stream from Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          yield data.message.content;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }
}
