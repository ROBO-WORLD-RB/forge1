/**
 * AI Chat — Supabase Edge Function
 *
 * Proxies chat completions to OpenRouter so OPENROUTER_API_KEY stays server-side.
 * Model: openrouter/free (smart auto-routing across free models).
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
const OPENROUTER_MODEL = 'openrouter/free';

const SYSTEM_PROMPT =
  "You are 'Forge AI', a helpful assistant for the Forge marketplace app connecting blue-collar workers in Ghana and Nigeria. You help users find workers, estimate project costs, and give DIY advice. Be professional, friendly, and concise.";

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

  try {
    const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': title,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
      }),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const detail =
        (data as { error?: { message?: string }; message?: string })?.error?.message ||
        (data as { message?: string })?.message ||
        `OpenRouter HTTP ${upstream.status}`;
      return jsonResponse({ error: detail }, upstream.status >= 500 ? 502 : upstream.status);
    }

    const text =
      (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
        ?.content || "I'm sorry, I couldn't generate a response.";

    return jsonResponse({
      text,
      groundingUrls: [],
      provider: 'openrouter',
      model: OPENROUTER_MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to reach OpenRouter: ${message}` }, 502);
  }
});
