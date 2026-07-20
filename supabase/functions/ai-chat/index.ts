/**
 * AI Chat — Supabase Edge Function
 *
 * Proxies chat completions to OpenRouter so OPENROUTER_API_KEY stays server-side.
 * Supports role-aware modes (customer / worker / general), job-request parsing for
 * AI matching, and worker quote drafts.
 *
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

type AiMode = 'customer' | 'worker' | 'general';
type AiAction = 'chat' | 'parse_job' | 'draft_quote';

const BASE_ABOUT = `About FORGE:
- Customers post jobs or browse workers; workers create profiles, get matched to jobs, and get booked.
- Currencies: GHS (Ghana), NGN (Nigeria).
- Assistants propose guidance only — users confirm bookings and payments themselves.
- Never reply with safety ratings, moderation labels, or phrases like "User Safety: safe".
- Use plain text or light markdown sparingly; prefer short paragraphs. Do not emit HTML.`;

const GENERAL_PROMPT = `You are Forge AI, the in-app assistant for FORGE — a marketplace that connects customers with skilled blue-collar workers (electricians, plumbers, carpenters, painters, HVAC/AC techs, cleaners, and similar trades) in Ghana and Nigeria.

${BASE_ABOUT}

Help with finding the right trade, rough project cost estimates, booking/hiring tips, and practical DIY advice.
Suggest hiring a professional for complex, electrical, gas, structural, or otherwise dangerous work.
Be professional, friendly, and concise.`;

const CUSTOMER_PROMPT = `You are Forge AI Customer Assistant for FORGE (Ghana & Nigeria skilled-worker marketplace).

${BASE_ABOUT}

Your jobs for customers:
1) Help them describe the problem clearly (trade, scope, materials, access).
2) Give rough cost bands in GHS or NGN when country is known — always label estimates as approximate.
3) Recommend service categories and what to look for in a worker (verified, reviews, portfolio).
4) Detect emergencies (flooding, exposed live wires, gas smell, structural collapse risk, no power for medical devices, etc.). If urgent, say so clearly, advise immediate safety steps, and urge hiring a pro ASAP. Prefix with "URGENCY: high" on the first line when emergency-like.
5) Guide hire checklist: clear scope → search/book → message → confirm price → track booking.
6) When they want to hire, suggest using "Find a pro with AI" or /search with filters.

Do not invent specific worker names or claim payments are complete. Propose; the customer confirms.`;

const WORKER_PROMPT = `You are Forge AI Worker Assistant for FORGE (Ghana & Nigeria skilled-worker marketplace).

${BASE_ABOUT}

Your jobs for workers running a micro-business:
1) Suggest competitive quote ranges (GHS/NGN) from job scope — label as suggestions only.
2) Draft short, professional response / application messages the worker can edit.
3) Give profile tips: skills, portfolio photos, bio clarity, rates, accepting work.
4) Pricing tips: materials vs labour, call-out fees, urgency premiums — honest and local.
5) Help them win work without overpromising.

Never invent platform payment/escrow status. Quotes are draft text only — not invoices or charges.`;

const PARSE_JOB_PROMPT = `You extract structured hiring intent for FORGE (GH/NG marketplace).
Return ONLY valid JSON (no markdown fences, no commentary) with this shape:
{
  "service": string | null,
  "urgency": "low" | "normal" | "high" | "emergency",
  "location": string | null,
  "country": "GH" | "NG" | null,
  "budgetMin": number | null,
  "budgetMax": number | null,
  "currency": "GHS" | "NGN" | null,
  "date": string | null,
  "skills": string[],
  "summary": string,
  "emergency": boolean
}

Rules:
- service: primary trade (e.g. electrician, plumber, carpenter, painter, cleaner, hvac).
- skills: 0–6 short skill tags related to the job.
- urgency/emergency: true emergency only for safety-critical situations.
- budget numbers as plain numbers without currency symbols.
- summary: one short sentence restating the need.
- If unknown, use null or [].`;

const DRAFT_QUOTE_PROMPT = `You help FORGE workers draft a short application / quote message (not a payment).
Return plain text only (no JSON, no markdown fences), 80–180 words:
- Greet briefly, reference the job category/title
- State relevant experience in 1–2 lines
- Propose a rough price band if budget is known, else ask clarifying questions
- Mention availability / next step (site visit or chat)
- Professional, local tone for Ghana/Nigeria — no slang spam, no fake guarantees`;

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
  mode?: AiMode | string;
  action?: AiAction | string;
  context?: Record<string, unknown>;
}

function normalizeMode(raw: unknown): AiMode {
  if (raw === 'customer' || raw === 'worker' || raw === 'general') return raw;
  return 'general';
}

function normalizeAction(raw: unknown): AiAction {
  if (raw === 'parse_job' || raw === 'draft_quote' || raw === 'chat') return raw;
  return 'chat';
}

function systemPromptFor(mode: AiMode, action: AiAction): string {
  if (action === 'parse_job') return PARSE_JOB_PROMPT;
  if (action === 'draft_quote') return DRAFT_QUOTE_PROMPT;
  if (mode === 'customer') return CUSTOMER_PROMPT;
  if (mode === 'worker') return WORKER_PROMPT;
  return GENERAL_PROMPT;
}

/** Light spam / abuse heuristics — flag or reject obvious junk. */
function detectSpamText(text: string): { flagged: boolean; reason?: string } {
  const t = text.trim();
  if (!t) return { flagged: false };

  if (t.length > 8000) {
    return { flagged: true, reason: 'Message too long' };
  }

  // Repeated characters / keyboard smash
  if (/(.)\1{12,}/i.test(t)) {
    return { flagged: true, reason: 'Repeated character spam' };
  }

  // Same short token repeated many times
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    for (const [w, c] of counts) {
      if (w.length >= 3 && c >= 10 && c / words.length > 0.5) {
        return { flagged: true, reason: 'Repetitive spam pattern' };
      }
    }
  }

  // Classic spam bait
  if (
    /(whatsapp|telegram)\s*[:.]?\s*\+?\d{8,}/i.test(t) &&
    /(crypto|forex|investment|bitcoin|nigerian prince|send\s*money)/i.test(t)
  ) {
    return { flagged: true, reason: 'Suspicious promotional spam' };
  }

  if (/(https?:\/\/|www\.)\S+/gi.test(t)) {
    const links = t.match(/(https?:\/\/|www\.)\S+/gi) || [];
    if (links.length >= 5) {
      return { flagged: true, reason: 'Too many links' };
    }
  }

  return { flagged: false };
}

