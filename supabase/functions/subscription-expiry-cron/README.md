# Subscription Expiry Cron Edge Function

Scheduled maintenance job for Forge. Expires overdue subscriptions and downgrades worker tiers to `free`.

Logic mirrors `services/subscriptionService.ts` → `handleSubscriptionExpiry()`.

## Deploy

```bash
# From the repo root
cd supabase

# Optional: lightweight secret for external cron (alternative to service role key)
supabase secrets set SUBSCRIPTION_CRON_SECRET=your-random-secret-here

# Deploy (JWT verification enabled — callers must authenticate)
supabase functions deploy subscription-expiry-cron
```

After deploy, your endpoint is:

```
https://<project-ref>.supabase.co/functions/v1/subscription-expiry-cron
```

## Schedule (recommended)

1. Supabase Dashboard → **Edge Functions** → `subscription-expiry-cron`
2. Open **Schedules** → **Create schedule**
3. Cron expression: `0 2 * * *` (daily at 02:00 UTC)

Supabase invokes scheduled functions with service-role authorization automatically.

## Manual / external cron trigger

```bash
# Using service role key (preferred)
curl -X POST "https://<project-ref>.supabase.co/functions/v1/subscription-expiry-cron" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Or using optional cron secret (if SUBSCRIPTION_CRON_SECRET is set)
curl -X POST "https://<project-ref>.supabase.co/functions/v1/subscription-expiry-cron" \
  -H "x-cron-secret: your-random-secret-here"
```

## Response

```json
{ "ok": true, "expiredCount": 3 }
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Auto-injected | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Service role DB access + auth |
| `SUBSCRIPTION_CRON_SECRET` | Optional secret | Alternative auth for external cron |

## Related

- `docs/CRON.md` — all scheduling options
- `LAUNCH-CHECKLIST.md` — P0 deploy steps
