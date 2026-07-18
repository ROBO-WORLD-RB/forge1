# AI Chat Edge Function (OpenRouter)

Server-side proxy for Forge AI chat. Keeps `OPENROUTER_API_KEY` off the Vite client bundle.

Uses model **`openrouter/free`** (OpenRouter smart auto-routing across free models).

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

supabase functions deploy ai-chat
```

## Client usage

The SPA calls this via `supabase.functions.invoke('ai-chat', { body: { message, messages } })`.

If the Edge Function is not deployed, the client can fall back to `VITE_OPENROUTER_API_KEY` (less secure — key is public in the SPA bundle). Prefer this Edge Function in production.

## Local development

```bash
# Create supabase/.env.local with:
# OPENROUTER_API_KEY=sk-or-v1-...
# OPENROUTER_HTTP_REFERER=http://localhost:5173
# OPENROUTER_APP_TITLE=FORGE

supabase functions serve ai-chat --env-file .env.local
```

## Security note

Prefer `OPENROUTER_API_KEY` as a Supabase secret. If you must use `VITE_OPENROUTER_API_KEY` on Render for a quick SPA-only setup, rotate the key regularly and restrict allowed referrers in the OpenRouter dashboard.
