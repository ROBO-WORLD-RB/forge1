/**
 * Payment types for Paystack integration
 */

export type PaymentCurrency = 'GHS' | 'NGN';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export interface PaystackConfig {
  publicKey: string;
  currency: PaymentCurrency;
}

export interface PaymentInitializeParams {
  email: string;
  amount: number; // Amount in kobo/pesewas (smallest currency unit)
  currency: PaymentCurrency;
  reference?: string;
  metadata?: Record<string, any>;
  callback_url?: string;
}

export interface PaystackTransaction {
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: PaymentCurrency;
  paidAt?: string;
  channel?: string;
  metadata?: Record<string, any>;
}

export interface PaystackPopupOptions {
  key: string;
  email: string;
  amount: number;
  currency: PaymentCurrency;
  ref: string;
  metadata?: Record<string, any>;
  onClose: () => void;
  onSuccess: (transaction: PaystackTransaction) => void;
}

export interface BookingRequest {
  workerId: string;
  workerName: string;
  customerEmail: string;
  customerName: string;
  customerId: string;
  hours: number;
  hourlyRate: number;
  currency: PaymentCurrency;
  scheduledDate: string;
  description?: string;
}

export interface Booking {
  id: string;
  workerId: string;
  customerId: string;
  status: 'pending_payment' | 'paid' | 'confirmed' | 'completed' | 'cancelled';
  amount: number;
  currency: PaymentCurrency;
  paymentReference?: string;
  scheduledDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
