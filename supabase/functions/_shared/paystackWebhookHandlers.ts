/**
 * Paystack webhook handlers — server-side port of services/paymentWebhookService.ts
 * Uses Supabase service role client for database updates.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type {
  Currency,
  HandlerResult,
  PaystackWebhookEvent,
  PaymentStatus,
  SubscriptionUpdate,
  TransactionInsert,
  TransactionType,
} from './types.ts';

export async function handlePaystackWebhook(
  supabase: SupabaseClient,
  event: PaystackWebhookEvent,
): Promise<HandlerResult> {
  try {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'charge.success': {
        const paymentType = data.metadata?.type;

        if (paymentType === 'subscription') {
          return await handleSubscriptionPayment(supabase, data.reference, 'success');
        }
        if (paymentType === 'booking') {
          return await handleBookingPayment(supabase, data.reference, 'success', data);
        }
        if (paymentType === 'onboarding_fee') {
          return await handleOnboardingPayment(supabase, data.reference, 'success');
        }

        if (data.metadata?.user_id) {
          await logTransaction(
            supabase,
            data.metadata.user_id,
            'booking',
            data.amount / 100,
            (data.currency as Currency) || 'NGN',
            'paystack',
            'success',
          );
        }

        return { ok: true };
      }

      case 'charge.failed': {
        const paymentType = data.metadata?.type;

        if (paymentType === 'subscription') {
          return await handleSubscriptionPayment(supabase, data.reference, 'failed');
        }
        if (paymentType === 'booking') {
          return await handleBookingPayment(supabase, data.reference, 'failed', data);
        }

        return { ok: true };
      }

      case 'subscription.create':
      case 'subscription.disable': {
        if (data.metadata?.subscription_id) {
          const status = eventType === 'subscription.create' ? 'success' : 'failed';
          return await handleSubscriptionPayment(supabase, data.reference, status);
        }
        return { ok: true };
      }

      case 'transfer.success':
      case 'transfer.failed': {
        if (data.metadata?.user_id) {
          await logTransaction(
            supabase,
            data.metadata.user_id,
            'refund',
            data.amount / 100,
            (data.currency as Currency) || 'NGN',
            'paystack',
            eventType === 'transfer.success' ? 'success' : 'failed',
          );
        }
        return { ok: true };
      }

      default:
        console.warn(`Unhandled webhook event type: ${eventType}`);
        return { ok: true };
    }
  } catch (error) {
    console.error('handlePaystackWebhook error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to process webhook event',
    };
  }
}

export async function handleSubscriptionPayment(
  supabase: SupabaseClient,
  reference: string,
  status: PaymentStatus,
): Promise<HandlerResult> {
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .select('*')
    .eq('provider_txn_id', reference)
    .eq('type', 'subscription')
    .maybeSingle();

  if (txnError) {
    return { ok: false, error: txnError.message };
  }

  const metadata = (txn?.metadata ?? {}) as Record<string, unknown>;
  let userId: string | null = txn?.user_id ?? (typeof metadata.user_id === 'string' ? metadata.user_id : null);

  if (!userId) {
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('provider_subscription_id', reference)
      .maybeSingle();

    if (subError) {
      return { ok: false, error: subError.message };
    }

    userId = sub?.user_id ?? null;
  }

  if (!userId) {
    console.warn(`No subscription found for reference: ${reference}`);
    return { ok: true };
  }

  if (status === 'success') {
    const now = new Date();
    const newExpiry = new Date(now);
    newExpiry.setDate(newExpiry.getDate() + 30);

    const tierRaw = typeof metadata.tier === 'string' ? metadata.tier : null;
    const tier = tierRaw && ['basic', 'premium', 'free'].includes(tierRaw) ? tierRaw : null;
    const currency = (txn?.currency as string) || 'GHS';
    const amount = typeof txn?.amount === 'number' ? txn.amount : 0;

    // Prefer pending row created by client after checkout; else active (renewal); else insert.
    const { data: pendingOrActive, error: findError } = await supabase
      .from('subscriptions')
      .select('id, tier, status')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      return { ok: false, error: findError.message };
    }

    const resolvedTier = tier || pendingOrActive?.tier || 'basic';

    if (pendingOrActive) {
      const updateData: SubscriptionUpdate & {
        provider_subscription_id?: string;
        started_at?: string;
        tier?: string;
        amount?: number;
        currency?: string;
      } = {
        status: 'active',
        expires_at: newExpiry.toISOString(),
        provider_subscription_id: reference,
        started_at: now.toISOString(),
        tier: resolvedTier,
      };
      if (txn?.amount != null) updateData.amount = amount;
      if (txn?.currency) updateData.currency = currency;

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', pendingOrActive.id);

      if (updateError) {
        return { ok: false, error: updateError.message };
      }
    } else {
      const { error: insertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        tier: resolvedTier,
        currency,
        amount,
        status: 'active',
        payment_provider: 'paystack',
        provider_subscription_id: reference,
        started_at: now.toISOString(),
        expires_at: newExpiry.toISOString(),
        auto_renew: true,
      });

      if (insertError) {
        return { ok: false, error: insertError.message };
      }
    }

    if (resolvedTier !== 'free') {
      const { error: workerError } = await supabase
        .from('worker_profiles')
        .update({ tier: resolvedTier })
        .eq('user_id', userId);

      if (workerError) {
        console.warn('Failed to update worker tier after subscription:', workerError.message);
      }
    }

    await supabase
      .from('transactions')
      .update({ status: 'success' })
      .eq('provider_txn_id', reference);
  } else if (status === 'failed') {
    console.warn(`Subscription payment failed for user: ${userId}, reference: ${reference}`);
    await supabase
      .from('transactions')
      .update({ status: 'failed' })
      .eq('provider_txn_id', reference);
  }

  return { ok: true };
}

export async function handleBookingPayment(
  supabase: SupabaseClient,
  reference: string,
  status: PaymentStatus,
  eventData?: PaystackWebhookEvent['data'],
): Promise<HandlerResult> {
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .select('*')
    .eq('provider_txn_id', reference)
    .eq('type', 'booking')
    .maybeSingle();

  if (txnError) {
    return { ok: false, error: txnError.message };
  }

  const metadata = (txn?.metadata ?? eventData?.metadata ?? {}) as Record<string, unknown>;
  const bookingId =
    (typeof metadata.booking_id === 'string' && metadata.booking_id) ||
    (typeof eventData?.metadata?.booking_id === 'string' && eventData.metadata.booking_id) ||
    null;

  const txnStatus = status === 'success' ? 'success' : 'failed';

  if (txn) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: txnStatus })
      .eq('provider_txn_id', reference);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  } else if (status === 'success' && eventData?.metadata?.user_id) {
    // Webhook arrived before client logged the transaction — create authoritative row
    const amount = typeof eventData.amount === 'number' ? eventData.amount / 100 : 0;
    const currency = ((eventData.currency as Currency) || 'NGN') as Currency;
    await logTransaction(
      supabase,
      eventData.metadata.user_id,
      'booking',
      amount,
      currency,
      'paystack',
      'success',
      {
        ...metadata,
        booking_id: bookingId,
        source: 'paystack_webhook',
      },
      reference,
    );
  }

  if (status === 'failed' && bookingId) {
    await supabase
      .from('bookings')
      .update({ payment_status: 'failed' })
      .eq('id', bookingId);
    return { ok: true };
  }

  if (status !== 'success') {
    return { ok: true };
  }

  if (!bookingId) {
    console.warn(
      `Booking payment success for ${reference} but no booking_id yet — client will fund escrow after createDirectBooking`,
    );
    return { ok: true };
  }

  // Service-role RPC: create escrow hold + pending ledger (idempotent)
  const amount =
    typeof txn?.amount === 'number'
      ? txn.amount
      : typeof eventData?.amount === 'number'
      ? eventData.amount / 100
      : null;
  const currency =
    (txn?.currency as Currency | undefined) ||
    ((eventData?.currency as Currency) || null);

  const { error: fundError } = await supabase.rpc('fund_booking_escrow', {
    p_booking_id: bookingId,
    p_provider_txn_id: reference,
    p_amount: amount,
    p_currency: currency,
  });

  if (fundError) {
    console.error('fund_booking_escrow failed:', fundError.message);
    // Do not fail the whole webhook — txn is already success; client/retry can fund
    return { ok: true };
  }

  return { ok: true };
}

export async function handleOnboardingPayment(
  supabase: SupabaseClient,
  reference: string,
  status: PaymentStatus,
): Promise<HandlerResult> {
  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .select('*')
    .eq('provider_txn_id', reference)
    .maybeSingle();

  if (txnError) {
    return { ok: false, error: txnError.message };
  }

  const userId = txn?.user_id;
  if (!userId) {
    console.warn(`No user found for onboarding reference: ${reference}`);
    return { ok: true };
  }

  if (status === 'success') {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ worker_status: 'active' })
      .eq('id', userId);

    if (profileError) {
      return { ok: false, error: profileError.message };
    }

    const { error: txnUpdateError } = await supabase
      .from('transactions')
      .update({ status: 'success' })
      .eq('provider_txn_id', reference);

    if (txnUpdateError) {
      return { ok: false, error: txnUpdateError.message };
    }
  }

  return { ok: true };
}

export async function logTransaction(
  supabase: SupabaseClient,
  userId: string,
  type: TransactionType,
  amount: number,
  currency: Currency,
  provider: string,
  status: string,
  metadata?: Record<string, unknown>,
  providerTxnId?: string,
): Promise<HandlerResult> {
  const insertData: TransactionInsert = {
    user_id: userId,
    type,
    amount,
    currency,
    payment_provider: provider,
    provider_txn_id: providerTxnId ?? null,
    status,
    metadata: metadata ?? null,
  };

  const { error } = await supabase.from('transactions').insert(insertData);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
