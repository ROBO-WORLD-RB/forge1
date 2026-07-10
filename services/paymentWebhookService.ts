/**
 * Payment Webhook Service
 * Handles Paystack webhook event processing logic (subscription, booking, onboarding).
 *
 * IMPORTANT: Webhook HTTP verification must run server-side only.
 * The live endpoint is the Supabase Edge Function at
 * `supabase/functions/paystack-webhook` — it verifies HMAC-SHA512 using
 * `PAYSTACK_SECRET_KEY` (not VITE_). Do not call verifyPaystackSignature
 * from the browser or expose the secret key to the client bundle.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { supabase } from './supabase';
import type {
  Transaction,
  TransactionInsert,
  TransactionType,
  Currency,
  SubscriptionUpdate,
  BookingUpdate,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';
import { logger } from '../utils/logger';

/**
 * Extended error codes for payment webhook operations
 */
export const PAYMENT_ERROR_CODES = {
  INVALID_SIGNATURE: 'PAY_001',
  PAYMENT_FAILED: 'PAY_002',
  DUPLICATE_TRANSACTION: 'PAY_003',
  SUBSCRIPTION_NOT_FOUND: 'PAY_004',
  BOOKING_NOT_FOUND: 'PAY_005',
  INVALID_EVENT_TYPE: 'PAY_006',
} as const;

/**
 * Result type for payment webhook service operations
 */
export interface PaymentWebhookServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Payment status from Paystack
 */
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'abandoned';

/**
 * Paystack webhook event types we handle
 */
export type PaystackEventType = 
  | 'charge.success'
  | 'charge.failed'
  | 'subscription.create'
  | 'subscription.disable'
  | 'transfer.success'
  | 'transfer.failed';

/**
 * Paystack webhook event data structure
 */
export interface PaystackWebhookEventData {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  customer?: {
    email: string;
    id: number;
  };
  metadata?: {
    user_id?: string;
    type?: 'subscription' | 'booking' | 'onboarding_fee';
    subscription_id?: string;
    booking_id?: string;
    plan_id?: string;
    [key: string]: unknown;
  };
  paid_at?: string;
  channel?: string;
}

/**
 * Paystack webhook event structure
 */
export interface PaystackWebhookEvent {
  event: PaystackEventType;
  data: PaystackWebhookEventData;
}


/**
 * Verify Paystack webhook signature using HMAC-SHA512
 * Returns true only when signature matches HMAC-SHA512(payload, secret)
 * Requirements: 5.1, 5.2
 * 
 * @param payload - The raw request body as a string
 * @param signature - The x-paystack-signature header value
 * @param secretKey - The Paystack secret key (required in production; pass explicitly in tests)
 * @returns boolean indicating if signature is valid
 *
 * @deprecated for client use — verification runs in supabase/functions/paystack-webhook only.
 */
export async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey?: string
): Promise<boolean> {
  const secret = secretKey || '';
  
  if (!secret) {
    console.warn('Paystack secret key not configured');
    return false;
  }

  if (!signature || !payload) {
    return false;
  }

  const computedHash = await computeHmacSha512(payload, secret);
  
  return constantTimeCompare(computedHash, signature);
}

/**
 * Compute HMAC-SHA512 hash using Web Crypto API
 */
export async function computeHmacSha512(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return arrayBufferToHex(signature);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hex.join('');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}


/**
 * Handle Paystack webhook event
 * Routes events to appropriate handlers based on event type
 * Requirements: 5.1, 5.2
 * 
 * @param event - The parsed webhook event
 * @returns Result indicating success or failure
 */
