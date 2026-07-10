/**
 * Paystack Webhook — Supabase Edge Function
 *
 * Receives POST webhooks from Paystack, verifies HMAC-SHA512 signature,
 * and routes events to subscription/booking/onboarding handlers.
 *
 * Deploy: supabase functions deploy paystack-webhook --no-verify-jwt
 * Secret: supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { verifyPaystackSignature } from '../_shared/paystackCrypto.ts';
import { handlePaystackWebhook } from '../_shared/paystackWebhookHandlers.ts';
import type { PaystackWebhookEvent } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackSecret) {
    console.error('PAYSTACK_SECRET_KEY is not configured');
    return jsonResponse({ error: 'Webhook not configured' }, 500);
  }

  const signature = req.headers.get('x-paystack-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing x-paystack-signature header' }, 401);
  }

  const rawBody = await req.text();
  if (!rawBody) {
    return jsonResponse({ error: 'Empty request body' }, 400);
  }

  const isValid = await verifyPaystackSignature(rawBody, signature, paystackSecret);
  if (!isValid) {
    console.warn('Invalid Paystack webhook signature');
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  if (!event?.event || !event?.data) {
    return jsonResponse({ error: 'Invalid webhook event structure' }, 400);
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

  const result = await handlePaystackWebhook(supabase, event);

  if (!result.ok) {
    console.error('Webhook handler failed:', result.error);
    return jsonResponse({ error: result.error ?? 'Processing failed' }, 500);
  }

  return jsonResponse({ received: true, event: event.event });
});
