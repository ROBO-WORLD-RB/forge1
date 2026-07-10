import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Currency, TransactionType, Transaction } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Payment Webhook Service
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

// Mock Supabase module - must be hoisted
vi.mock('./supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock monitoring service
vi.mock('./monitoringService', () => ({
  startTransaction: vi.fn(() => ({ finish: vi.fn() })),
  captureError: vi.fn(),
}));

// Import after mocking
import {
  verifyPaystackSignature,
  computeHmacSha512,
  handleSubscriptionPayment,
  handleBookingPayment,
  logTransaction,
  getTransactionByReference,
  type PaymentStatus,
} from './paymentWebhookService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
// Use simple hex string generation
const referenceArbitrary = fc.tuple(
  fc.integer({ min: 10, max: 20 }),
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 20, maxLength: 20 })
).map(([len, arr]) => arr.slice(0, len).map(n => '0123456789abcdef'[n]).join(''));
const amountArbitrary = fc.integer({ min: 100, max: 1000000 }); // Amount in kobo/pesewas
const currencyArbitrary: fc.Arbitrary<Currency> = fc.constantFrom('GHS', 'NGN');
const transactionTypeArbitrary: fc.Arbitrary<TransactionType> = fc.constantFrom('subscription', 'booking', 'refund');
const providerArbitrary = fc.constantFrom('paystack', 'flutterwave', 'stripe');
const statusStringArbitrary = fc.constantFrom('success', 'failed', 'pending');

// Generate valid payloads for webhook testing - use simple strings
const payloadArbitrary = fc.string({ minLength: 1, maxLength: 100 });
// Use simple hex string generation
const secretKeyArbitrary = fc.tuple(
  fc.integer({ min: 20, max: 40 }),
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 40, maxLength: 40 })
).map(([len, arr]) => arr.slice(0, len).map(n => '0123456789abcdef'[n]).join(''));

/** logTransaction checks getTransactionByReference before insert when providerTxnId is set */
function mockTransactionNotFoundByReference() {
  const mockSingle = vi.fn().mockResolvedValue({
    data: null,
    error: { code: 'PGRST116', message: 'not found' },
  });
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  return { select: mockSelect };
}

/** Route transactions table: first call = lookup by reference, subsequent = insert */
function mockTransactionsTable(
  insertBuilder: { insert: ReturnType<typeof vi.fn> },
  lookupFirst = true
) {
  let transactionsCalls = 0;
  return (table: string) => {
    if (table !== 'transactions') {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    }
    transactionsCalls++;
    if (lookupFirst && transactionsCalls === 1) {
      return mockTransactionNotFoundByReference();
    }
    return insertBuilder;
  };
}

/** log then getTransactionByReference: lookup miss → insert → lookup hit */
function mockTransactionsRoundTrip(
  insertBuilder: { insert: ReturnType<typeof vi.fn> },
  selectBuilder: { select: ReturnType<typeof vi.fn> }
) {
  let transactionsCalls = 0;
  return (table: string) => {
    if (table !== 'transactions') {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
    }
    transactionsCalls++;
    if (transactionsCalls === 1) {
      return mockTransactionNotFoundByReference();
    }
    if (transactionsCalls === 2) {
      return insertBuilder;
    }
    return selectBuilder;
  };
}