export async function handlePaystackWebhook(
  event: PaystackWebhookEvent
): Promise<PaymentWebhookServiceResult<void>> {
  const transaction = startTransaction('webhook.handle', 'http');

  try {
    const { event: eventType, data } = event;

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'charge.success': {
        // Determine if this is a subscription or booking payment
        const paymentType = data.metadata?.type;
        
        if (paymentType === 'subscription') {
          return await handleSubscriptionPayment(data.reference, 'success');
        } else if (paymentType === 'booking') {
          return await handleBookingPayment(data.reference, 'success');
        } else if (paymentType === 'onboarding_fee') {
          return await handleOnboardingPayment(data.reference, 'success');
        }
        
        // Log transaction even if type is unknown
        if (data.metadata?.user_id) {
          await logTransaction(
            data.metadata.user_id,
            'booking', // Default to booking
            data.amount / 100, // Convert from kobo/pesewas
            (data.currency as Currency) || 'NGN',
            'paystack',
            'success'
          );
        }
        
        return { data: null, error: null };
      }

      case 'charge.failed': {
        const paymentType = data.metadata?.type;
        
        if (paymentType === 'subscription') {
          return await handleSubscriptionPayment(data.reference, 'failed');
        } else if (paymentType === 'booking') {
          return await handleBookingPayment(data.reference, 'failed');
        }
        
        return { data: null, error: null };
      }

      case 'subscription.create':
      case 'subscription.disable': {
        // Handle subscription lifecycle events
        if (data.metadata?.subscription_id) {
          const status = eventType === 'subscription.create' ? 'success' : 'failed';
          return await handleSubscriptionPayment(data.reference, status);
        }
        return { data: null, error: null };
      }

      case 'transfer.success':
      case 'transfer.failed': {
        // Log transfer transactions
        if (data.metadata?.user_id) {
          await logTransaction(
            data.metadata.user_id,
            'refund',
            data.amount / 100,
            (data.currency as Currency) || 'NGN',
            'paystack',
            eventType === 'transfer.success' ? 'success' : 'failed'
          );
        }
        return { data: null, error: null };
      }

      default: {
        // Unknown event type - log but don't fail
        console.warn(`Unhandled webhook event type: ${eventType}`);
        return { data: null, error: null };
      }
    }
  } catch (error) {
    captureError(error as Error, { tags: { operation: 'handlePaystackWebhook' } });
    return {
      data: null,
      error: {
        code: ERROR_CODES.QUERY_FAILED,
        message: 'Failed to process webhook event',
        details: (error as Error).message,
      },
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Handle subscription payment event
 * Updates subscription status and extends expiry date on success
 * Requirements: 5.3
 * 
 * @param reference - Payment reference from Paystack
 * @param status - Payment status (success/failed)
 * @returns Result indicating success or failure
 */
export async function handleSubscriptionPayment(
  reference: string,
  status: PaymentStatus
): Promise<PaymentWebhookServiceResult<void>> {
  const transaction = startTransaction('webhook.subscriptionPayment', 'db');

  try {
    // Find the subscription by payment reference
    // First, check transactions table for the reference
    const { data: txn, error: txnError } = await (supabase
      .from('transactions') as any)
      .select('*')
      .eq('provider_txn_id', reference)
      .eq('type', 'subscription')
      .single();

    if (txnError && txnError.code !== 'PGRST116') {
      return {
        data: null,
        error: handleDatabaseError(txnError),
      };
    }

    // If we found a transaction, get the user_id to find their subscription
    let userId: string | null = txn?.user_id || null;

    // If no transaction found, try to find subscription by provider_subscription_id
    if (!userId) {
      const { data: sub, error: subError } = await (supabase
        .from('subscriptions') as any)
        .select('user_id')
        .eq('provider_subscription_id', reference)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        return {
          data: null,
          error: handleDatabaseError(subError),
        };
      }

      userId = sub?.user_id || null;
    }

    if (!userId) {
      // No subscription found for this reference - might be a new subscription
      // Log warning but don't fail
      console.warn(`No subscription found for reference: ${reference}`);
      return { data: null, error: null };
    }

    if (status === 'success') {
      // Extend subscription expiry by 30 days
      const now = new Date();
      const newExpiry = new Date(now);
      newExpiry.setDate(newExpiry.getDate() + 30);

      const updateData: SubscriptionUpdate = {
        status: 'active',
        expires_at: newExpiry.toISOString(),
      };

      const { error: updateError } = await (supabase
        .from('subscriptions') as any)
        .update(updateData)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (updateError) {
        captureError(new Error(updateError.message), { 
          tags: { operation: 'handleSubscriptionPayment' } 
        });
        return {
          data: null,
          error: handleDatabaseError(updateError),
        };
      }
    } else if (status === 'failed') {
      // Mark subscription as needing attention but don't expire immediately
      // The scheduled expiry handler will take care of expired subscriptions
      console.warn(`Subscription payment failed for user: ${userId}, reference: ${reference}`);
    }

    return { data: null, error: null };
  } finally {
    transaction.finish();
  }
}

/**
 * Handle booking payment event
 * Updates booking payment status
 * Requirements: 5.4
 * 
 * @param reference - Payment reference from Paystack
 * @param status - Payment status (success/failed)
 * @returns Result indicating success or failure
 */
export async function handleBookingPayment(
  reference: string,
  status: PaymentStatus
): Promise<PaymentWebhookServiceResult<void>> {
  const transaction = startTransaction('webhook.bookingPayment', 'db');

  try {
    // Find the transaction by reference to get booking info
    const { data: txn, error: txnError } = await (supabase
      .from('transactions') as any)
      .select('*')
      .eq('provider_txn_id', reference)
      .eq('type', 'booking')
      .single();

    if (txnError && txnError.code !== 'PGRST116') {
      return {
        data: null,
        error: handleDatabaseError(txnError),
      };
    }

    // Get booking_id from transaction metadata
    const bookingId = txn?.metadata?.booking_id;

    if (!bookingId) {
      // No booking found for this reference
      console.warn(`No booking found for reference: ${reference}`);
      return { data: null, error: null };
    }

    // Update booking based on payment status
    // Note: We don't change the booking status directly here
    // The booking status is managed by the booking service
    // We just update the transaction status
    
    if (status === 'success') {
      // Update transaction status to success
      const { error: updateError } = await (supabase
        .from('transactions') as any)
        .update({ status: 'success' })
        .eq('provider_txn_id', reference);

      if (updateError) {
        captureError(new Error(updateError.message), { 
          tags: { operation: 'handleBookingPayment' } 
        });
        return {
          data: null,
          error: handleDatabaseError(updateError),
        };
      }
    } else if (status === 'failed') {
      // Update transaction status to failed
      const { error: updateError } = await (supabase
        .from('transactions') as any)
        .update({ status: 'failed' })
        .eq('provider_txn_id', reference);

      if (updateError) {
        captureError(new Error(updateError.message), { 
          tags: { operation: 'handleBookingPayment' } 
        });
        return {
          data: null,
          error: handleDatabaseError(updateError),
        };
      }
    }

    return { data: null, error: null };
  } finally {
    transaction.finish();
  }
}

/**
 * Handle onboarding fee payment event
 * Activates worker status on success
 */
export async function handleOnboardingPayment(
  reference: string,
  status: PaymentStatus
): Promise<PaymentWebhookServiceResult<void>> {
  const transaction = startTransaction('webhook.onboardingPayment', 'db');

  try {
    const { data: txn, error: txnError } = await (supabase
      .from('transactions') as any)
      .select('*')
      .eq('provider_txn_id', reference)
      .single();

    if (txnError && txnError.code !== 'PGRST116') {
      return { data: null, error: handleDatabaseError(txnError) };
    }

    const userId = txn?.user_id;
    if (!userId) {
      console.warn(`No user found for onboarding reference: ${reference}`);
      return { data: null, error: null };
    }

    if (status === 'success') {
      const { error: updateError } = await (supabase
        .from('profiles') as any)
        .update({ worker_status: 'active' })
        .eq('id', userId);

      if (updateError) {
        captureError(new Error(updateError.message), { tags: { operation: 'handleOnboardingPayment' } });
        return { data: null, error: handleDatabaseError(updateError) };
      }

      await (supabase.from('transactions') as any)
        .update({ status: 'success' })
        .eq('provider_txn_id', reference);
    }

    return { data: null, error: null };
  } finally {
    transaction.finish();
  }
}


/**
 * Log a transaction record
 * Creates a transaction record with user, type, amount, currency, provider, and status
 * Requirements: 5.5
 * 
 * @param userId - User ID associated with the transaction
 * @param type - Transaction type (subscription/booking/refund)
 * @param amount - Transaction amount in main currency unit
 * @param currency - Currency code (GHS/NGN)
 * @param provider - Payment provider name
 * @param status - Transaction status
 * @param metadata - Optional additional metadata
 * @param providerTxnId - Optional provider transaction ID
 * @returns Result with created transaction or error
 */
export async function logTransaction(
  userId: string,
  type: TransactionType,
  amount: number,
  currency: Currency,
  provider: string,
  status: string,
  metadata?: Record<string, unknown>,
  providerTxnId?: string
): Promise<PaymentWebhookServiceResult<Transaction>> {
  const transaction = startTransaction('webhook.logTransaction', 'db');

  try {
    if (providerTxnId) {
      const existing = await getTransactionByReference(providerTxnId);
      if (existing.data) {
        const mergedMetadata = metadata
          ? { ...(existing.data.metadata as Record<string, unknown> | null), ...metadata }
          : existing.data.metadata;

        const { data, error } = await (supabase
          .from('transactions') as any)
          .update({ status, metadata: mergedMetadata })
          .eq('provider_txn_id', providerTxnId)
          .select()
          .single();

        if (error) {
          // Client RLS often allows INSERT but not UPDATE — keep the existing row
          logger.warn('Could not update existing transaction (RLS or DB)', {
            providerTxnId,
            error: error.message,
          });
          return {
            data: existing.data,
            error: null,
          };
        }

        return {
          data: data as Transaction,
          error: null,
        };
      }
    }

    const insertData: TransactionInsert = {
      user_id: userId,
      type,
      amount,
      currency,
      payment_provider: provider,
      provider_txn_id: providerTxnId || null,
      status,
      metadata: metadata || null,
    };

    const { data, error } = await (supabase
      .from('transactions') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'logTransaction' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Transaction,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get transaction by reference
 * Retrieves a transaction by its provider transaction ID
 * 
 * @param reference - Provider transaction ID
 * @returns Result with transaction or error
 */
export async function getTransactionByReference(
  reference: string
): Promise<PaymentWebhookServiceResult<Transaction | null>> {
  const { data, error } = await (supabase
    .from('transactions') as any)
    .select('*')
    .eq('provider_txn_id', reference)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { data: null, error: null };
    }
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Transaction,
    error: null,
  };
}

/**
 * Get transactions by user
 * Retrieves all transactions for a user
 * 
 * @param userId - User ID
 * @param type - Optional transaction type filter
 * @returns Result with transactions or error
 */
export async function getTransactionsByUser(
  userId: string,
  type?: TransactionType
): Promise<PaymentWebhookServiceResult<Transaction[]>> {
  let query = (supabase.from('transactions') as any)
    .select('*')
    .eq('user_id', userId);

  if (type) {
    query = query.eq('type', type);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: (data || []) as Transaction[],
    error: null,
  };
}

/**
 * Payment Webhook Service interface
 */
export interface PaymentWebhookService {
  verifyPaystackSignature(payload: string, signature: string, secretKey?: string): Promise<boolean>;
  handlePaystackWebhook(event: PaystackWebhookEvent): Promise<PaymentWebhookServiceResult<void>>;
  handleSubscriptionPayment(reference: string, status: PaymentStatus): Promise<PaymentWebhookServiceResult<void>>;
  handleBookingPayment(reference: string, status: PaymentStatus): Promise<PaymentWebhookServiceResult<void>>;
  logTransaction(
    userId: string,
    type: TransactionType,
    amount: number,
    currency: Currency,
    provider: string,
    status: string,
    metadata?: Record<string, unknown>,
    providerTxnId?: string
  ): Promise<PaymentWebhookServiceResult<Transaction>>;
  getTransactionByReference(reference: string): Promise<PaymentWebhookServiceResult<Transaction | null>>;
  getTransactionsByUser(userId: string, type?: TransactionType): Promise<PaymentWebhookServiceResult<Transaction[]>>;
}

// Export as a service object for compatibility with existing code patterns
export const paymentWebhookService: PaymentWebhookService = {
  verifyPaystackSignature,
  handlePaystackWebhook,
  handleSubscriptionPayment,
  handleBookingPayment,
  handleOnboardingPayment,
  logTransaction,
  getTransactionByReference,
  getTransactionsByUser,
};

export default paymentWebhookService;
