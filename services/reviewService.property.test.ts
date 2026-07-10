import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Review, BookingStatus } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Review Service
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
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
  createReview,
  getReviewsForWorker,
  getReviewsByUser,
  canReview,
  updateWorkerRating,
  getReview,
  isValidScore,
  REVIEW_ERROR_CODES,
} from './reviewService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const bookingIdArbitrary = fc.uuid();
const workerIdArbitrary = fc.uuid();
const reviewIdArbitrary = fc.uuid();

// Generate valid review scores (1-5)
const validScoreArbitrary = fc.integer({ min: 1, max: 5 });

// Generate invalid review scores (outside 1-5)
const invalidScoreArbitrary = fc.oneof(
  fc.integer({ max: 0 }),
  fc.integer({ min: 6 }),
  fc.double({ min: 1.1, max: 4.9 }) // Non-integer values
);

// Generate review text
const reviewTextArbitrary = fc.option(
  fc.string({ minLength: 1, maxLength: 500 }),
  { nil: undefined }
);

// Generate booking status
const bookingStatusArbitrary = fc.constantFrom<BookingStatus>(
  'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'
);

// Generate non-completed booking status
const nonCompletedStatusArbitrary = fc.constantFrom<BookingStatus>(
  'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'CANCELLED'
);


// Helper to create a mock Review
function createMockReview(
  id: string,
  bookingId: string,
  workerId: string,
  authorId: string,
  rating: number,
  text?: string
): Review {
  const now = new Date().toISOString();
  return {
    id,
    booking_id: bookingId,
    worker_id: workerId,
    author_id: authorId,
    rating,
    text: text ?? null,
    created_at: now,
  };
}

// Helper to create a mock booking
function createMockBooking(
  id: string,
  status: BookingStatus,
  customerId: string,
  workerId: string
) {
  return {
    id,
    status,
    customer_user_id: customerId,
    worker_user_id: workerId,
  };
}

