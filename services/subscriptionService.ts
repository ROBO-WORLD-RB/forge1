/**
 * Subscription Service
 * Manages worker subscription tiers with local pricing for Ghana and Nigeria
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * SECURITY (M0): Clients must NOT activate paid tiers. After Paystack checkout,
 * create a pending subscription + transaction; only the paystack-webhook Edge
 * Function (service role) may set status=active and update worker_profiles.tier.
 */

import { supabase } from './supabase';
import type {
  Subscription,
  SubscriptionInsert,
  SubscriptionUpdate,
  SubscriptionStatus,
  WorkerTier,
  Country,
  Currency,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Subscription plan with pricing information
 */
export interface SubscriptionPlan {
  id: string;
  tier: WorkerTier;
  name: string;
  price: number;
  currency: Currency;
  features: string[];
}

/**
 * Result type for subscription service operations
 */
export interface SubscriptionServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Subscription status check result
 */
export type SubscriptionStatusCheck = 'active' | 'expiring' | 'expired' | 'none';

// Pricing configuration by country
const PRICING: Record<Country, Record<WorkerTier, { price: number; currency: Currency }>> = {
  GH: {
    free: { price: 0, currency: 'GHS' },
    basic: { price: 20, currency: 'GHS' },
    premium: { price: 50, currency: 'GHS' },
  },
  NG: {
    free: { price: 0, currency: 'NGN' },
    basic: { price: 2000, currency: 'NGN' },
    premium: { price: 5000, currency: 'NGN' },
  },
};

// Plan features by tier
const PLAN_FEATURES: Record<WorkerTier, string[]> = {
  free: ['Basic profile listing', 'Limited visibility'],
  basic: ['Enhanced profile listing', 'Standard visibility', 'Priority in local search'],
  premium: ['Premium profile listing', 'Maximum visibility', 'Top search ranking', 'Verified badge eligibility'],
};

/**
 * Get subscription plans with pricing for a specific country
 * Returns available tiers with local pricing (GHS for GH, NGN for NG)
 * Requirements: 1.1
 */
export function getSubscriptionPlans(country: Country): SubscriptionPlan[] {
  const countryPricing = PRICING[country];
  
  return (['free', 'basic', 'premium'] as WorkerTier[]).map((tier) => ({
    id: `${tier}-${country.toLowerCase()}`,
    tier,
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    price: countryPricing[tier].price,
    currency: countryPricing[tier].currency,
    features: PLAN_FEATURES[tier],
  }));
}


/**
 * Create a pending subscription after Paystack checkout succeeds in the UI.
 * Does NOT activate the plan or update worker_profiles.tier — webhook only.
 *
 * @param paymentReference Paystack reference (stored as provider_subscription_id for webhook match)
 * Requirements: 1.2 (intent only; activation is server-side)
 */
export async function createSubscription(
  userId: string,
  planId: string,
  paymentMethod: string,
  paymentReference?: string
): Promise<SubscriptionServiceResult<Subscription>> {
  const transaction = startTransaction('subscription.createPending', 'db');

  try {
    // Parse plan ID to get tier and country
    const [tier, countryCode] = planId.split('-') as [WorkerTier, string];
    const country = countryCode.toUpperCase() as Country;

    // Validate tier
    if (!['free', 'basic', 'premium'].includes(tier)) {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid subscription tier',
        },
      };
    }

    // Validate country
    if (!['GH', 'NG'].includes(country)) {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid country code',
        },
      };
    }

    // Free tier needs no payment / pending row
    if (tier === 'free') {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Free tier does not require a subscription record',
        },
      };
    }

    const pricing = PRICING[country][tier];
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30);

    const insertData: SubscriptionInsert = {
      user_id: userId,
      tier,
      currency: pricing.currency,
      amount: pricing.price,
      status: 'pending',
      payment_provider: paymentMethod,
      provider_subscription_id: paymentReference ?? null,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      auto_renew: true,
    };

    const { data, error } = await (supabase
      .from('subscriptions') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createSubscription' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Subscription,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Poll until webhook activates the subscription (or timeout).
 * Call after Paystack onSuccess + createSubscription(pending).
 */
export async function waitForActiveSubscription(
  userId: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<SubscriptionServiceResult<Subscription | null>> {
  const timeoutMs = options?.timeoutMs ?? 45000;
  const intervalMs = options?.intervalMs ?? 2000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await getActiveSubscription(userId);
    if (result.error) {
      return result;
    }
    if (result.data) {
      return result;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    data: null,
    error: {
      code: ERROR_CODES.VALIDATION_ERROR,
      message:
        'Payment received but subscription is not active yet. It usually activates within a minute via webhook — refresh this page shortly. Do not pay again.',
    },
  };
}

/**
 * Get the active subscription for a user
 * Returns subscription with current status, tier, and expiry information
 * Requirements: 1.3
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionServiceResult<Subscription | null>> {
  const { data, error } = await (supabase
    .from('subscriptions') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // PGRST116 means no rows returned, which is valid (no active subscription)
    if (error.code === 'PGRST116') {
      return {
        data: null,
        error: null,
      };
    }
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Subscription,
    error: null,
  };
}

/**
 * Cancel a subscription
 * Updates status to 'cancelled' and disables auto-renewal
 * Requirements: 1.4
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<SubscriptionServiceResult<Subscription>> {
  const transaction = startTransaction('subscription.cancel', 'db');

  try {
    const updateData: SubscriptionUpdate = {
      status: 'cancelled',
      auto_renew: false,
    };

    const { data, error } = await (supabase
      .from('subscriptions') as any)
      .update(updateData)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'cancelSubscription' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Subscription,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Check subscription status for a user
 * Returns 'active', 'expiring' (within 7 days), 'expired', or 'none'
 * Requirements: 1.5
 */
export async function checkSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatusCheck> {
  const { data, error } = await (supabase
    .from('subscriptions') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 'none';
  }

  const subscription = data as Subscription;
  const now = new Date();
  const expiresAt = new Date(subscription.expires_at);

  // Check if already expired
  if (expiresAt <= now) {
    return 'expired';
  }

  // Check if expiring within 7 days
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  if (expiresAt <= sevenDaysFromNow) {
    return 'expiring';
  }

  return 'active';
}

/**
 * Calculate subscription status based on expiry date
 * Pure function for testing - returns status based on dates
 * Requirements: 1.5
 */
export function calculateSubscriptionStatus(
  expiresAt: Date,
  now: Date = new Date()
): 'active' | 'expiring' | 'expired' {
  // Check if already expired
  if (expiresAt <= now) {
    return 'expired';
  }

  // Check if expiring within 7 days
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  if (expiresAt <= sevenDaysFromNow) {
    return 'expiring';
  }

  return 'active';
}

/**
 * Handle subscription expiry.
 * Updates expired subscriptions and sets worker tier to free.
 * Returns the count of subscriptions that were expired.
 *
 * **Scheduling:** This function is NOT invoked automatically by the app.
 * It must be called on a schedule — deploy `supabase/functions/subscription-expiry-cron`
 * or see `docs/CRON.md` for pg_cron / external cron options.
 *
 * Requirements: 1.6
 */
export async function handleSubscriptionExpiry(): Promise<SubscriptionServiceResult<number>> {
  const transaction = startTransaction('subscription.handleExpiry', 'db');

  try {
    const now = new Date().toISOString();

    // Find all active subscriptions that have expired
    const { data: expiredSubscriptions, error: fetchError } = await (supabase
      .from('subscriptions') as any)
      .select('id, user_id')
      .eq('status', 'active')
      .lt('expires_at', now);

    if (fetchError) {
      captureError(new Error(fetchError.message), { tags: { operation: 'handleSubscriptionExpiry' } });
      return {
        data: null,
        error: handleDatabaseError(fetchError),
      };
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return {
        data: 0,
        error: null,
      };
    }

    // Update subscription statuses to expired
    const subscriptionIds = expiredSubscriptions.map((s: { id: string }) => s.id);
    const { error: updateSubError } = await (supabase
      .from('subscriptions') as any)
      .update({ status: 'expired' as SubscriptionStatus })
      .in('id', subscriptionIds);

    if (updateSubError) {
      captureError(new Error(updateSubError.message), { tags: { operation: 'handleSubscriptionExpiry' } });
      return {
        data: null,
        error: handleDatabaseError(updateSubError),
      };
    }

    // Update worker visibility to free for expired subscriptions (service/cron path)
    const userIds = expiredSubscriptions.map((s: { user_id: string }) => s.user_id);
    const { error: updateWorkerError } = await (supabase
      .from('worker_profiles') as any)
      .update({ tier: 'free' as WorkerTier })
      .in('user_id', userIds);

    if (updateWorkerError) {
      captureError(new Error(updateWorkerError.message), { tags: { operation: 'handleSubscriptionExpiry' } });
      // Don't fail the whole operation, just log the error
    }

    return {
      data: expiredSubscriptions.length,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Subscription Service interface
 */
export interface SubscriptionService {
  getSubscriptionPlans(country: Country): SubscriptionPlan[];
  createSubscription(userId: string, planId: string, paymentMethod: string, paymentReference?: string): Promise<SubscriptionServiceResult<Subscription>>;
  waitForActiveSubscription(userId: string, options?: { timeoutMs?: number; intervalMs?: number }): Promise<SubscriptionServiceResult<Subscription | null>>;
  getActiveSubscription(userId: string): Promise<SubscriptionServiceResult<Subscription | null>>;
  cancelSubscription(subscriptionId: string): Promise<SubscriptionServiceResult<Subscription>>;
  checkSubscriptionStatus(userId: string): Promise<SubscriptionStatusCheck>;
  handleSubscriptionExpiry(): Promise<SubscriptionServiceResult<number>>;
}

// Export as a service object for compatibility with existing code patterns
export const subscriptionService: SubscriptionService = {
  getSubscriptionPlans,
  createSubscription,
  waitForActiveSubscription,
  getActiveSubscription,
  cancelSubscription,
  checkSubscriptionStatus,
  handleSubscriptionExpiry,
};

export default subscriptionService;
