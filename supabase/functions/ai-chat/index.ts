/**
 * AI Chat — Supabase Edge Function
 *
 * Proxies chat completions to OpenRouter so OPENROUTER_API_KEY stays server-side.
 * Uses pinned free chat models (with fallbacks). Avoids openrouter/free random
 * routing to content-safety / guardrail models that return "User Safety: safe".
 *
 * Deploy:
 *   supabase secrets set OPENROUTER_API_KEY=sk-or-...
 *   supabase functions deploy ai-chat
 *
 * Optional secrets:
 *   OPENROUTER_HTTP_REFERER=https://forge-9ieq.onrender.com
 *   OPENROUTER_APP_TITLE=FORGE
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_MODEL_FALLBACKS = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

const SYSTEM_PROMPT = `You are Forge AI, the in-app assistant for FORGE — a marketplace that connects customers with skilled blue-collar workers (electricians, plumbers, carpenters, painters, HVAC/AC techs, cleaners, and similar trades) in Ghana and Nigeria.

About FORGE:
- Customers post jobs or browse workers; workers create profiles, get matched to jobs, and get booked.
- Help with finding the right trade, rough project cost estimates (GHS in Ghana, NGN in Nigeria), booking/hiring tips, and practical DIY advice.
- Suggest hiring a professional for complex, electrical, gas, structural, or otherwise dangerous work.

When users ask what the platform is about, explain FORGE clearly in plain language (marketplace for skilled workers in GH/NG), then offer to help with their specific need.

Be professional, friendly, and concise. Answer the user's question directly with a normal helpful reply — never reply with safety ratings, moderation labels, or phrases like "User Safety: safe". Use plain text or light markdown sparingly (**bold**, *italic*, short lists); prefer short paragraphs. Do not emit HTML.`;

const SAFETY_STUB_FALLBACK =
  "I'm Forge AI for the FORGE marketplace — we connect customers with skilled workers (electricians, plumbers, carpenters, and more) across Ghana and Nigeria. Ask me about finding a worker, rough project costs in GHS/NGN, or DIY tips.";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiChatRequestBody {
  message?: string;
  messages?: ChatMessage[];
}

function extractMessageContent(message: unknown): string {
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

function isSafetyClassifierResponse(text: string, modelId?: string): boolean {
  if (modelId && /content-safety|llama-guard|prompt-guard|moderat(?:ion|or)|guardrail/i.test(modelId)) {
    return true;
  }

  const t = text.trim();
  if (!t) return false;

  if (/^User Safety:\s*(safe|unsafe)\b/i.test(t)) return true;
  if (/^Response Safety:\s*(safe|unsafe)\b/i.test(t)) return true;

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) {
    return jsonResponse(
      {
        error: 'OpenRouter not configured',
        hint: 'Set OPENROUTER_API_KEY via: supabase secrets set OPENROUTER_API_KEY=...',
      },
      501
    );
  }

  let payload: AiChatRequestBody;
  try {
    payload = (await req.json()) as AiChatRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const history = Array.isArray(payload.messages) ? payload.messages : [];
  const userMessage = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!userMessage && history.length === 0) {
    return jsonResponse({ error: 'message or messages is required' }, 400);
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    ),
  ];

  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  const referer =
    Deno.env.get('OPENROUTER_HTTP_REFERER') ||
    Deno.env.get('SITE_URL') ||
    'https://forge-9ieq.onrender.com';
  const title = Deno.env.get('OPENROUTER_APP_TITLE') || 'FORGE';

  const models = allChatModels();
  let lastDetail = 'No model succeeded';

  try {
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const fallbacks = models.slice(i + 1);

      const body: Record<string, unknown> = {
        model,
        messages,
      };
      if (fallbacks.length > 0) {
        body.models = fallbacks;
      }

      const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
          'X-Title': title,
        },
        body: JSON.stringify(body),
      });

      const data = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        lastDetail =
          (data as { error?: { message?: string }; message?: string })?.error?.message ||
          (data as { message?: string })?.message ||
          `OpenRouter HTTP ${upstream.status}`;

        if (upstream.status === 401 || upstream.status === 403) {
          return jsonResponse({ error: lastDetail }, upstream.status);
        }
        continue;
      }

      const text = extractMessageContent(
        (data as { choices?: Array<{ message?: unknown }> })?.choices?.[0]?.message
      );
      const usedModel =
        typeof (data as { model?: string }).model === 'string'
          ? (data as { model: string }).model
          : model;

      if (!text) {
        lastDetail = 'Empty assistant content';
        continue;
      }

      if (isSafetyClassifierResponse(text, usedModel)) {
        lastDetail = `Safety-classifier stub from ${usedModel}`;
        continue;
      }

      return jsonResponse({
        text,
        groundingUrls: [],
        provider: 'openrouter',
        model: usedModel,
      });
    }

    // All chat models failed or returned safety stubs — never surface "User Safety: safe"
    return jsonResponse({
      text: SAFETY_STUB_FALLBACK,
      groundingUrls: [],
      provider: 'openrouter',
      model: OPENROUTER_MODEL,
      warning: lastDetail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to reach OpenRouter: ${message}` }, 502);
  }
});
