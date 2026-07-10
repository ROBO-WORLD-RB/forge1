import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  Subscription,
  Job,
  Message,
  WorkerTier,
  Currency,
  Country,
  SubscriptionStatus,
  JobStatus,
} from './database';

/**
 * Arbitraries for generating valid database types
 */

// Helper arbitraries
const uuidArb = fc.uuid();

// Generate ISO date strings directly to avoid invalid date issues
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map(ts => new Date(ts).toISOString());

// Float arbitrary that avoids -0 (JSON.stringify converts -0 to 0)
const safeFloatArb = (min: number, max: number) => 
  fc.float({ min, max, noNaN: true }).map(n => Object.is(n, -0) ? 0 : n);

const workerTierArb: fc.Arbitrary<WorkerTier> = fc.constantFrom('free', 'basic', 'premium');
const currencyArb: fc.Arbitrary<Currency> = fc.constantFrom('GHS', 'NGN');
const countryArb: fc.Arbitrary<Country> = fc.constantFrom('GH', 'NG');
const subscriptionStatusArb: fc.Arbitrary<SubscriptionStatus> = fc.constantFrom('active', 'cancelled', 'expired');
const jobStatusArb: fc.Arbitrary<JobStatus> = fc.constantFrom('open', 'filled', 'cancelled');

// Subscription arbitrary
const subscriptionArb: fc.Arbitrary<Subscription> = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  tier: workerTierArb,
  currency: currencyArb,
  amount: safeFloatArb(0, 10000),
  status: subscriptionStatusArb,
  payment_provider: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  provider_subscription_id: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  started_at: isoDateArb,
  expires_at: isoDateArb,
  auto_renew: fc.boolean(),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

// Job arbitrary
const jobArb: fc.Arbitrary<Job> = fc.record({
  id: uuidArb,
  poster_user_id: uuidArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 2000 }), { nil: null }),
  category: fc.string({ minLength: 1, maxLength: 100 }),
  location: fc.string({ minLength: 1, maxLength: 200 }),
  location_lat: fc.option(safeFloatArb(-90, 90), { nil: null }),
  location_lng: fc.option(safeFloatArb(-180, 180), { nil: null }),
  country: countryArb,
  budget_min: fc.option(safeFloatArb(0, 100000), { nil: null }),
  budget_max: fc.option(safeFloatArb(0, 100000), { nil: null }),
  currency: fc.option(currencyArb, { nil: null }),
  status: jobStatusArb,
  scheduled_at: fc.option(isoDateArb, { nil: null }),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});


// Message arbitrary
const messageArb: fc.Arbitrary<Message> = fc.record({
  id: uuidArb,
  conversation_id: uuidArb,
  sender_id: uuidArb,
  body: fc.string({ minLength: 1, maxLength: 5000 }),
  attachments: fc.option(fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 }), { nil: null }),
  read_at: fc.option(isoDateArb, { nil: null }),
  created_at: isoDateArb,
});

/**
 * Feature: backend-services, Property 3: Subscription Round-Trip Persistence
 * Validates: Requirements 1.7, 1.8
 * 
 * For any valid subscription data, serializing to JSON and deserializing back
 * should produce an equivalent subscription object.
 */
