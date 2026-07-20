/**
 * OpenRouter AI Service
 *
 * Uses pinned free chat models (with fallbacks). Avoids openrouter/free random
 * routing, which can select content-safety / guardrail models that only return
 * "User Safety: safe" instead of a helpful answer.
 *
 * Prefer Supabase Edge Function `ai-chat` (OPENROUTER_API_KEY secret) — required
 * for production. Optional VITE_OPENROUTER_API_KEY SPA fallback is public in the
 * bundle; avoid setting it when `ai-chat` is deployed.
 */

import { aiLimiter, RateLimitError } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { analytics } from '../utils/analytics';
import { supabase, isSupabaseConfigured } from './supabase';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/** Primary free chat model — instruct/chat, not safety/guardrail. */
export const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/** Tried in order if the primary is down, rate-limited, or returns a safety-classifier stub. */
export const OPENROUTER_MODEL_FALLBACKS = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
] as const;

const SYSTEM_PROMPT = `You are Forge AI, the in-app assistant for FORGE — a marketplace that connects customers with skilled blue-collar workers (electricians, plumbers, carpenters, painters, HVAC/AC techs, cleaners, and similar trades) in Ghana and Nigeria.

About FORGE:
- Customers post jobs or browse workers; workers create profiles, get matched to jobs, and get booked.
- Help with finding the right trade, rough project cost estimates (GHS in Ghana, NGN in Nigeria), booking/hiring tips, and practical DIY advice.
- Suggest hiring a professional for complex, electrical, gas, structural, or otherwise dangerous work.

When users ask what the platform is about, explain FORGE clearly in plain language (marketplace for skilled workers in GH/NG), then offer to help with their specific need.

Be professional, friendly, and concise. Answer the user's question directly with a normal helpful reply — never reply with safety ratings, moderation labels, or phrases like "User Safety: safe". Use plain text or light markdown sparingly (**bold**, *italic*, short lists); prefer short paragraphs. Do not emit HTML.`;

export type AiChatMode = 'customer' | 'worker' | 'general';

export interface OpenRouterResponse {
  text: string;
  groundingUrls: { uri: string; title: string }[];
  urgencyFlag?: boolean;
  mode?: AiChatMode;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterSendOptions {
  mode?: AiChatMode;
}

const CONFIGURE_MESSAGE =
  'OpenRouter is not configured. Get a key at https://openrouter.ai/keys, then either deploy the ai-chat Edge Function with OPENROUTER_API_KEY, or set VITE_OPENROUTER_API_KEY (and VITE_AI_PROVIDER=openrouter) and redeploy.';

const SAFETY_STUB_FALLBACK =
  "I'm Forge AI for the FORGE marketplace — we connect customers with skilled workers (electricians, plumbers, carpenters, and more) across Ghana and Nigeria. Ask me about finding a worker, rough project costs in GHS/NGN, or DIY tips.";

function getClientApiKey(): string {
  return (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined)?.trim() || '';
}

function getReferer(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (import.meta.env.VITE_APP_URL as string | undefined) || 'https://forge-9ieq.onrender.com';
}

/** Extract assistant text from OpenAI-compatible message.content (string or parts array). */
export function extractMessageContent(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;

  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const p = part as { text?: unknown; content?: unknown };
          if (typeof p.text === 'string') return p.text;
          if (typeof p.content === 'string') return p.content;
        }
        return '';
      })
      .filter((s) => s.length > 0)
      .join('\n')
      .trim();
  }

  return '';
}

/**
 * True when the model (or its output) is a content-safety / guardrail classifier
 * rather than a chat assistant — e.g. nvidia/nemotron-3.5-content-safety:free
 * which returns only "User Safety: safe".
 */
export function isSafetyClassifierResponse(text: string, modelId?: string): boolean {
  if (modelId && /content-safety|llama-guard|prompt-guard|moderat(?:ion|or)|guardrail/i.test(modelId)) {
    return true;
  }

  const t = text.trim();
  if (!t) return false;

  if (/^User Safety:\s*(safe|unsafe)\b/i.test(t)) return true;
  if (/^Response Safety:\s*(safe|unsafe)\b/i.test(t)) return true;

  // Entire reply is only safety rating line(s)
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (
    lines.length > 0 &&
    lines.length <= 3 &&
    lines.every((l) => /^(User|Response)\s+Safety:\s*(safe|unsafe)\b/i.test(l))
  ) {
    return true;
  }

  return false;
}

