/**
 * Review Service
 * Manages ratings and reviews for the BlueCollar marketplace
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { supabase } from './supabase';
import type { Review, ReviewInsert, BookingStatus } from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Extended error codes for review operations
 */
export const REVIEW_ERROR_CODES = {
  REVIEW_NOT_ALLOWED: 'REV_001',
  INVALID_SCORE: 'REV_002',
  ALREADY_REVIEWED: 'REV_003',
  BOOKING_NOT_FOUND: 'REV_004',
  BOOKING_NOT_COMPLETED: 'REV_005',
  REVIEW_NOT_FOUND: 'REV_006',
} as const;

/**
 * Result type for review service operations
 */
export interface ReviewServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Paginated reviews result
 */
export interface PaginatedReviews {
  reviews: Review[];
  cursor: string | null;
  hasMore: boolean;
}

/**
 * Validate review score is within 1-5 range
 * Requirements: 7.6
 */
export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 5;
}


/**
 * Check if a user can review a booking
 * Verifies booking is COMPLETED and no review exists for that booking by that user
 * Requirements: 7.4
 */
export async function canReview(
  bookingId: string,
  userId: string
): Promise<ReviewServiceResult<boolean>> {
  const transaction = startTransaction('review.canReview', 'db');

  try {
    // Check if booking exists and is completed
    const { data: booking, error: bookingError } = await (supabase
      .from('bookings') as any)
      .select('status, customer_user_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return {
        data: false,
        error: {
          code: REVIEW_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Check if booking is completed
    if (booking.status !== 'COMPLETED') {
      return {
        data: false,
        error: null,
      };
    }

    // Check if user is the customer of this booking
    if (booking.customer_user_id !== userId) {
      return {
        data: false,
        error: null,
      };
    }

    // Check if review already exists for this booking by this user
    const { data: existingReview, error: reviewError } = await (supabase
      .from('reviews') as any)
      .select('id')
      .eq('booking_id', bookingId)
      .eq('author_id', userId)
      .maybeSingle();

    if (reviewError) {
      captureError(new Error(reviewError.message), { tags: { operation: 'canReview' } });
      return {
        data: null,
        error: handleDatabaseError(reviewError),
      };
    }

    // Can review if no existing review found
    return {
      data: existingReview === null,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Create a new review
 * Creates review with score (1-5) and optional text after completed booking
 * Requirements: 7.1, 7.6, 7.7
 */
export async function createReview(
  bookingId: string,
  raterId: string,
  ratedId: string,
  score: number,
  text?: string
): Promise<ReviewServiceResult<Review>> {
  const transaction = startTransaction('review.create', 'db');

  try {
    // Validate score range
    if (!isValidScore(score)) {
      return {
        data: null,
        error: {
          code: REVIEW_ERROR_CODES.INVALID_SCORE as any,
          message: 'Review score must be an integer between 1 and 5',
        },
      };
    }

    // Check if booking exists and is completed
    const { data: booking, error: bookingError } = await (supabase
      .from('bookings') as any)
      .select('status, customer_user_id, worker_user_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return {
        data: null,
        error: {
          code: REVIEW_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Check if booking is completed
    if (booking.status !== 'COMPLETED') {
      return {
        data: null,
        error: {
          code: REVIEW_ERROR_CODES.BOOKING_NOT_COMPLETED as any,
          message: 'Cannot review a booking that is not completed',
        },
      };
    }

    // Check if review already exists for this booking by this user
    const { data: existingReview, error: existingError } = await (supabase
      .from('reviews') as any)
      .select('id')
      .eq('booking_id', bookingId)
      .eq('author_id', raterId)
      .maybeSingle();

    if (existingError) {
      captureError(new Error(existingError.message), { tags: { operation: 'createReview' } });
      return {
        data: null,
        error: handleDatabaseError(existingError),
      };
    }

    if (existingReview) {
      return {
        data: null,
        error: {
          code: REVIEW_ERROR_CODES.ALREADY_REVIEWED as any,
          message: 'A review already exists for this booking by this user',
        },
      };
    }

    // Create the review
    const insertData: ReviewInsert & { booking_id: string } = {
      booking_id: bookingId,
      worker_id: ratedId,
      author_id: raterId,
      rating: score,
      text: text ?? null,
    };

    const { data, error } = await (supabase
      .from('reviews') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createReview' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    // Update worker's average rating
    await updateWorkerRating(ratedId);

    // Update booking status to REVIEWED
    await (supabase
      .from('bookings') as any)
      .update({ status: 'REVIEWED' })
      .eq('id', bookingId);

    return {
      data: data as Review,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Get reviews for a worker with pagination
 * Returns reviews with pagination support (limit and cursor)
 * Requirements: 7.2
 */
export async function getReviewsForWorker(
  workerId: string,
  limit: number = 10,
  cursor?: string
): Promise<ReviewServiceResult<PaginatedReviews>> {
  const transaction = startTransaction('review.getForWorker', 'db');

  try {
    let query = (supabase.from('reviews') as any)
      .select('*')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    // Apply cursor if provided (cursor is the created_at of the last item)
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getReviewsForWorker' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    const reviews = (data || []) as Review[];
    const hasMore = reviews.length > limit;
    
    // Remove the extra item if we fetched more than limit
    if (hasMore) {
      reviews.pop();
    }

    // Get cursor for next page (created_at of last item)
    const nextCursor = reviews.length > 0 ? reviews[reviews.length - 1].created_at : null;

    return {
      data: {
        reviews,
        cursor: hasMore ? nextCursor : null,
        hasMore,
      },
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get reviews written by a user
 * Returns all reviews authored by the specified user
 * Requirements: 7.3
 */
export async function getReviewsByUser(
  userId: string
): Promise<ReviewServiceResult<Review[]>> {
  const transaction = startTransaction('review.getByUser', 'db');

  try {
    const { data, error } = await (supabase.from('reviews') as any)
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getReviewsByUser' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Review[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Update worker's average rating
 * Recalculates and updates the worker's average rating based on all reviews
 * Requirements: 7.5
 */
export async function updateWorkerRating(
  workerId: string
): Promise<ReviewServiceResult<void>> {
  const transaction = startTransaction('review.updateWorkerRating', 'db');

  try {
    // Get all reviews for the worker
    const { data: reviews, error: reviewsError } = await (supabase.from('reviews') as any)
      .select('rating')
      .eq('worker_id', workerId);

    if (reviewsError) {
      captureError(new Error(reviewsError.message), { tags: { operation: 'updateWorkerRating' } });
      return {
        data: null,
        error: handleDatabaseError(reviewsError),
      };
    }

    const reviewList = (reviews || []) as { rating: number }[];
    
    if (reviewList.length === 0) {
      return {
        data: undefined,
        error: null,
      };
    }

    // Calculate average rating
    const totalRating = reviewList.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviewList.length;
    const reviewCount = reviewList.length;

    // Update worker profile with new average rating
    const { error: updateError } = await (supabase.from('worker_profiles') as any)
      .update({ 
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        review_count: reviewCount 
      })
      .eq('id', workerId);

    if (updateError) {
      captureError(new Error(updateError.message), { tags: { operation: 'updateWorkerRating' } });
      return {
        data: null,
        error: handleDatabaseError(updateError),
      };
    }

    return {
      data: undefined,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get a single review by ID
 */
export async function getReview(
  reviewId: string
): Promise<ReviewServiceResult<Review>> {
  const { data, error } = await (supabase
    .from('reviews') as any)
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Review,
    error: null,
  };
}

/**
 * Review Service interface
 */
export interface ReviewService {
  createReview(bookingId: string, raterId: string, ratedId: string, score: number, text?: string): Promise<ReviewServiceResult<Review>>;
  getReviewsForWorker(workerId: string, limit?: number, cursor?: string): Promise<ReviewServiceResult<PaginatedReviews>>;
  getReviewsByUser(userId: string): Promise<ReviewServiceResult<Review[]>>;
  canReview(bookingId: string, userId: string): Promise<ReviewServiceResult<boolean>>;
  updateWorkerRating(workerId: string): Promise<ReviewServiceResult<void>>;
  getReview(reviewId: string): Promise<ReviewServiceResult<Review>>;
  isValidScore(score: number): boolean;
}

// Export as a service object for compatibility with existing code patterns
export const reviewService: ReviewService = {
  createReview,
  getReviewsForWorker,
  getReviewsByUser,
  canReview,
  updateWorkerRating,
  getReview,
  isValidScore,
};

export default reviewService;