function sanitizeAssistantOutput(text: string): string {
  let out = text.trim();
  // Strip accidental safety-classifier style lines if mixed into a longer reply
  out = out
    .split(/\r?\n/)
    .filter((line) => !/^(User|Response)\s+Safety:\s*(safe|unsafe)\b/i.test(line.trim()))
    .join('\n')
    .trim();
  return out;
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

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through — try first {...} block
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeParsedJob(raw: Record<string, unknown>, fallbackMessage: string) {
  const urgencyRaw = typeof raw.urgency === 'string' ? raw.urgency.toLowerCase() : 'normal';
  const urgency =
    urgencyRaw === 'low' ||
    urgencyRaw === 'normal' ||
    urgencyRaw === 'high' ||
    urgencyRaw === 'emergency'
      ? urgencyRaw
      : 'normal';

  const country =
    raw.country === 'GH' || raw.country === 'NG' ? (raw.country as 'GH' | 'NG') : null;
  const currency =
    raw.currency === 'GHS' || raw.currency === 'NGN'
      ? (raw.currency as 'GHS' | 'NGN')
      : country === 'GH'
        ? 'GHS'
        : country === 'NG'
          ? 'NGN'
          : null;

  const skills = Array.isArray(raw.skills)
    ? raw.skills.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()).slice(0, 6)
    : [];

  const emergency =
    raw.emergency === true || urgency === 'emergency' || urgency === 'high';

  return {
    service: typeof raw.service === 'string' && raw.service.trim() ? raw.service.trim() : null,
    urgency,
    location: typeof raw.location === 'string' && raw.location.trim() ? raw.location.trim() : null,
    country,
    budgetMin: typeof raw.budgetMin === 'number' && Number.isFinite(raw.budgetMin) ? raw.budgetMin : null,
    budgetMax: typeof raw.budgetMax === 'number' && Number.isFinite(raw.budgetMax) ? raw.budgetMax : null,
    currency,
    date: typeof raw.date === 'string' && raw.date.trim() ? raw.date.trim() : null,
    skills,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : fallbackMessage.slice(0, 200),
    emergency,
  };
}

