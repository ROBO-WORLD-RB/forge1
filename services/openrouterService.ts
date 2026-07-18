/**
 * OpenRouter AI Service
 * Uses model openrouter/free (smart auto-routing across free models).
 *
 * Prefer Supabase Edge Function `ai-chat` (OPENROUTER_API_KEY secret).
 * Falls back to VITE_OPENROUTER_API_KEY for SPA-only / Render quick setup.
 */

import { aiLimiter, RateLimitError } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { analytics } from '../utils/analytics';
import { supabase, isSupabaseConfigured } from './supabase';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
export const OPENROUTER_MODEL = 'openrouter/free';

const SYSTEM_PROMPT =
  "You are 'Forge AI', a helpful assistant for the Forge marketplace app connecting blue-collar workers in Ghana and Nigeria. You help users find workers, estimate project costs, and give DIY advice. Be professional, friendly, and concise.";

export interface OpenRouterResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[];
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CONFIGURE_MESSAGE =
  'OpenRouter is not configured. Get a key at https://openrouter.ai/keys, then either deploy the ai-chat Edge Function with OPENROUTER_API_KEY, or set VITE_OPENROUTER_API_KEY (and VITE_AI_PROVIDER=openrouter) and redeploy.';

function getClientApiKey(): string {
  return (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() || '';
}

function getReferer(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (import.meta.env.VITE_APP_URL as string | undefined) || 'https://forge-9ieq.onrender.com';
}

/**
 * True when a client key is present, or Supabase is configured (Edge Function path).
 * Edge Function still needs OPENROUTER_API_KEY secret deployed; missing secret
 * surfaces a clear configure message at send time (not an Ollama localhost error).
 */
export function isOpenRouterConfigured(): boolean {
  return Boolean(getClientApiKey()) || isSupabaseConfigured();
}

/** Prefer selecting OpenRouter in UI when a client key exists or env asks for it. */
export function hasOpenRouterClientKey(): boolean {
  return Boolean(getClientApiKey());
}

async function sendViaEdgeFunction(
  message: string,
  history: OpenRouterMessage[]
): Promise<OpenRouterResponse | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message,
        messages: history,
      },
    });

    if (error) {
      logger.warn('ai-chat Edge Function error', { error: error.message }, 'openrouterService');
      return null;
    }

    if (data?.error) {
      // 501 / missing secret — allow client-key fallback
      logger.warn('ai-chat Edge Function returned error', { error: data.error }, 'openrouterService');
      return null;
    }

    if (typeof data?.text === 'string' && data.text.length > 0) {
      return {
        text: data.text,
        groundingUrls: Array.isArray(data.groundingUrls) ? data.groundingUrls : [],
      };
    }

    return null;
  } catch (error) {
    logger.warn(
      'ai-chat Edge Function invoke failed',
      { error: error instanceof Error ? error.message : error },
      'openrouterService'
    );
    return null;
  }
}

async function sendViaClientKey(
  message: string,
  history: OpenRouterMessage[]
): Promise<OpenRouterResponse> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    return { text: CONFIGURE_MESSAGE, groundingUrls: [] };
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getReferer(),
      'X-Title': 'FORGE',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      data?.error?.message || data?.message || `OpenRouter HTTP ${response.status}`;
    logger.error('OpenRouter API error', { status: response.status, detail }, 'openrouterService');
    analytics.track('ai_error', { provider: 'openrouter', error: detail });

    if (response.status === 401 || response.status === 403) {
      return {
        text: 'OpenRouter API key is invalid. Check VITE_OPENROUTER_API_KEY or the Edge Function secret, then redeploy.',
        groundingUrls: [],
      };
    }

    return {
      text: `I couldn't reach OpenRouter (${detail}). Try again or switch provider.`,
      groundingUrls: [],
    };
  }

  const text =
    data?.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

  return { text, groundingUrls: [] };
}

/**
 * Send a message via OpenRouter (Edge Function preferred, then VITE_ client key).
 */
export async function sendOpenRouterMessage(
  message: string,
  history: OpenRouterMessage[] = []
): Promise<OpenRouterResponse> {
  const rateCheck = aiLimiter.check();
  if (!rateCheck.allowed) {
    logger.warn('AI rate limit exceeded', { retryAfter: rateCheck.retryAfter }, 'openrouterService');
    throw new RateLimitError(rateCheck.retryAfter!);
  }

  if (!isOpenRouterConfigured()) {
    return { text: CONFIGURE_MESSAGE, groundingUrls: [] };
  }

  try {
    logger.debug(
      'Sending OpenRouter message',
      { messageLength: message.length, historyLength: history.length, model: OPENROUTER_MODEL },
      'openrouterService'
    );

    // Prefer Edge Function so the key stays off the SPA bundle
    const viaEdge = await sendViaEdgeFunction(message, history);
    if (viaEdge) {
      logger.info('OpenRouter response via Edge Function', { responseLength: viaEdge.text.length }, 'openrouterService');
      analytics.track('ai_chat', { provider: 'openrouter', via: 'edge', model: OPENROUTER_MODEL });
      return viaEdge;
    }

    const viaClient = await sendViaClientKey(message, history);
    logger.info('OpenRouter response via client key', { responseLength: viaClient.text.length }, 'openrouterService');
    analytics.track('ai_chat', { provider: 'openrouter', via: 'client', model: OPENROUTER_MODEL });
    return viaClient;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        text: `You're sending messages too quickly. Please wait ${error.retryAfter} seconds and try again.`,
        groundingUrls: [],
      };
    }

    logger.error(
      'OpenRouter service error',
      { error: error instanceof Error ? error.message : error },
      'openrouterService'
    );
    analytics.track('ai_error', {
      provider: 'openrouter',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      text: CONFIGURE_MESSAGE,
      groundingUrls: [],
    };
  }
}