describe('Review Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 35: Review Creation After Completed Booking
   * Validates: Requirements 7.1
   * 
   * For any completed booking, createReview should successfully create a review
   * with the provided score (1-5) and text.
   */
  describe('Property 35: Review Creation After Completed Booking', () => {
    it('for any completed booking, createReview creates review with provided score and text', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          validScoreArbitrary,
          reviewTextArbitrary,
          async (bookingId, raterId, ratedId, score, text) => {
            vi.mocked(supabase.from).mockReset();

            const mockReviewId = fc.sample(fc.uuid(), 1)[0];
            const mockBooking = createMockBooking(bookingId, 'COMPLETED', raterId, ratedId);
            const expectedReview = createMockReview(
              mockReviewId,
              bookingId,
              ratedId,
              raterId,
              score,
              text
            );

            // Track which reviews table call we're on
            let reviewsCallCount = 0;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'bookings') {
                // Check booking status or update booking status
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                  update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      error: null,
                    }),
                  }),
                } as any;
              }
              
              if (table === 'reviews') {
                reviewsCallCount++;
                if (reviewsCallCount === 1) {
                  // First reviews call: check existing review
                  return {
                    select: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: null,
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  } as any;
                } else if (reviewsCallCount === 2) {
                  // Second reviews call: insert review
                  return {
                    insert: vi.fn().mockReturnValue({
                      select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                          data: expectedReview,
                          error: null,
                        }),
                      }),
                    }),
                  } as any;
                } else {
                  // Third reviews call: get reviews for rating calculation
                  return {
                    select: vi.fn().mockReturnValue({
                      eq: vi.fn().mockResolvedValue({
                        data: [{ rating: score }],
                        error: null,
                      }),
                    }),
                  } as any;
                }
              }
              
              if (table === 'worker_profiles') {
                return {
                  update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      error: null,
                    }),
                  }),
                } as any;
              }
              
              return {} as any;
            });

            const result = await createReview(bookingId, raterId, ratedId, score, text);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              expect(result.data.rating).toBe(score);
              expect(result.data.worker_id).toBe(ratedId);
              expect(result.data.author_id).toBe(raterId);
              if (text) {
                expect(result.data.text).toBe(text);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 36: Review Pagination for Worker
   * Validates: Requirements 7.2
   * 
   * For any worker with N reviews and a limit L, getReviewsForWorker should
   * return at most L reviews and provide a valid cursor.
   */
  describe('Property 36: Review Pagination for Worker', () => {
    it('for any worker with reviews, getReviewsForWorker returns at most limit reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          workerIdArbitrary,
          fc.integer({ min: 1, max: 20 }), // limit
          fc.integer({ min: 0, max: 30 }), // total reviews
          async (workerId, limit, totalReviews) => {
            vi.mocked(supabase.from).mockReset();

            // Generate mock reviews
            const mockReviews = Array.from({ length: Math.min(totalReviews, limit + 1) }, (_, i) => {
              const date = new Date();
              date.setMinutes(date.getMinutes() - i);
              return createMockReview(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                workerId,
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(validScoreArbitrary, 1)[0],
                `Review ${i}`
              );
            });

            const mockLimit = vi.fn().mockResolvedValue({
              data: mockReviews,
              error: null,
            });
            const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getReviewsForWorker(workerId, limit);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Should return at most limit reviews
              expect(result.data.reviews.length).toBeLessThanOrEqual(limit);
              
              // hasMore should be true if we had more reviews than limit
              if (totalReviews > limit) {
                expect(result.data.hasMore).toBe(true);
                expect(result.data.cursor).not.toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pagination cursor points to last item created_at', async () => {
      await fc.assert(
        fc.asyncProperty(
          workerIdArbitrary,
          fc.integer({ min: 1, max: 10 }),
          async (workerId, reviewCount) => {
            vi.mocked(supabase.from).mockReset();

            const mockReviews = Array.from({ length: reviewCount + 1 }, (_, i) => {
              const date = new Date();
              date.setMinutes(date.getMinutes() - i);
              return {
                ...createMockReview(
                  fc.sample(fc.uuid(), 1)[0],
                  fc.sample(fc.uuid(), 1)[0],
                  workerId,
                  fc.sample(fc.uuid(), 1)[0],
                  fc.sample(validScoreArbitrary, 1)[0]
                ),
                created_at: date.toISOString(),
              };
            });

            const mockLimit = vi.fn().mockResolvedValue({
              data: mockReviews,
              error: null,
            });
            const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getReviewsForWorker(workerId, reviewCount);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data && result.data.hasMore && result.data.reviews.length > 0) {
              // Cursor should be the created_at of the last returned review
              const lastReview = result.data.reviews[result.data.reviews.length - 1];
              expect(result.data.cursor).toBe(lastReview.created_at);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 37: Review Query by Author Returns Author's Reviews
   * Validates: Requirements 7.3
   * 
   * For any user ID, getReviewsByUser should return only reviews where the user is the rater.
   */
  describe('Property 37: Review Query by Author Returns Author\'s Reviews', () => {
    it('for any user, getReviewsByUser returns only reviews authored by that user', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.integer({ min: 0, max: 10 }),
          async (userId, reviewCount) => {
            vi.mocked(supabase.from).mockReset();

            // Generate mock reviews all authored by the user
            const mockReviews = Array.from({ length: reviewCount }, () =>
              createMockReview(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                userId, // author_id matches userId
                fc.sample(validScoreArbitrary, 1)[0]
              )
            );

            const mockOrder = vi.fn().mockResolvedValue({
              data: mockReviews,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            const result = await getReviewsByUser(userId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // All returned reviews should have author_id matching userId
              for (const review of result.data) {
                expect(review.author_id).toBe(userId);
              }
              expect(result.data.length).toBe(reviewCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getReviewsByUser queries with correct author filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedEqField: string | null = null;
            let capturedEqValue: string | null = null;

            const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedEqField = field;
              capturedEqValue = value;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

            await getReviewsByUser(userId);

            expect(capturedEqField).toBe('author_id');
            expect(capturedEqValue).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 38: Review Eligibility Check
   * Validates: Requirements 7.4
   * 
   * For any booking and user, canReview should return true only if the booking
   * status is COMPLETED and no review exists for that booking by that user.
   */
  describe('Property 38: Review Eligibility Check', () => {
    it('canReview returns true for completed booking with no existing review', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          async (bookingId, customerId, workerId) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(bookingId, 'COMPLETED', customerId, workerId);

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              callCount++;
              
              if (table === 'bookings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              
              if (table === 'reviews') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null, // No existing review
                          error: null,
                        }),
                      }),
                    }),
                  }),
                } as any;
              }
              
              return {} as any;
            });

            const result = await canReview(bookingId, customerId);

            expect(result.error).toBeNull();
            expect(result.data).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canReview returns false for non-completed booking', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          nonCompletedStatusArbitrary,
          async (bookingId, customerId, workerId, status) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(bookingId, status, customerId, workerId);

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'bookings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await canReview(bookingId, customerId);

            expect(result.error).toBeNull();
            expect(result.data).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canReview returns false when review already exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          async (bookingId, customerId, workerId) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(bookingId, 'COMPLETED', customerId, workerId);
            const existingReview = createMockReview(
              fc.sample(fc.uuid(), 1)[0],
              bookingId,
              workerId,
              customerId,
              4
            );

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              callCount++;
              
              if (table === 'bookings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              
              if (table === 'reviews') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: existingReview, // Review exists
                          error: null,
                        }),
                      }),
                    }),
                  }),
                } as any;
              }
              
              return {} as any;
            });

            const result = await canReview(bookingId, customerId);

            expect(result.error).toBeNull();
            expect(result.data).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 39: Review Updates Worker Average Rating
   * Validates: Requirements 7.5
   * 
   * For any new review, the worker's average rating should be recalculated
   * as the mean of all review scores.
   */
  describe('Property 39: Review Updates Worker Average Rating', () => {
    it('updateWorkerRating calculates correct average from all reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          workerIdArbitrary,
          fc.array(validScoreArbitrary, { minLength: 1, maxLength: 20 }),
          async (workerId, scores) => {
            vi.mocked(supabase.from).mockReset();

            // Calculate expected average
            const expectedAverage = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            const expectedRoundedAverage = Math.round(expectedAverage * 10) / 10;

            let capturedUpdateData: any = null;

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'reviews') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: scores.map(rating => ({ rating })),
                      error: null,
                    }),
                  }),
                } as any;
              }
              
              if (table === 'worker_profiles') {
                return {
                  update: vi.fn().mockImplementation((data) => {
                    capturedUpdateData = data;
                    return {
                      eq: vi.fn().mockResolvedValue({
                        error: null,
                      }),
                    };
                  }),
                } as any;
              }
              
              return {} as any;
            });

            const result = await updateWorkerRating(workerId);

            expect(result.error).toBeNull();
            expect(capturedUpdateData).not.toBeNull();
            expect(capturedUpdateData.rating).toBe(expectedRoundedAverage);
            expect(capturedUpdateData.review_count).toBe(scores.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('updateWorkerRating handles empty reviews gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          workerIdArbitrary,
          async (workerId) => {
            vi.mocked(supabase.from).mockReset();

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'reviews') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      data: [], // No reviews
                      error: null,
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await updateWorkerRating(workerId);

            // Should not error, just return successfully
            expect(result.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: backend-services, Property 40: Invalid Review Rejection
   * Validates: Requirements 7.6, 7.7
   * 
   * For any review with score outside 1-5 range OR for a non-completed booking,
   * createReview should reject with an error.
   */
  describe('Property 40: Invalid Review Rejection', () => {
    it('createReview rejects scores outside 1-5 range', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          invalidScoreArbitrary,
          async (bookingId, raterId, ratedId, invalidScore) => {
            vi.mocked(supabase.from).mockReset();

            const result = await createReview(bookingId, raterId, ratedId, invalidScore);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(REVIEW_ERROR_CODES.INVALID_SCORE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('createReview rejects reviews for non-completed bookings', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          validScoreArbitrary,
          nonCompletedStatusArbitrary,
          async (bookingId, raterId, ratedId, score, status) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(bookingId, status, raterId, ratedId);

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'bookings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              return {} as any;
            });

            const result = await createReview(bookingId, raterId, ratedId, score);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(REVIEW_ERROR_CODES.BOOKING_NOT_COMPLETED);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('createReview rejects duplicate reviews for same booking', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          userIdArbitrary,
          workerIdArbitrary,
          validScoreArbitrary,
          async (bookingId, raterId, ratedId, score) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(bookingId, 'COMPLETED', raterId, ratedId);
            const existingReview = createMockReview(
              fc.sample(fc.uuid(), 1)[0],
              bookingId,
              ratedId,
              raterId,
              4
            );

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'bookings') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockBooking,
                        error: null,
                      }),
                    }),
                  }),
                } as any;
              }
              
              if (table === 'reviews') {
                return {
                  select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: existingReview, // Review already exists
                          error: null,
                        }),
                      }),
                    }),
                  }),
                } as any;
              }
              
              return {} as any;
            });

            const result = await createReview(bookingId, raterId, ratedId, score);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(REVIEW_ERROR_CODES.ALREADY_REVIEWED);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidScore correctly validates score range', () => {
      fc.assert(
        fc.property(
          fc.integer(),
          (score) => {
            const isValid = isValidScore(score);
            const expectedValid = Number.isInteger(score) && score >= 1 && score <= 5;
            return isValid === expectedValid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
