# Paystack Webhook Edge Function

Server-side webhook endpoint for Forge. Verifies Paystack HMAC-SHA512 signatures and updates transactions, subscriptions, worker onboarding status, and booking payments.

**Do not** expose `PAYSTACK_SECRET_KEY` to the Vite client. Use `VITE_PAYSTACK_PUBLIC_KEY` in the frontend only.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
- A linked Supabase project (`supabase link --project-ref <your-ref>`)
- Paystack secret key from [Paystack Dashboard → Settings → API Keys](https://dashboard.paystack.com/#/settings/developers)

## Deploy

```bash
# From the repo root
cd supabase

# Set the server-side secret (never prefix with VITE_)
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here

# Deploy the function (JWT verification disabled — Paystack has no Supabase token)
supabase functions deploy paystack-webhook --no-verify-jwt
```

After deploy, your webhook URL is:

```
https://<project-ref>.supabase.co/functions/v1/paystack-webhook
```

Register this URL in Paystack Dashboard → Settings → Webhooks.

## Local development

```bash
# Create supabase/.env.local with:
# PAYSTACK_SECRET_KEY=sk_test_...
# SUPABASE_URL=http://127.0.0.1:54321
# SUPABASE_SERVICE_ROLE_KEY=<local service role key from supabase start>

supabase functions serve paystack-webhook --no-verify-jwt --env-file .env.local
```

Test with a signed payload:

```bash
# Generate signature (example using openssl)
BODY='{"event":"charge.success","data":{"reference":"TEST_REF","amount":100000,"currency":"NGN","status":"success","metadata":{"user_id":"uuid","type":"subscription"}}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | awk '{print $2}')

curl -X POST http://127.0.0.1:54321/functions/v1/paystack-webhook \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIG" \
  -d "$BODY"
```

## Handled events

| Event | Action |
|-------|--------|
| `charge.success` | Routes by `metadata.type`: subscription, booking, onboarding_fee |
| `charge.failed` | Updates subscription/booking transaction status |
| `subscription.create` / `subscription.disable` | Subscription lifecycle |
| `transfer.success` / `transfer.failed` | Logs refund transactions |

Handler logic mirrors `services/paymentWebhookService.ts` in the Deno shared module at `supabase/functions/_shared/paystackWebhookHandlers.ts`.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `PAYSTACK_SECRET_KEY` | Supabase secrets | HMAC verification (server only) |
| `SUPABASE_URL` | Auto-injected | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Service role DB access |
