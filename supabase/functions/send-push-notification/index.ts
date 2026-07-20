/**
 * Send Push Notification — Supabase Edge Function
 *
 * Production push must NOT use VITE_FCM_SERVER_KEY in the browser.
 * Store FCM_SERVER_KEY as a Supabase secret and send from this function.
 *
 * Auth (required):
 *   • Bearer user JWT — may only target their own userId (or admin → any)
 *   • Bearer service role key — any userId
 *   • Header x-cron-secret / x-push-secret matching PUSH_CRON_SECRET or CRON_SECRET
 *
 * Deploy: supabase functions deploy send-push-notification
 * Secrets: FCM_SERVER_KEY, optional PUSH_CRON_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-push-secret',
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cronHeader =
    req.headers.get('x-cron-secret') ?? req.headers.get('x-push-secret') ?? '';
  const expectedCron =
    Deno.env.get('PUSH_CRON_SECRET') ?? Deno.env.get('CRON_SECRET') ?? '';

  let privileged = false;
  let callerUserId: string | null = null;
  let callerIsAdmin = false;

  if (expectedCron && cronHeader && cronHeader === expectedCron) {
    privileged = true;
  } else if (bearer && bearer === serviceRoleKey) {
    privileged = true;
  } else if (bearer && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    callerUserId = userData.user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUserId)
      .maybeSingle();
    callerIsAdmin = profile?.role === 'admin';
  } else {
    return jsonResponse({
      error: 'Unauthorized',
      hint: 'Send Authorization: Bearer <user JWT or service role>, or x-cron-secret',
    }, 401);
  }

  let payload: PushRequestBody;
  try {
    payload = await req.json() as PushRequestBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  if (!payload?.userId || !payload?.title || !payload?.body) {
    return jsonResponse({ error: 'userId, title, and body are required' }, 400);
  }

  if (!privileged && callerUserId) {
    if (payload.userId !== callerUserId && !callerIsAdmin) {
      return jsonResponse({
        error: 'Forbidden',
        hint: 'Users may only send push to their own userId',
      }, 403);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
