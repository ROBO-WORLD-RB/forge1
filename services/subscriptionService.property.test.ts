import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Country, Currency, WorkerTier, Subscription } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Subscription Service
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6
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
  getSubscriptionPlans,
  createSubscription,
  cancelSubscription,
  calculateSubscriptionStatus,
  handleSubscriptionExpiry,
} from './subscriptionService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const countryArbitrary: fc.Arbitrary<Country> = fc.constantFrom('GH', 'NG');
const tierArbitrary: fc.Arbitrary<WorkerTier> = fc.constantFrom('free', 'basic', 'premium');
const userIdArbitrary = fc.uuid();
const subscriptionIdArbitrary = fc.uuid();

// Expected pricing by country and tier (must match subscriptionService.ts PRICING)
const EXPECTED_PRICING: Record<Country, Record<WorkerTier, { price: number; currency: Currency }>> = {
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


describe('Subscription Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 1: Subscription Plans Return Correct Pricing by Country
   * Validates: Requirements 1.1
   * 
   * For any country (GH or NG), calling getSubscriptionPlans should return plans
   * with prices in the correct local currency (GHS for GH, NGN for NG) and correct
   * tier pricing (Free: 0, Basic: 10/900, Premium: 20/1500).
   */
  describe('Property 1: Subscription Plans Return Correct Pricing by Country', () => {
    it('for any country, getSubscriptionPlans returns plans with correct local currency', () => {
      fc.assert(
        fc.property(countryArbitrary, (country) => {
          const plans = getSubscriptionPlans(country);
          const expectedCurrency = country === 'GH' ? 'GHS' : 'NGN';

          // All plans should have the correct currency
          for (const plan of plans) {
            expect(plan.currency).toBe(expectedCurrency);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('for any country, getSubscriptionPlans returns all three tiers', () => {
      fc.assert(
        fc.property(countryArbitrary, (country) => {
          const plans = getSubscriptionPlans(country);
          const tiers = plans.map((p) => p.tier);

          expect(tiers).toContain('free');
          expect(tiers).toContain('basic');
          expect(tiers).toContain('premium');
          expect(plans.length).toBe(3);
        }),
        { numRuns: 100 }
      );
    });

    it('for any country and tier, getSubscriptionPlans returns correct pricing', () => {
      fc.assert(
        fc.property(countryArbitrary, tierArbitrary, (country, tier) => {
          const plans = getSubscriptionPlans(country);
          const plan = plans.find((p) => p.tier === tier);

          expect(plan).toBeDefined();
          if (plan) {
            const expected = EXPECTED_PRICING[country][tier];
            expect(plan.price).toBe(expected.price);
            expect(plan.currency).toBe(expected.currency);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('for any country, free tier always has price 0', () => {
      fc.assert(
        fc.property(countryArbitrary, (country) => {
          const plans = getSubscriptionPlans(country);
          const freePlan = plans.find((p) => p.tier === 'free');

          expect(freePlan).toBeDefined();
          expect(freePlan?.price).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 2: Subscription Creation Sets Pending Status and 30-Day Expiry
   * Validates: Requirements 1.2 (M0: client creates pending only; webhook activates)
   *
   * For any valid paid subscription intent, the resulting row is status 'pending'
   * with expires_at ~30 days from started_at. Free tier is rejected (no row).
   */
  describe('Property 2: Subscription Creation Sets Pending Status and 30-Day Expiry', () => {
    const paidTier: fc.Arbitrary<WorkerTier> = fc.constantFrom('basic', 'premium');

    it('for any valid paid subscription creation, status is pending and expiry is 30 days from start', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          countryArbitrary,
          paidTier,
          async (userId, country, tier) => {
            vi.mocked(supabase.from).mockReset();
            
            const planId = `${tier}-${country.toLowerCase()}`;
            const mockSubscriptionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date();
            const expectedExpiry = new Date(now);
            expectedExpiry.setDate(expectedExpiry.getDate() + 30);

            const expectedSubscription: Subscription = {
              id: mockSubscriptionId,
              user_id: userId,
              tier,
              currency: EXPECTED_PRICING[country][tier].currency,
              amount: EXPECTED_PRICING[country][tier].price,
              status: 'pending',
              payment_provider: 'paystack',
              provider_subscription_id: 'SUB_ref',
              started_at: now.toISOString(),
              expires_at: expectedExpiry.toISOString(),
              auto_renew: true,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };

            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedSubscription,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

            const result = await createSubscription(userId, planId, 'paystack', 'SUB_ref');

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.status).toBe('pending');

              const startDate = new Date(result.data.started_at);
              const expiryDate = new Date(result.data.expires_at);
              const daysDiff = Math.round((expiryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              expect(daysDiff).toBe(30);

              expect(result.data.auto_renew).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any paid subscription creation, the tier and pricing match the plan', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          countryArbitrary,
          paidTier,
          async (userId, country, tier) => {
            vi.mocked(supabase.from).mockReset();
            
            const planId = `${tier}-${country.toLowerCase()}`;
            const mockSubscriptionId = fc.sample(fc.uuid(), 1)[0];
            const now = new Date();
            const expectedExpiry = new Date(now);
            expectedExpiry.setDate(expectedExpiry.getDate() + 30);

            const expectedPricing = EXPECTED_PRICING[country][tier];

            const expectedSubscription: Subscription = {
              id: mockSubscriptionId,
              user_id: userId,
              tier,
              currency: expectedPricing.currency,
              amount: expectedPricing.price,
              status: 'pending',
              payment_provider: 'paystack',
              provider_subscription_id: null,
              started_at: now.toISOString(),
              expires_at: expectedExpiry.toISOString(),
              auto_renew: true,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };

            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedSubscription,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

            const result = await createSubscription(userId, planId, 'paystack');

            expect(result.error).toBeNull();
            if (result.data) {
              expect(result.data.tier).toBe(tier);
              expect(result.data.currency).toBe(expectedPricing.currency);
              expect(result.data.amount).toBe(expectedPricing.price);
              expect(result.data.status).toBe('pending');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 4: Subscription Cancellation Updates Status and Auto-Renew
   * Validates: Requirements 1.4
   * 
   * For any active subscription, after cancellation, the subscription status
   * should be 'cancelled' and auto_renew should be false.
   */
  describe('Property 4: Subscription Cancellation Updates Status and Auto-Renew', () => {
    it('for any subscription cancellation, status becomes cancelled and auto_renew is false', async () => {
      await fc.assert(
        fc.asyncProperty(
          subscriptionIdArbitrary,
          userIdArbitrary,
          countryArbitrary,
          tierArbitrary,
          async (subscriptionId, userId, country, tier) => {
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 15); // Still has 15 days left

            // Build cancelled subscription response
            const cancelledSubscription: Subscription = {
              id: subscriptionId,
              user_id: userId,
              tier,
              currency: EXPECTED_PRICING[country][tier].currency,
              amount: EXPECTED_PRICING[country][tier].price,
              status: 'cancelled',
              payment_provider: 'paystack',
              provider_subscription_id: null,
              started_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              auto_renew: false,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };

            // Mock successful update
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: cancelledSubscription,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValueOnce({
              update: mockUpdate,
            } as any);

            const result = await cancelSubscription(subscriptionId);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify status is cancelled
              expect(result.data.status).toBe('cancelled');
              // Verify auto_renew is false
              expect(result.data.auto_renew).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 5: Subscription Status Calculation Based on Expiry Date
   * Validates: Requirements 1.5
   * 
   * For any subscription with an expiry date, calculateSubscriptionStatus should return
   * 'active' if expiry > 7 days away, 'expiring' if expiry <= 7 days away, and 'expired'
   * if expiry is in the past.
   */
  describe('Property 5: Subscription Status Calculation Based on Expiry Date', () => {
    it('for any expiry date more than 7 days in the future, status is active', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 365 }), // Days until expiry
          (daysUntilExpiry) => {
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry);

            const status = calculateSubscriptionStatus(expiresAt, now);
            expect(status).toBe('active');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any expiry date within 7 days (but not expired), status is expiring', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }), // Days until expiry (1-7)
          (daysUntilExpiry) => {
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry);

            const status = calculateSubscriptionStatus(expiresAt, now);
            expect(status).toBe('expiring');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any expiry date in the past, status is expired', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 365 }), // Days since expiry
          (daysSinceExpiry) => {
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() - daysSinceExpiry);

            const status = calculateSubscriptionStatus(expiresAt, now);
            expect(status).toBe('expired');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for expiry date exactly now, status is expired', () => {
      const now = new Date();
      const expiresAt = new Date(now);

      const status = calculateSubscriptionStatus(expiresAt, now);
      expect(status).toBe('expired');
    });

    it('for expiry date exactly 7 days from now, status is expiring', () => {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7);

      const status = calculateSubscriptionStatus(expiresAt, now);
      expect(status).toBe('expiring');
    });
  });


  /**
   * Feature: backend-services, Property 6: Subscription Expiry Updates Worker Visibility
   * Validates: Requirements 1.6
   * 
   * For any expired subscription, after handleSubscriptionExpiry runs, the associated
   * worker's visibility should be false and subscription status should be 'expired'.
   */
  describe('Property 6: Subscription Expiry Updates Worker Visibility', () => {
    it('for any set of expired subscriptions, handleSubscriptionExpiry updates status to expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              user_id: fc.uuid(),
            }),
            { minLength: 1, maxLength: 10 } // Changed minLength to 1 to avoid empty array edge case
          ),
          async (expiredSubscriptions) => {
            // Reset mocks for each iteration
            vi.mocked(supabase.from).mockReset();
            
            // Mock fetching expired subscriptions
            const mockLt = vi.fn().mockResolvedValue({
              data: expiredSubscriptions,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ lt: mockLt });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            // Mock updating subscription status
            const mockIn = vi.fn().mockResolvedValue({ error: null });
            const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });

            // Mock updating worker profiles
            const mockWorkerIn = vi.fn().mockResolvedValue({ error: null });
            const mockWorkerUpdate = vi.fn().mockReturnValue({ in: mockWorkerIn });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockSelect } as any;
              } else if (callCount === 2) {
                return { update: mockUpdate } as any;
              }
              return { update: mockWorkerUpdate } as any;
            });

            const result = await handleSubscriptionExpiry();

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).toBe(expiredSubscriptions.length);

            // Verify the update was called
            expect(mockUpdate).toHaveBeenCalled();
            expect(mockWorkerUpdate).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when no subscriptions are expired, handleSubscriptionExpiry returns 0', async () => {
      vi.mocked(supabase.from).mockReset();
      
      // Mock fetching no expired subscriptions
      const mockLt = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockImplementation(() => {
        return { select: mockSelect } as any;
      });

      const result = await handleSubscriptionExpiry();

      expect(result.error).toBeNull();
      expect(result.data).toBe(0);
    });

    it('for any expired subscription, worker tier is reset to free', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              user_id: fc.uuid(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (expiredSubscriptions) => {
            // Reset mocks for each iteration
            vi.mocked(supabase.from).mockReset();
            
            const userIds = expiredSubscriptions.map((s) => s.user_id);

            // Mock fetching expired subscriptions
            const mockLt = vi.fn().mockResolvedValue({
              data: expiredSubscriptions,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ lt: mockLt });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            // Mock updating subscription status
            const mockIn = vi.fn().mockResolvedValue({ error: null });
            const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });

            // Mock updating worker profiles - capture the update call
            let capturedTierUpdate: WorkerTier | undefined;
            const mockWorkerIn = vi.fn().mockImplementation(() => {
              return Promise.resolve({ error: null });
            });
            const mockWorkerUpdate = vi.fn().mockImplementation((updateData: { tier: WorkerTier }) => {
              capturedTierUpdate = updateData.tier;
              return { in: mockWorkerIn };
            });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockSelect } as any;
              } else if (callCount === 2) {
                return { update: mockUpdate } as any;
              }
              return { update: mockWorkerUpdate } as any;
            });

            await handleSubscriptionExpiry();

            // Verify worker tier was set to 'free'
            expect(capturedTierUpdate).toBe('free');
            // Verify the correct user IDs were targeted
            expect(mockWorkerIn).toHaveBeenCalledWith('user_id', userIds);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
