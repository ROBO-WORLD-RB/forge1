/**
 * Subscription Expiry Cron — Supabase Edge Function
 *
 * Scheduled job that expires overdue subscriptions and downgrades worker tiers.
 * Mirrors `subscriptionService.handleSubscriptionExpiry()` using the service role.
 *
 * Deploy: supabase functions deploy subscription-expiry-cron
 * Schedule: Dashboard → Edge Functions → subscription-expiry-cron → Schedules
 *           e.g. `0 2 * * *` (daily at 02:00 UTC)
 *
 * Manual trigger (external cron):
 *   curl -X POST "https://<ref>.supabase.co/functions/v1/subscription-expiry-cron" \
 *     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleSubscriptionExpiry } from '../_shared/subscriptionExpiry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('SUBSCRIPTION_CRON_SECRET');

  const authHeader = req.headers.get('Authorization');
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return true;
  }

  const secretHeader = req.headers.get('x-cron-secret');
  if (cronSecret && secretHeader === cronSecret) {
    return true;
  }

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase environment variables are missing');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await handleSubscriptionExpiry(supabase);

  if (!result.ok) {
    console.error('Subscription expiry failed:', result.error);
    return jsonResponse({ error: result.error ?? 'Processing failed' }, 500);
  }

  return jsonResponse({ ok: true, expiredCount: result.expiredCount });
});