function allChatModels(): string[] {
  return [OPENROUTER_MODEL, ...OPENROUTER_MODEL_FALLBACKS];
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
  history: OpenRouterMessage[],
  mode: AiChatMode = 'general'
): Promise<OpenRouterResponse | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message,
        messages: history,
        mode,
        action: 'chat',
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
      if (isSafetyClassifierResponse(data.text, typeof data.model === 'string' ? data.model : undefined)) {
        logger.warn(
          'ai-chat returned safety-classifier stub; falling back to client key',
          { model: data.model, preview: data.text.slice(0, 80) },
          'openrouterService'
        );
        return null;
      }
      return {
        text: data.text,
        groundingUrls: Array.isArray(data.groundingUrls) ? data.groundingUrls : [],
        urgencyFlag: Boolean(data.urgencyFlag),
        mode: (data.mode as AiChatMode) || mode,
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

async function callOpenRouterChat(
  apiKey: string,
  messages: OpenRouterMessage[],
  model: string,
  fallbacks: string[]
): Promise<{ text: string; model: string }> {
  const body: Record<string, unknown> = {
    model,
    messages,
  };
  if (fallbacks.length > 0) {
    body.models = fallbacks;
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getReferer(),
      'X-Title': 'FORGE',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      data?.error?.message || data?.message || `OpenRouter HTTP ${response.status}`;
    const err = new Error(detail) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  const choiceMessage = data?.choices?.[0]?.message;
  const text = extractMessageContent(choiceMessage);
  const usedModel = typeof data?.model === 'string' ? data.model : model;

  return { text, model: usedModel };
}

function clientSystemPrompt(mode: AiChatMode): string {
  if (mode === 'customer') {
    return `${SYSTEM_PROMPT}

You are in customer mode: help describe problems, give rough GHS/NGN cost bands, recommend trades, and flag emergencies with "URGENCY: high" on the first line when needed.`;
  }
  if (mode === 'worker') {
    return `${SYSTEM_PROMPT}

You are in worker mode: help with quote suggestions, application drafts, profile tips, and pricing. Drafts are text only — not payments.`;
  }
  return SYSTEM_PROMPT;
}

async function sendViaClientKey(
  message: string,
  history: OpenRouterMessage[],
  mode: AiChatMode = 'general'
): Promise<OpenRouterResponse> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    return { text: CONFIGURE_MESSAGE, groundingUrls: [] };
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: clientSystemPrompt(mode) },
    ...history,
    { role: 'user', content: message },
  ];

  const models = allChatModels();
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const fallbacks = models.slice(i + 1);

    try {
      const { text, model: usedModel } = await callOpenRouterChat(
        apiKey,
        messages,
        model,
        fallbacks
      );

      if (!text) {
        logger.warn('OpenRouter empty content', { model: usedModel }, 'openrouterService');
        continue;
      }

      if (isSafetyClassifierResponse(text, usedModel)) {
        logger.warn(
          'OpenRouter safety-classifier response; trying next model',
          { model: usedModel, preview: text.slice(0, 80) },
          'openrouterService'
        );
        continue;
      }

      return { text, groundingUrls: [] };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (error as { status?: number })?.status;
      logger.warn(
        'OpenRouter model attempt failed',
        { model, status, detail: lastError.message },
        'openrouterService'
      );

      if (status === 401 || status === 403) {
        return {
          text: 'OpenRouter API key is invalid. Check VITE_OPENROUTER_API_KEY or the Edge Function secret, then redeploy.',
          groundingUrls: [],
        };
      }
    }
  }

  if (lastError) {
    analytics.track('ai_error', { provider: 'openrouter', error: lastError.message });
    return {
      text: `I couldn't reach OpenRouter (${lastError.message}). Try again or switch provider.`,
      groundingUrls: [],
    };
  }

  return { text: SAFETY_STUB_FALLBACK, groundingUrls: [] };
}

/**
 * Send a message via OpenRouter (Edge Function preferred, then VITE_ client key).
 */
export async function sendOpenRouterMessage(
  message: string,
  history: OpenRouterMessage[] = [],
  options: OpenRouterSendOptions = {}
): Promise<OpenRouterResponse> {
  const mode = options.mode || 'general';
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
      {
        messageLength: message.length,
        historyLength: history.length,
        model: OPENROUTER_MODEL,
        mode,
      },
      'openrouterService'
    );

    // Prefer Edge Function so the key stays off the SPA bundle
    const viaEdge = await sendViaEdgeFunction(message, history, mode);
    if (viaEdge) {
      logger.info('OpenRouter response via Edge Function', { responseLength: viaEdge.text.length }, 'openrouterService');
      analytics.track('ai_chat', { provider: 'openrouter', via: 'edge', model: OPENROUTER_MODEL, mode });
      return viaEdge;
    }

    const viaClient = await sendViaClientKey(message, history, mode);
    logger.info('OpenRouter response via client key', { responseLength: viaClient.text.length }, 'openrouterService');
    analytics.track('ai_chat', { provider: 'openrouter', via: 'client', model: OPENROUTER_MODEL, mode });
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