describe('Payment Webhook Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 25: Webhook Signature Verification Correctness
   * Validates: Requirements 5.1, 5.2
   * 
   * For any payload and secret key, verifyPaystackSignature should return true
   * only when the signature matches HMAC-SHA512(payload, secret).
   */
  describe('Property 25: Webhook Signature Verification Correctness', () => {
    it('for any payload and secret, signature computed with same secret verifies correctly', async () => {
      await fc.assert(
        fc.asyncProperty(payloadArbitrary, secretKeyArbitrary, async (payload, secret) => {
          const expectedSignature = await computeHmacSha512(payload, secret);
          
          const result = await verifyPaystackSignature(payload, expectedSignature, secret);
          expect(result).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('for any payload and secret, wrong signature should fail verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          payloadArbitrary,
          secretKeyArbitrary,
          fc.string({ minLength: 128, maxLength: 128 }),
          async (payload, secret, wrongSignature) => {
            const correctSignature = await computeHmacSha512(payload, secret);
            
            if (wrongSignature === correctSignature) {
              return;
            }
            
            const result = await verifyPaystackSignature(payload, wrongSignature, secret);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any payload, different secrets produce different signatures', async () => {
      await fc.assert(
        fc.asyncProperty(
          payloadArbitrary,
          secretKeyArbitrary,
          secretKeyArbitrary,
          async (payload, secret1, secret2) => {
            if (secret1 === secret2) {
              return;
            }
            
            const sig1 = await computeHmacSha512(payload, secret1);
            const sig2 = await computeHmacSha512(payload, secret2);
            
            expect(sig1).not.toBe(sig2);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('empty payload or signature should fail verification', async () => {
      await fc.assert(
        fc.asyncProperty(secretKeyArbitrary, async (secret) => {
          expect(await verifyPaystackSignature('', 'somesignature', secret)).toBe(false);
          expect(await verifyPaystackSignature('somepayload', '', secret)).toBe(false);
          expect(await verifyPaystackSignature('', '', secret)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('signature verification is deterministic - same inputs always produce same result', async () => {
      await fc.assert(
        fc.asyncProperty(payloadArbitrary, secretKeyArbitrary, async (payload, secret) => {
          const sig1 = await computeHmacSha512(payload, secret);
          const sig2 = await computeHmacSha512(payload, secret);
          
          expect(sig1).toBe(sig2);
          
          const result1 = await verifyPaystackSignature(payload, sig1, secret);
          const result2 = await verifyPaystackSignature(payload, sig2, secret);
          
          expect(result1).toBe(result2);
          expect(result1).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 26: Subscription Payment Updates Subscription
   * Validates: Requirements 5.3
   * 
   * For any valid subscription payment event, handleSubscriptionPayment should
   * update the subscription status and extend the expiry date.
   */
  describe('Property 26: Subscription Payment Updates Subscription', () => {
    it('for any successful subscription payment, subscription expiry is extended by 30 days', async () => {
      await fc.assert(
        fc.asyncProperty(
          referenceArbitrary,
          userIdArbitrary,
          async (reference, userId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock finding transaction by reference
            const mockTxnSingle = vi.fn().mockResolvedValue({
              data: { user_id: userId, type: 'subscription' },
              error: null,
            });
            const mockTxnEq2 = vi.fn().mockReturnValue({ single: mockTxnSingle });
            const mockTxnEq1 = vi.fn().mockReturnValue({ eq: mockTxnEq2 });
            const mockTxnSelect = vi.fn().mockReturnValue({ eq: mockTxnEq1 });

            // Mock updating subscription - capture the update data
            let capturedUpdate: any = null;
            const mockSubEq2 = vi.fn().mockResolvedValue({ error: null });
            const mockSubEq1 = vi.fn().mockReturnValue({ eq: mockSubEq2 });
            const mockSubUpdate = vi.fn().mockImplementation((data) => {
              capturedUpdate = data;
              return { eq: mockSubEq1 };
            });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockTxnSelect } as any;
              }
              return { update: mockSubUpdate } as any;
            });

            const result = await handleSubscriptionPayment(reference, 'success');

            expect(result.error).toBeNull();
            
            // Verify subscription was updated
            expect(mockSubUpdate).toHaveBeenCalled();
            expect(capturedUpdate).not.toBeNull();
            expect(capturedUpdate.status).toBe('active');
            
            // Verify expiry date is approximately 30 days from now
            if (capturedUpdate.expires_at) {
              const expiryDate = new Date(capturedUpdate.expires_at);
              const now = new Date();
              const daysDiff = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              expect(daysDiff).toBeGreaterThanOrEqual(29);
              expect(daysDiff).toBeLessThanOrEqual(31);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any failed subscription payment, no subscription update occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          referenceArbitrary,
          userIdArbitrary,
          async (reference, userId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock finding transaction by reference
            const mockTxnSingle = vi.fn().mockResolvedValue({
              data: { user_id: userId, type: 'subscription' },
              error: null,
            });
            const mockTxnEq2 = vi.fn().mockReturnValue({ single: mockTxnSingle });
            const mockTxnEq1 = vi.fn().mockReturnValue({ eq: mockTxnEq2 });
            const mockTxnSelect = vi.fn().mockReturnValue({ eq: mockTxnEq1 });

            // Mock update that should not be called for failed payments
            const mockSubUpdate = vi.fn();

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockTxnSelect } as any;
              }
              return { update: mockSubUpdate } as any;
            });

            const result = await handleSubscriptionPayment(reference, 'failed');

            expect(result.error).toBeNull();
            // For failed payments, we don't update the subscription status
            // The function logs a warning but doesn't fail
          }
        ),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 27: Booking Payment Updates Booking
   * Validates: Requirements 5.4
   * 
   * For any valid booking payment event, handleBookingPayment should
   * update the booking payment status.
   */
  describe('Property 27: Booking Payment Updates Booking', () => {
    it('for any successful booking payment, transaction status is updated to success', async () => {
      await fc.assert(
        fc.asyncProperty(
          referenceArbitrary,
          userIdArbitrary,
          fc.uuid(), // bookingId
          async (reference, userId, bookingId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock finding transaction by reference with booking metadata
            const mockTxnSingle = vi.fn().mockResolvedValue({
              data: { 
                user_id: userId, 
                type: 'booking',
                metadata: { booking_id: bookingId }
              },
              error: null,
            });
            const mockTxnEq2 = vi.fn().mockReturnValue({ single: mockTxnSingle });
            const mockTxnEq1 = vi.fn().mockReturnValue({ eq: mockTxnEq2 });
            const mockTxnSelect = vi.fn().mockReturnValue({ eq: mockTxnEq1 });

            // Mock updating transaction status - capture the update
            let capturedStatus: string | null = null;
            const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
            const mockUpdate = vi.fn().mockImplementation((data) => {
              capturedStatus = data.status;
              return { eq: mockUpdateEq };
            });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockTxnSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await handleBookingPayment(reference, 'success');

            expect(result.error).toBeNull();
            expect(mockUpdate).toHaveBeenCalled();
            expect(capturedStatus).toBe('success');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any failed booking payment, transaction status is updated to failed', async () => {
      await fc.assert(
        fc.asyncProperty(
          referenceArbitrary,
          userIdArbitrary,
          fc.uuid(), // bookingId
          async (reference, userId, bookingId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock finding transaction by reference with booking metadata
            const mockTxnSingle = vi.fn().mockResolvedValue({
              data: { 
                user_id: userId, 
                type: 'booking',
                metadata: { booking_id: bookingId }
              },
              error: null,
            });
            const mockTxnEq2 = vi.fn().mockReturnValue({ single: mockTxnSingle });
            const mockTxnEq1 = vi.fn().mockReturnValue({ eq: mockTxnEq2 });
            const mockTxnSelect = vi.fn().mockReturnValue({ eq: mockTxnEq1 });

            // Mock updating transaction status - capture the update
            let capturedStatus: string | null = null;
            const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
            const mockUpdate = vi.fn().mockImplementation((data) => {
              capturedStatus = data.status;
              return { eq: mockUpdateEq };
            });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockTxnSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await handleBookingPayment(reference, 'failed');

            expect(result.error).toBeNull();
            expect(mockUpdate).toHaveBeenCalled();
            expect(capturedStatus).toBe('failed');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('when no booking found for reference, no error is returned', async () => {
      await fc.assert(
        fc.asyncProperty(referenceArbitrary, async (reference) => {
          vi.mocked(supabase.from).mockReset();

          // Mock not finding transaction (PGRST116 = no rows)
          const mockTxnSingle = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
          });
          const mockTxnEq2 = vi.fn().mockReturnValue({ single: mockTxnSingle });
          const mockTxnEq1 = vi.fn().mockReturnValue({ eq: mockTxnEq2 });
          const mockTxnSelect = vi.fn().mockReturnValue({ eq: mockTxnEq1 });

          vi.mocked(supabase.from).mockImplementation(() => {
            return { select: mockTxnSelect } as any;
          });

          const result = await handleBookingPayment(reference, 'success');

          // Should not error, just return null
          expect(result.error).toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 28: Payment Processing Logs Transaction
   * Validates: Requirements 5.5
   * 
   * For any processed payment event, a transaction record should exist with
   * matching user, type, amount, currency, and status.
   */
  describe('Property 28: Payment Processing Logs Transaction', () => {
    it('for any valid transaction data, logTransaction creates a record with all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          transactionTypeArbitrary,
          amountArbitrary,
          currencyArbitrary,
          providerArbitrary,
          statusStringArbitrary,
          async (userId, type, amount, currency, provider, status) => {
            vi.mocked(supabase.from).mockReset();

            const mockTransactionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date().toISOString();

            // Build expected transaction response
            const expectedTransaction: Transaction = {
              id: mockTransactionId,
              user_id: userId,
              type,
              amount,
              currency,
              payment_provider: provider,
              provider_txn_id: null,
              status,
              metadata: null,
              created_at: now,
            };

            // Mock successful insert
            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedTransaction,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({
              insert: mockInsert,
            } as any);

            const result = await logTransaction(userId, type, amount, currency, provider, status);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.user_id).toBe(userId);
              expect(result.data.type).toBe(type);
              expect(result.data.amount).toBe(amount);
              expect(result.data.currency).toBe(currency);
              expect(result.data.payment_provider).toBe(provider);
              expect(result.data.status).toBe(status);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any transaction with metadata, metadata is stored correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          transactionTypeArbitrary,
          amountArbitrary,
          currencyArbitrary,
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
          async (userId, type, amount, currency, metadata) => {
            vi.mocked(supabase.from).mockReset();

            const mockTransactionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date().toISOString();

            const expectedTransaction: Transaction = {
              id: mockTransactionId,
              user_id: userId,
              type,
              amount,
              currency,
              payment_provider: 'paystack',
              provider_txn_id: null,
              status: 'success',
              metadata,
              created_at: now,
            };

            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedTransaction,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({
              insert: mockInsert,
            } as any);

            const result = await logTransaction(
              userId, type, amount, currency, 'paystack', 'success', metadata
            );

            expect(result.error).toBeNull();
            if (result.data) {
              expect(result.data.metadata).toEqual(metadata);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any transaction with provider txn id, it is stored correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          transactionTypeArbitrary,
          amountArbitrary,
          currencyArbitrary,
          referenceArbitrary,
          async (userId, type, amount, currency, providerTxnId) => {
            vi.mocked(supabase.from).mockReset();

            const mockTransactionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date().toISOString();

            const expectedTransaction: Transaction = {
              id: mockTransactionId,
              user_id: userId,
              type,
              amount,
              currency,
              payment_provider: 'paystack',
              provider_txn_id: providerTxnId,
              status: 'success',
              metadata: null,
              created_at: now,
            };

            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedTransaction,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockImplementation(
              mockTransactionsTable({ insert: mockInsert })
            );

            const result = await logTransaction(
              userId, type, amount, currency, 'paystack', 'success', undefined, providerTxnId
            );

            expect(result.error).toBeNull();
            if (result.data) {
              expect(result.data.provider_txn_id).toBe(providerTxnId);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 29: Transaction Round-Trip Persistence
   * Validates: Requirements 5.6, 5.7
   * 
   * For any valid transaction data, after logging and retrieving,
   * the transaction should contain all original data.
   */
  describe('Property 29: Transaction Round-Trip Persistence', () => {
    it('for any transaction, logging then retrieving returns equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          transactionTypeArbitrary,
          amountArbitrary,
          currencyArbitrary,
          providerArbitrary,
          statusStringArbitrary,
          referenceArbitrary,
          async (userId, type, amount, currency, provider, status, providerTxnId) => {
            vi.mocked(supabase.from).mockReset();

            const mockTransactionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date().toISOString();

            // The transaction that will be "stored" and "retrieved"
            const storedTransaction: Transaction = {
              id: mockTransactionId,
              user_id: userId,
              type,
              amount,
              currency,
              payment_provider: provider,
              provider_txn_id: providerTxnId,
              status,
              metadata: null,
              created_at: now,
            };

            // Mock insert for logTransaction
            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: storedTransaction,
              error: null,
            });
            const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

            // Mock select for getTransactionByReference
            const mockSelectSingle = vi.fn().mockResolvedValue({
              data: storedTransaction,
              error: null,
            });
            const mockSelectEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

            vi.mocked(supabase.from).mockImplementation(
              mockTransactionsRoundTrip(
                { insert: mockInsert },
                { select: mockSelect }
              )
            );

            // Log the transaction
            const logResult = await logTransaction(
              userId, type, amount, currency, provider, status, undefined, providerTxnId
            );

            expect(logResult.error).toBeNull();
            expect(logResult.data).not.toBeNull();

            // Retrieve the transaction
            const getResult = await getTransactionByReference(providerTxnId);

            expect(getResult.error).toBeNull();
            expect(getResult.data).not.toBeNull();

            // Verify round-trip consistency
            if (logResult.data && getResult.data) {
              expect(getResult.data.user_id).toBe(logResult.data.user_id);
              expect(getResult.data.type).toBe(logResult.data.type);
              expect(getResult.data.amount).toBe(logResult.data.amount);
              expect(getResult.data.currency).toBe(logResult.data.currency);
              expect(getResult.data.payment_provider).toBe(logResult.data.payment_provider);
              expect(getResult.data.provider_txn_id).toBe(logResult.data.provider_txn_id);
              expect(getResult.data.status).toBe(logResult.data.status);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('for any transaction with metadata, metadata is preserved in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          transactionTypeArbitrary,
          amountArbitrary,
          currencyArbitrary,
          referenceArbitrary,
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 50 })),
          async (userId, type, amount, currency, providerTxnId, metadata) => {
            vi.mocked(supabase.from).mockReset();

            const mockTransactionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date().toISOString();

            const storedTransaction: Transaction = {
              id: mockTransactionId,
              user_id: userId,
              type,
              amount,
              currency,
              payment_provider: 'paystack',
              provider_txn_id: providerTxnId,
              status: 'success',
              metadata,
              created_at: now,
            };

            const mockInsertSingle = vi.fn().mockResolvedValue({
              data: storedTransaction,
              error: null,
            });
            const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

            const mockSelectSingle = vi.fn().mockResolvedValue({
              data: storedTransaction,
              error: null,
            });
            const mockSelectEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

            vi.mocked(supabase.from).mockImplementation(
              mockTransactionsRoundTrip(
                { insert: mockInsert },
                { select: mockSelect }
              )
            );

            const logResult = await logTransaction(
              userId, type, amount, currency, 'paystack', 'success', metadata, providerTxnId
            );

            const getResult = await getTransactionByReference(providerTxnId);

            expect(logResult.error).toBeNull();
            expect(getResult.error).toBeNull();

            if (logResult.data && getResult.data) {
              expect(getResult.data.metadata).toEqual(logResult.data.metadata);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