function heuristicParseJob(message: string) {
  const lower = message.toLowerCase();
  const trades = [
    'electrician',
    'plumber',
    'carpenter',
    'painter',
    'cleaner',
    'hvac',
    'ac technician',
    'welder',
    'tiler',
    'mason',
    'mechanic',
  ];
  const service = trades.find((t) => lower.includes(t)) || null;

  let country: 'GH' | 'NG' | null = null;
  if (/\b(ghana|accra|kumasi|takoradi|ghs)\b/i.test(message)) country = 'GH';
  if (/\b(nigeria|lagos|abuja|port\s*harcourt|ngn)\b/i.test(message)) country = 'NG';

  const emergency =
    /\b(emergency|urgent|asap|flood|gas\s*leak|live\s*wire|exposed\s*wire|no\s*power|collapsed?)\b/i.test(
      message
    );

  const budgetMatches = message.match(/(?:ghs|ngn|₵|₦)?\s*([\d,]{3,})/gi) || [];
  const nums = budgetMatches
    .map((m) => Number(m.replace(/[^\d]/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  return {
    service,
    urgency: emergency ? ('emergency' as const) : ('normal' as const),
    location: null as string | null,
    country,
    budgetMin: nums[0] ?? null,
    budgetMax: nums.length > 1 ? nums[nums.length - 1] : nums[0] ?? null,
    currency: country === 'GH' ? ('GHS' as const) : country === 'NG' ? ('NGN' as const) : null,
    date: null as string | null,
    skills: service ? [service] : ([] as string[]),
    summary: message.slice(0, 200),
    emergency,
  };
}

async function requireAuthUserId(req: Request): Promise<{ userId: string | null; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return { userId: null, error: 'Server configuration error' };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearer) {
    return { userId: null, error: 'Authorization required' };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return { userId: null, error: 'Unauthorized' };
  }
  return { userId: data.user.id };
}

async function callOpenRouter(
  apiKey: string,
  messages: ChatMessage[],
  referer: string,
  title: string
): Promise<{ text: string; model: string; warning?: string } | { error: string; status: number }> {
  const models = allChatModels();
  let lastDetail = 'No model succeeded';

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
        return { error: lastDetail, status: upstream.status };
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

    const cleaned = sanitizeAssistantOutput(text);
    if (!cleaned || isSafetyClassifierResponse(cleaned, usedModel)) {
      lastDetail = `Unusable content from ${usedModel}`;
      continue;
    }

    const spam = detectSpamText(cleaned);
    if (spam.flagged) {
      lastDetail = spam.reason || 'Spam flagged in model output';
      continue;
    }

    return { text: cleaned, model: usedModel };
  }

  return { text: SAFETY_STUB_FALLBACK, model: OPENROUTER_MODEL, warning: lastDetail };
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

  const mode = normalizeMode(payload.mode);
  const action = normalizeAction(payload.action);
  const history = Array.isArray(payload.messages) ? payload.messages : [];
  const userMessage = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!userMessage && history.length === 0 && action === 'chat') {
    return jsonResponse({ error: 'message or messages is required' }, 400);
  }

  if ((action === 'parse_job' || action === 'draft_quote') && !userMessage) {
    return jsonResponse({ error: 'message is required for this action' }, 400);
  }

  // Authenticated actions (matching parse + quote drafts)
  if (action === 'parse_job' || action === 'draft_quote') {
    const auth = await requireAuthUserId(req);
    if (!auth.userId) {
      return jsonResponse({ error: auth.error || 'Unauthorized' }, 401);
    }
  }

  const inputSpam = detectSpamText(userMessage || history.map((m) => m.content).join('\n'));
  if (inputSpam.flagged) {
    return jsonResponse(
      {
        error: 'Message rejected',
        reason: inputSpam.reason || 'Spam pattern detected',
        flagged: true,
      },
      400
    );
  }

  const referer =
    Deno.env.get('OPENROUTER_HTTP_REFERER') ||
    Deno.env.get('SITE_URL') ||
    'https://forge-9ieq.onrender.com';
  const title = Deno.env.get('OPENROUTER_APP_TITLE') || 'FORGE';

  let systemContent = systemPromptFor(mode, action);

  if (action === 'draft_quote' && payload.context && typeof payload.context === 'object') {
    systemContent += `\n\nJob context (JSON):\n${JSON.stringify(payload.context).slice(0, 2000)}`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
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

  try {
    const result = await callOpenRouter(apiKey, messages, referer, title);
    if ('error' in result) {
      return jsonResponse({ error: result.error }, result.status);
    }

    if (action === 'parse_job') {
      const raw = extractJsonObject(result.text);
      const parsed = raw
        ? normalizeParsedJob(raw, userMessage)
        : heuristicParseJob(userMessage);

      return jsonResponse({
        text: parsed.summary,
        parsed,
        groundingUrls: [],
        provider: 'openrouter',
        model: result.model,
        mode,
        action,
        warning: result.warning,
        heuristic: !raw,
      });
    }

    if (action === 'draft_quote') {
      return jsonResponse({
        text: result.text,
        groundingUrls: [],
        provider: 'openrouter',
        model: result.model,
        mode: 'worker',
        action,
        warning: result.warning,
      });
    }

    const urgencyFlag =
      /^URGENCY:\s*high\b/im.test(result.text) ||
      (mode === 'customer' &&
        /\b(emergency|evacuate|turn off (the )?gas|call emergency)\b/i.test(result.text));

    return jsonResponse({
      text: result.text,
      groundingUrls: [],
      provider: 'openrouter',
      model: result.model,
      mode,
      action: 'chat',
      urgencyFlag,
      warning: result.warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to reach OpenRouter: ${message}` }, 502);
  }
});
