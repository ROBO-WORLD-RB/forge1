/**
 * Send Push Notification — Supabase Edge Function (stub)
 *
 * Production push notifications must NOT use VITE_FCM_SERVER_KEY in the browser.
 * Store FCM_SERVER_KEY as a Supabase secret and send from this function instead.
 *
 * Deploy: supabase functions deploy send-push-notification
 * Secret: supabase secrets set FCM_SERVER_KEY=your_firebase_server_key
 *
 * This stub validates auth and returns 501 until FCM sending is implemented.
 * Client code should call this function instead of notificationService.sendPushNotification()
 * for server-side delivery.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface PushRequestBody {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: PushRequestBody;
  try {
    payload = await req.json() as PushRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  if (!payload?.userId || !payload?.title || !payload?.body) {
    return jsonResponse({ error: 'userId, title, and body are required' }, 400);
  }

  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
  if (!fcmServerKey) {
    return jsonResponse({
      error: 'FCM not configured',
      hint: 'Set FCM_SERVER_KEY via supabase secrets set FCM_SERVER_KEY=...',
    }, 501);
  }

  const { data: tokens, error: tokenError } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', payload.userId);

  if (tokenError) {
    return jsonResponse({ error: tokenError.message }, 500);
  }

  if (!tokens || tokens.length === 0) {
    return jsonResponse({ ok: true, sent: 0, message: 'No device tokens registered' });
  }

  const deviceTokens = tokens.map((t: { token: string }) => t.token);

  const response = await fetch(FCM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${fcmServerKey}`,
    },
    body: JSON.stringify({
      registration_ids: deviceTokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('FCM send failed:', errorText);
    return jsonResponse({ error: 'FCM send failed' }, 502);
  }

  return jsonResponse({ ok: true, sent: deviceTokens.length });
});
