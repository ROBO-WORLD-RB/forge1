/**
 * Paystack Payment Service
 * Handles payment initialization and verification for Ghana (GHS) and Nigeria (NGN)
 */

import type {
  PaymentInitializeParams,
  PaystackTransaction,
  PaystackPopupOptions,
  PaymentCurrency,
  BookingRequest,
} from '../types/payment';
import { logger } from '../utils/logger';

// Paystack public key from environment
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

// Paystack popup script URL
const PAYSTACK_SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';

// Track if script is loaded
let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

/**
 * Load Paystack inline script dynamically
 */
export async function loadPaystackScript(): Promise<void> {
  if (scriptLoaded) return;

  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.PaystackPop) {
      scriptLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      scriptLoaded = true;
      logger.info('Paystack script loaded successfully');
      resolve();
    };

    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Failed to load Paystack script'));
    };

    document.head.appendChild(script);
  });

  return scriptLoading;
}

/** Payment flows routed by Paystack webhook via metadata.type */
export type PaystackPaymentType = 'booking' | 'subscription' | 'onboarding_fee';

/**
 * Canonical Paystack metadata — webhook handlers expect `type` + `user_id`.
 */
export function buildPaystackMetadata(
  type: PaystackPaymentType,
  userId: string,
  fields?: Record<string, unknown>
): Record<string, unknown> {
  return {
    type,
    user_id: userId,
    ...fields,
  };
}

/**
 * Generate a unique payment reference
 */
export function generateReference(prefix = 'FORGE'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

/**
 * Convert amount to smallest currency unit (kobo/pesewas)
 */
export function toSmallestUnit(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert from smallest currency unit to main unit
 */
export function fromSmallestUnit(amount: number): number {
  return amount / 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: PaymentCurrency): string {
  const symbol = currency === 'GHS' ? 'GH₵' : '₦';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

/**
 * Initialize Paystack popup payment
 */
export async function initializePayment(
  params: PaymentInitializeParams,
  onSuccess: (transaction: PaystackTransaction) => void,
  onClose: () => void,
  options?: { channels?: string[] }
): Promise<void> {
  // Validate public key
  if (!PAYSTACK_PUBLIC_KEY) {
    throw new Error('Paystack public key not configured. Set VITE_PAYSTACK_PUBLIC_KEY in your environment.');
  }

  // Load script if not loaded
  await loadPaystackScript();

  const reference = params.reference || generateReference();

  const setupOptions: any = {
    key: PAYSTACK_PUBLIC_KEY,
    email: params.email,
    amount: params.amount,
    currency: params.currency,
    ref: reference,
    metadata: params.metadata || {},
    ...(options?.channels ? { channels: options.channels } : {}),
    callback: (response: any) => {
      logger.info('Payment successful', { reference: response.reference });
      onSuccess({
        reference: response.reference,
        status: 'success',
        amount: params.amount,
        currency: params.currency,
        paidAt: new Date().toISOString(),
      });
    },
  };

  const handler = window.PaystackPop.setup({
    ...setupOptions,
    onClose: () => {
      logger.info('Payment popup closed', { reference });
      onClose();
    },
  });

  handler.openIframe();
}

/**
 * Calculate booking total
 */
export function calculateBookingTotal(hours: number, hourlyRate: number): number {
  return hours * hourlyRate;
}

/**
 * Worker onboarding fee payment params
 */
export function createOnboardingPayment(
  userId: string,
  email: string,
  country: 'GH' | 'NG'
): PaymentInitializeParams {
  const currency: PaymentCurrency = country === 'GH' ? 'GHS' : 'NGN';
  const amount = country === 'GH' ? 10 : 2000;

  return {
    email,
    amount: toSmallestUnit(amount),
    currency,
    reference: generateReference('ONB'),
    metadata: buildPaystackMetadata('onboarding_fee', userId),
  };
}

/**
 * Subscription payment params
 */
export function createSubscriptionPayment(
  userId: string,
  email: string,
  plan: { id: string; tier: string; price: number; currency: PaymentCurrency }
): PaymentInitializeParams {
  return {
    email,
    amount: toSmallestUnit(plan.price),
    currency: plan.currency,
    reference: generateReference('SUB'),
    metadata: buildPaystackMetadata('subscription', userId, {
      plan_id: plan.id,
      tier: plan.tier,
    }),
  };
}

/**
 * Create a booking payment request
 */
export function createBookingPayment(booking: BookingRequest): PaymentInitializeParams {
  const total = calculateBookingTotal(booking.hours, booking.hourlyRate);

  return {
    email: booking.customerEmail,
    amount: toSmallestUnit(total),
    currency: booking.currency,
    reference: generateReference('BKG'),
    metadata: buildPaystackMetadata('booking', booking.customerId, {
      workerId: booking.workerId,
      workerName: booking.workerName,
      customerName: booking.customerName,
      bookingDetails: booking.description,
      hours: booking.hours,
      hourlyRate: booking.hourlyRate,
      scheduledDate: booking.scheduledDate,
    }),
  };
}

// Extend Window interface for Paystack
declare global {
  interface Window {
    PaystackPop: {
      setup: (options: any) => { openIframe: () => void };
    };
  }
}
