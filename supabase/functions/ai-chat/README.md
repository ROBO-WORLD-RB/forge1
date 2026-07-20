# AI Chat Edge Function (OpenRouter)

Server-side proxy for Forge AI. Keeps `OPENROUTER_API_KEY` off the Vite client bundle.

Supports:

| Field | Values | Purpose |
|-------|--------|---------|
| `mode` | `customer` \| `worker` \| `general` | Role-aware system prompts |
| `action` | `chat` (default) \| `parse_job` \| `draft_quote` | Chat, NL→structured match parse, worker quote draft |
| `message` / `messages` | string / history | User input |
| `context` | object | Job fields for `draft_quote` |

`parse_job` and `draft_quote` require a valid Supabase user JWT (`Authorization: Bearer …`).

Uses pinned free **chat** models (Llama / Gemma / GPT-OSS fallbacks). Does **not** use `openrouter/free` random routing (avoids content-safety stubs like `User Safety: safe`). Light spam heuristics reject obvious junk input/output.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
- A linked Supabase project (`supabase link --project-ref <your-ref>`)
- API key from [OpenRouter Keys](https://openrouter.ai/keys)

## Deploy

```bash
# From the repo root
cd supabase

# Server-side secret (never use a VITE_ prefix)
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your_key_here

# Optional attribution headers OpenRouter recommends
supabase secrets set OPENROUTER_HTTP_REFERER=https://forge-9ieq.onrender.com
supabase secrets set OPENROUTER_APP_TITLE=FORGE

# Redeploy after M5 (modes / parse_job / draft_quote)
supabase functions deploy ai-chat
```

## Client usage

```ts
// Chat (role-aware)
await supabase.functions.invoke('ai-chat', {
  body: { message, messages: history, mode: 'customer', action: 'chat' },
});

// Matching parse (auth required) → then client calls searchWorkersRanked
await supabase.functions.invoke('ai-chat', {
  body: { message: 'Need a plumber in Accra ASAP', mode: 'customer', action: 'parse_job' },
});

// Worker quote draft (auth required) — text only, not payment
await supabase.functions.invoke('ai-chat', {
  body: {
    message: 'Draft my application quote',
    mode: 'worker',
    action: 'draft_quote',
    context: { title, category, budgetMin, currency },
  },
});
```

SPA helpers: `services/openrouterService.ts`, `services/aiMatchService.ts`, `components/AIChat.tsx`.

If the Edge Function is not deployed, chat can fall back to `VITE_OPENROUTER_API_KEY` (less secure). Prefer this Edge Function in production. Matching/quote actions need the Edge Function + auth.

## Local development

```bash
# Create supabase/.env.local with:
# OPENROUTER_API_KEY=sk-or-v1-...
# OPENROUTER_HTTP_REFERER=http://localhost:5173
# OPENROUTER_APP_TITLE=FORGE

supabase functions serve ai-chat --env-file .env.local
```

## Security note

Prefer `OPENROUTER_API_KEY` as a Supabase secret. Never commit `.env.local`. If you must use `VITE_OPENROUTER_API_KEY` on Render for a quick SPA-only setup, rotate the key regularly.