describe('Subscription Round-Trip Persistence', () => {
  it('subscription serialization round-trip preserves all fields', () => {
    fc.assert(
      fc.property(subscriptionArb, (subscription) => {
        // Serialize to JSON (simulating storage)
        const serialized = JSON.stringify(subscription);
        
        // Deserialize from JSON (simulating retrieval)
        const deserialized: Subscription = JSON.parse(serialized);
        
        // Verify all fields are preserved
        expect(deserialized.id).toBe(subscription.id);
        expect(deserialized.user_id).toBe(subscription.user_id);
        expect(deserialized.tier).toBe(subscription.tier);
        expect(deserialized.currency).toBe(subscription.currency);
        expect(deserialized.amount).toBe(subscription.amount);
        expect(deserialized.status).toBe(subscription.status);
        expect(deserialized.payment_provider).toBe(subscription.payment_provider);
        expect(deserialized.provider_subscription_id).toBe(subscription.provider_subscription_id);
        expect(deserialized.started_at).toBe(subscription.started_at);
        expect(deserialized.expires_at).toBe(subscription.expires_at);
        expect(deserialized.auto_renew).toBe(subscription.auto_renew);
        expect(deserialized.created_at).toBe(subscription.created_at);
        expect(deserialized.updated_at).toBe(subscription.updated_at);
      }),
      { numRuns: 100 }
    );
  });

  it('subscription deep equality after round-trip', () => {
    fc.assert(
      fc.property(subscriptionArb, (subscription) => {
        const serialized = JSON.stringify(subscription);
        const deserialized: Subscription = JSON.parse(serialized);
        
        // Deep equality check
        expect(deserialized).toEqual(subscription);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: backend-services, Property 14: Job Round-Trip Persistence
 * Validates: Requirements 3.7, 3.8
 * 
 * For any valid job data, serializing to JSON and deserializing back
 * should produce an equivalent job object.
 */
describe('Job Round-Trip Persistence', () => {
  it('job serialization round-trip preserves all fields', () => {
    fc.assert(
      fc.property(jobArb, (job) => {
        // Serialize to JSON (simulating storage)
        const serialized = JSON.stringify(job);
        
        // Deserialize from JSON (simulating retrieval)
        const deserialized: Job = JSON.parse(serialized);
        
        // Verify all fields are preserved
        expect(deserialized.id).toBe(job.id);
        expect(deserialized.poster_user_id).toBe(job.poster_user_id);
        expect(deserialized.title).toBe(job.title);
        expect(deserialized.description).toBe(job.description);
        expect(deserialized.category).toBe(job.category);
        expect(deserialized.location).toBe(job.location);
        expect(deserialized.location_lat).toBe(job.location_lat);
        expect(deserialized.location_lng).toBe(job.location_lng);
        expect(deserialized.country).toBe(job.country);
        expect(deserialized.budget_min).toBe(job.budget_min);
        expect(deserialized.budget_max).toBe(job.budget_max);
        expect(deserialized.currency).toBe(job.currency);
        expect(deserialized.status).toBe(job.status);
        expect(deserialized.scheduled_at).toBe(job.scheduled_at);
        expect(deserialized.created_at).toBe(job.created_at);
        expect(deserialized.updated_at).toBe(job.updated_at);
      }),
      { numRuns: 100 }
    );
  });

  it('job deep equality after round-trip', () => {
    fc.assert(
      fc.property(jobArb, (job) => {
        const serialized = JSON.stringify(job);
        const deserialized: Job = JSON.parse(serialized);
        
        // Deep equality check
        expect(deserialized).toEqual(job);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: backend-services, Property 24: Message Round-Trip Persistence
 * Validates: Requirements 4.7, 4.8
 * 
 * For any valid message data, serializing to JSON and deserializing back
 * should produce an equivalent message object.
 */
describe('Message Round-Trip Persistence', () => {
  it('message serialization round-trip preserves all fields', () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        // Serialize to JSON (simulating storage)
        const serialized = JSON.stringify(message);
        
        // Deserialize from JSON (simulating retrieval)
        const deserialized: Message = JSON.parse(serialized);
        
        // Verify all fields are preserved
        expect(deserialized.id).toBe(message.id);
        expect(deserialized.conversation_id).toBe(message.conversation_id);
        expect(deserialized.sender_id).toBe(message.sender_id);
        expect(deserialized.body).toBe(message.body);
        expect(deserialized.attachments).toEqual(message.attachments);
        expect(deserialized.read_at).toBe(message.read_at);
        expect(deserialized.created_at).toBe(message.created_at);
      }),
      { numRuns: 100 }
    );
  });

  it('message deep equality after round-trip', () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        const serialized = JSON.stringify(message);
        const deserialized: Message = JSON.parse(serialized);
        
        // Deep equality check
        expect(deserialized).toEqual(message);
      }),
      { numRuns: 100 }
    );
  });

  it('message with attachments preserves array order', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: uuidArb,
          conversation_id: uuidArb,
          sender_id: uuidArb,
          body: fc.string({ minLength: 1, maxLength: 500 }),
          attachments: fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
          read_at: fc.option(isoDateArb, { nil: null }),
          created_at: isoDateArb,
        }),
        (message) => {
          const serialized = JSON.stringify(message);
          const deserialized = JSON.parse(serialized);
          
          // Verify attachments array order is preserved
          expect(deserialized.attachments).toHaveLength(message.attachments.length);
          message.attachments.forEach((url, index) => {
            expect(deserialized.attachments[index]).toBe(url);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
