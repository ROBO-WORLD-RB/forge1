/**
 * Subscription expiry logic — shared between Edge Functions and mirrors
 * `services/subscriptionService.ts` → `handleSubscriptionExpiry()`.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export interface SubscriptionExpiryResult {
  ok: boolean;
  expiredCount: number;
  error?: string;
}

/**
 * Find active subscriptions past expires_at, mark them expired, and downgrade
 * associated worker_profiles.tier to 'free'.
 */
export async function handleSubscriptionExpiry(
  supabase: SupabaseClient,
): Promise<SubscriptionExpiryResult> {
  const now = new Date().toISOString();

  const { data: expiredSubscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('expires_at', now);

  if (fetchError) {
    return { ok: false, expiredCount: 0, error: fetchError.message };
  }

  if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
    return { ok: true, expiredCount: 0 };
  }

  const subscriptionIds = expiredSubscriptions.map((s: { id: string }) => s.id);
  const { error: updateSubError } = await supabase
    .from('subscriptions')
    .update({ status: 'expired' })
    .in('id', subscriptionIds);

  if (updateSubError) {
    return { ok: false, expiredCount: 0, error: updateSubError.message };
  }

  const userIds = expiredSubscriptions.map((s: { user_id: string }) => s.user_id);
  const { error: updateWorkerError } = await supabase
    .from('worker_profiles')
    .update({ tier: 'free' })
    .in('user_id', userIds);

  if (updateWorkerError) {
    console.warn('Failed to downgrade worker tiers:', updateWorkerError.message);
  }

  return { ok: true, expiredCount: expiredSubscriptions.length };
}
