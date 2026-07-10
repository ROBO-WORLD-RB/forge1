# Scheduled Jobs (Cron)

Forge has no in-repo backend server. Batch maintenance tasks must be triggered externally.

## Subscription expiry — `handleSubscriptionExpiry()`

**Location:** `services/subscriptionService.ts`

**What it does:**
- Finds `subscriptions` rows with `status = 'active'` and `expires_at < now()`
- Sets those subscriptions to `expired`
- Downgrades associated `worker_profiles.tier` to `free`

**Why cron is required:** The SPA never calls this on its own. Without a scheduled job, expired workers keep premium visibility until someone triggers the function manually.

### Option A — Supabase pg_cron (Postgres extension)

Run daily (or hourly) via SQL in the Supabase SQL editor:

```sql
-- Enable extension once (Supabase Dashboard → Database → Extensions → pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Example: run every day at 02:00 UTC
SELECT cron.schedule(
  'forge-subscription-expiry',
  '0 2 * * *',
  $$
    UPDATE subscriptions
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < now();

    UPDATE worker_profiles wp
    SET tier = 'free'
    FROM subscriptions s
    WHERE s.user_id = wp.user_id
      AND s.status = 'expired'
      AND s.expires_at < now();
  $$
);
```

Alternatively, invoke a Supabase Edge Function that wraps the same logic as `handleSubscriptionExpiry()` if you prefer TypeScript over raw SQL.

### Option B — Supabase Edge Function + Dashboard cron (recommended)

The repo includes `supabase/functions/subscription-expiry-cron/` — deploy and schedule it:

```bash
cd supabase
supabase functions deploy subscription-expiry-cron
```

Then in Supabase Dashboard → **Edge Functions** → `subscription-expiry-cron` → **Schedules**, add `0 2 * * *`.

Manual trigger:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/subscription-expiry-cron" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

See [`supabase/functions/subscription-expiry-cron/README.md`](../supabase/functions/subscription-expiry-cron/README.md).

### Option C — External cron (Render, GitHub Actions, etc.)

Call an authenticated HTTP endpoint that runs `handleSubscriptionExpiry()`:

```bash
# Example: daily at 02:00 UTC via curl + service role key
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/subscription-expiry-cron" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Use Render Cron Jobs, GitHub Actions `schedule`, or any host that supports periodic HTTP triggers.

## Verifying

After scheduling, confirm expired test subscriptions flip to `expired` and worker tiers downgrade without manual intervention.

## Related

- `PROJECT-EXPLORATION-REFERENCE.md` — § Cross-Cutting Production Gaps (subscription expiry)
- Property tests: `services/subscriptionService.property.test.ts` (`handleSubscriptionExpiry`)
