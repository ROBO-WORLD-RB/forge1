/** Shared Paystack webhook types for Supabase Edge Functions */

export type Currency = 'GHS' | 'NGN';
export type TransactionType = 'subscription' | 'booking' | 'refund';
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'abandoned';

export type PaystackEventType =
  | 'charge.success'
  | 'charge.failed'
  | 'subscription.create'
  | 'subscription.disable'
  | 'transfer.success'
  | 'transfer.failed';

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
    [key: string]: unknown;
  };
  paid_at?: string;
  channel?: string;
}

export interface PaystackWebhookEvent {
  event: PaystackEventType | string;
  data: PaystackWebhookEventData;
}

export interface TransactionInsert {
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  payment_provider: string;
  provider_txn_id?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
}

export interface SubscriptionUpdate {
  status?: string;
  expires_at?: string;
}

export interface HandlerResult {
  ok: boolean;
  error?: string;
}
