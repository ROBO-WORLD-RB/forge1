/**
 * Booking Service
 * Manages booking lifecycle for the BlueCollar marketplace
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
 */

import { supabase } from './supabase';
import type {
  Booking,
  BookingInsert,
  BookingUpdate,
  BookingStatus,
  Job,
  Profile,
  Country,
  Currency,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';
import { createJob, getJob } from './jobService';
import { createInAppNotification } from './notificationService';
import { logTransaction, getTransactionByReference } from './paymentWebhookService';
import { logger } from '../utils/logger';

/**
 * Extended error codes for booking operations
 */
export const BOOKING_ERROR_CODES = {
  BOOKING_NOT_FOUND: 'BKG_001',
  INVALID_STATUS_TRANSITION: 'BKG_002',
  WORKER_NOT_AVAILABLE: 'BKG_003',
  JOB_NOT_FOUND: 'BKG_004',
} as const;

/**
 * Result type for booking service operations
 */
export interface BookingServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * Booking details with associated job and user information
 */
export interface BookingDetails extends Booking {
  job?: Job;
  worker?: Profile;
  customer?: Profile;
}

/**
 * Valid state transitions for bookings
 * Maps current status to array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['REVIEWED'],
  REVIEWED: [],
  CANCELLED: [],
};

/** Best-effort in-app notification — never blocks booking lifecycle */
async function notifyBookingEvent(
  userId: string,
  type: Parameters<typeof createInAppNotification>[1],
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const result = await createInAppNotification(userId, type, title, body, metadata);
    if (result.error) {
      logger.warn('Booking notification failed', { type, userId, error: result.error.message });
    }
  } catch (err) {
    logger.warn('Booking notification failed', {
      type,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Validate if a status transition is allowed
 * Requirements: 2.9
 */
export function isValidTransition(
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): boolean {
  const validNextStatuses = VALID_TRANSITIONS[currentStatus];
  return validNextStatuses.includes(newStatus);
}

/**
 * Create a new booking
 * Creates booking with status 'PENDING' and stores customer message
 * Requirements: 2.1
 */
export async function createBooking(
  jobId: string,
  workerId: string,
  customerMessage?: string
): Promise<BookingServiceResult<Booking>> {
  const transaction = startTransaction('booking.create', 'db');

  try {
    // First, get the job to find the customer (poster)
    const { data: job, error: jobError } = await (supabase
      .from('jobs') as any)
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.JOB_NOT_FOUND as any,
          message: 'Job not found',
        },
      };
    }

    const insertData: BookingInsert = {
      job_id: jobId,
      worker_user_id: workerId,
      customer_user_id: job.poster_user_id,
      status: 'PENDING',
      customer_message: customerMessage ?? null,
    };

    const { data, error } = await (supabase
      .from('bookings') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createBooking' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    const booking = data as Booking;

    // Notify the other party (not the creator):
    // - Customer books worker → notify worker
    // - Worker applies to job → notify customer (poster)
    let actorId: string | null = null;
    try {
      const authResult = await supabase.auth.getUser();
      actorId = authResult?.data?.user?.id ?? null;
    } catch {
      actorId = null;
    }
    // Fallback: if poster === customer on the booking, prefer notifying the worker
    const isWorkerApplication = !!actorId && actorId === workerId;
    const notifyUserId = isWorkerApplication ? job.poster_user_id : workerId;

    void notifyBookingEvent(
      notifyUserId,
      'booking_request',
      isWorkerApplication ? 'New application on your project' : 'New booking request',
      isWorkerApplication
        ? job.title
          ? `A worker applied to "${job.title}". Open Bookings to respond.`
          : 'A worker applied to your project. Open Bookings to respond.'
        : job.title
          ? `A customer booked you for "${job.title}". Open Bookings to accept or decline.`
          : 'A customer booked you. Open Bookings to accept or decline.',
      { booking_id: booking.id, job_id: jobId }
    );

    return {
      data: booking,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

export interface DirectBookingPayment {
  reference: string;
  amount: number;
  currency: Currency;
  provider?: string;
}

/**
 * Input for booking a worker directly (no pre-existing job)
 */
export interface DirectBookingInput {
  customerId: string;
  workerUserId: string;
  workerName: string;
  workerRole: string;
  location: string;
  country: Country;
  hours: number;
  hourlyRate: number;
  currency: Currency;
  scheduledDate: string;
  description?: string;
  /** When provided, enables idempotent retries and transaction logging after success */
  payment?: DirectBookingPayment;
}

export interface DirectBookingResult {
  job: Job;
  booking: Booking;
}

/**
 * Create a lightweight job then booking for direct worker bookings from profile pages.
 * Customer creates the job (RLS: poster_user_id) and booking (RLS: customer_user_id).
 */
export async function createDirectBooking(
  input: DirectBookingInput
): Promise<BookingServiceResult<DirectBookingResult>> {
  const transaction = startTransaction('booking.createDirect', 'db');

  try {
    if (input.payment?.reference) {
      const existingTxn = await getTransactionByReference(input.payment.reference);
      const bookingId = existingTxn.data?.metadata?.booking_id as string | undefined;
      if (bookingId) {
        const existingBooking = await getBooking(bookingId);
        if (existingBooking.data) {
          const existingJob = await getJob(existingBooking.data.job_id);
          if (existingJob.data) {
            return {
              data: { job: existingJob.data, booking: existingBooking.data },
              error: null,
            };
          }
        }
      }

      const { data: existingJobs } = await (supabase
        .from('jobs') as any)
        .select('id')
        .eq('poster_user_id', input.customerId)
        .ilike('description', `%${input.payment.reference}%`)
        .limit(1);

      const existingJobId = existingJobs?.[0]?.id as string | undefined;
      if (existingJobId) {
        const { data: existingBookings } = await (supabase
          .from('bookings') as any)
          .select('*')
          .eq('job_id', existingJobId)
          .eq('worker_user_id', input.workerUserId)
          .limit(1);

        const existingBooking = existingBookings?.[0] as Booking | undefined;
        if (existingBooking) {
          const existingJob = await getJob(existingJobId);
          if (existingJob.data) {
            return {
              data: { job: existingJob.data, booking: existingBooking },
              error: null,
            };
          }
        }
      }
    }

    const total = input.hours * input.hourlyRate;
    const paymentRefSuffix = input.payment?.reference
      ? `\nPayment ref: ${input.payment.reference}`
      : '';
    const customerMessage = [
      input.description,
      `Scheduled: ${input.scheduledDate}`,
      `Duration: ${input.hours} hour(s)`,
    ]
      .filter(Boolean)
      .join('\n');

    const jobResult = await createJob(input.customerId, {
      title: `Direct booking: ${input.workerName}`,
      description:
        (input.description ||
          `Direct booking for ${input.hours} hour(s) on ${input.scheduledDate}`) + paymentRefSuffix,
      category: input.workerRole || 'general',
      location: input.location,
      country: input.country,
      budget_min: total,
      budget_max: total,
      currency: input.currency,
      scheduled_at: `${input.scheduledDate}T09:00:00.000Z`,
    });

    if (jobResult.error || !jobResult.data) {
      return { data: null, error: jobResult.error };
    }

    const bookingResult = await createBooking(
      jobResult.data.id,
      input.workerUserId,
      customerMessage || undefined
    );

    if (bookingResult.error || !bookingResult.data) {
      return { data: null, error: bookingResult.error };
    }

    const { job, booking } = { job: jobResult.data, booking: bookingResult.data };

    if (input.payment) {
      const logResult = await logTransaction(
        input.customerId,
        'booking',
        input.payment.amount,
        input.payment.currency,
        input.payment.provider ?? 'paystack',
        'success',
        {
          booking_id: booking.id,
          job_id: job.id,
          worker_user_id: input.workerUserId,
        },
        input.payment.reference
      );

      if (logResult.error) {
        logger.warn('Could not log booking transaction (RLS or DB)', {
          reference: input.payment.reference,
          bookingId: booking.id,
          error: logResult.error.message,
        });
      }
    }

    return {
      data: { job, booking },
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Accept a booking
 * Updates status from 'PENDING' to 'ACCEPTED' and stores worker message
 * Requirements: 2.2
 */
export async function acceptBooking(
  bookingId: string,
  workerMessage?: string
): Promise<BookingServiceResult<Booking>> {
  const transaction = startTransaction('booking.accept', 'db');

  try {
    // Get current booking to validate transition
    const { data: currentBooking, error: fetchError } = await (supabase
      .from('bookings') as any)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Validate state transition
    if (!isValidTransition(currentBooking.status, 'ACCEPTED')) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION as any,
          message: `Cannot transition from ${currentBooking.status} to ACCEPTED`,
        },
      };
    }

    const updateData: BookingUpdate = {
      status: 'ACCEPTED',
      worker_message: workerMessage ?? null,
    };

    const { data, error } = await (supabase
      .from('bookings') as any)
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'acceptBooking' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    const booking = data as Booking;

    void notifyBookingEvent(
      currentBooking.customer_user_id,
      'booking_accepted',
      'Worker accepted your booking',
      'Your pro accepted the job. They will start when ready — track progress in My Bookings.',
      { booking_id: bookingId, job_id: currentBooking.job_id }
    );

    return {
      data: booking,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Start a booking
 * Updates status from 'ACCEPTED' to 'IN_PROGRESS' and records start timestamp
 * Requirements: 2.3
 */
export async function startBooking(
  bookingId: string
): Promise<BookingServiceResult<Booking>> {
  const transaction = startTransaction('booking.start', 'db');

  try {
    // Get current booking to validate transition
    const { data: currentBooking, error: fetchError } = await (supabase
      .from('bookings') as any)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Validate state transition
    if (!isValidTransition(currentBooking.status, 'IN_PROGRESS')) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION as any,
          message: `Cannot transition from ${currentBooking.status} to IN_PROGRESS`,
        },
      };
    }

    const updateData: BookingUpdate = {
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('bookings') as any)
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'startBooking' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    void notifyBookingEvent(
      currentBooking.customer_user_id,
      'booking_accepted',
      'Work has started',
      'Your pro marked the job as in progress. Message them anytime from My Bookings.',
      { booking_id: bookingId, job_id: currentBooking.job_id }
    );

    return {
      data: data as Booking,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Complete a booking
 * Updates status from 'IN_PROGRESS' to 'COMPLETED' and records completion timestamp
 * Requirements: 2.4
 */
export async function completeBooking(
  bookingId: string
): Promise<BookingServiceResult<Booking>> {
  const transaction = startTransaction('booking.complete', 'db');

  try {
    // Get current booking to validate transition
    const { data: currentBooking, error: fetchError } = await (supabase
      .from('bookings') as any)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Validate state transition
    if (!isValidTransition(currentBooking.status, 'COMPLETED')) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION as any,
          message: `Cannot transition from ${currentBooking.status} to COMPLETED`,
        },
      };
    }

    const updateData: BookingUpdate = {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase
      .from('bookings') as any)
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'completeBooking' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    const booking = data as Booking;

    void notifyBookingEvent(
      currentBooking.customer_user_id,
      'booking_completed',
      'Job completed — leave a review',
      'Work is done. Open My Bookings to leave a review and help other customers hire with confidence.',
      { booking_id: bookingId, job_id: currentBooking.job_id }
    );

    return {
      data: booking,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Cancel a booking
 * Updates status to 'CANCELLED', records cancellation reason and timestamp
 * Requirements: 2.5
 */
export async function cancelBooking(
  bookingId: string,
  reason: string
): Promise<BookingServiceResult<Booking>> {
  const transaction = startTransaction('booking.cancel', 'db');

  try {
    // Get current booking to validate transition
    const { data: currentBooking, error: fetchError } = await (supabase
      .from('bookings') as any)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !currentBooking) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Validate state transition
    if (!isValidTransition(currentBooking.status, 'CANCELLED')) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION as any,
          message: `Cannot transition from ${currentBooking.status} to CANCELLED`,
        },
      };
    }

    const updateData: BookingUpdate = {
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    };

    const { data, error } = await (supabase
      .from('bookings') as any)
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'cancelBooking' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Booking,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}


/**
 * Get bookings by worker
 * Returns bookings filtered by worker ID and optional status
 * Requirements: 2.6
 */
export async function getBookingsByWorker(
  workerId: string,
  status?: BookingStatus
): Promise<BookingServiceResult<Booking[]>> {
  const transaction = startTransaction('booking.getByWorker', 'db');

  try {
    let query = (supabase.from('bookings') as any)
      .select('*')
      .eq('worker_user_id', workerId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getBookingsByWorker' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Booking[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get bookings for a job
 * Returns bookings filtered by job ID and optional status
 */
export async function getBookingsByJob(
  jobId: string,
  status?: BookingStatus
): Promise<BookingServiceResult<Booking[]>> {
  const transaction = startTransaction('booking.getByJob', 'db');

  try {
    let query = (supabase.from('bookings') as any)
      .select('*')
      .eq('job_id', jobId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getBookingsByJob' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Booking[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get bookings by customer
 * Returns bookings filtered by customer ID and optional status
 * Requirements: 2.7
 */
export async function getBookingsByCustomer(
  customerId: string,
  status?: BookingStatus
): Promise<BookingServiceResult<Booking[]>> {
  const transaction = startTransaction('booking.getByCustomer', 'db');

  try {
    let query = (supabase.from('bookings') as any)
      .select('*')
      .eq('customer_user_id', customerId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getBookingsByCustomer' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Booking[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get booking details with job and user information
 * Returns the booking with associated job and user information
 * Requirements: 2.8
 */
export async function getBookingDetails(
  bookingId: string
): Promise<BookingServiceResult<BookingDetails>> {
  const transaction = startTransaction('booking.getDetails', 'db');

  try {
    // Get booking with related data
    const { data: booking, error: bookingError } = await (supabase
      .from('bookings') as any)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return {
        data: null,
        error: {
          code: BOOKING_ERROR_CODES.BOOKING_NOT_FOUND as any,
          message: 'Booking not found',
        },
      };
    }

    // Get associated job
    const { data: job } = await (supabase
      .from('jobs') as any)
      .select('*')
      .eq('id', booking.job_id)
      .single();

    // Get worker profile
    const { data: worker } = await (supabase
      .from('profiles') as any)
      .select('*')
      .eq('id', booking.worker_user_id)
      .single();

    // Get customer profile
    const { data: customer } = await (supabase
      .from('profiles') as any)
      .select('*')
      .eq('id', booking.customer_user_id)
      .single();

    const bookingDetails: BookingDetails = {
      ...booking,
      job: job || undefined,
      worker: worker || undefined,
      customer: customer || undefined,
    };

    return {
      data: bookingDetails,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get a single booking by ID
 * Returns the booking without related data
 */
export async function getBooking(
  bookingId: string
): Promise<BookingServiceResult<Booking>> {
  const { data, error } = await (supabase
    .from('bookings') as any)
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Booking,
    error: null,
  };
}

/**
 * Booking Service interface
 */
export interface BookingService {
  createDirectBooking(input: DirectBookingInput): Promise<BookingServiceResult<DirectBookingResult>>;
  createBooking(jobId: string, workerId: string, customerMessage?: string): Promise<BookingServiceResult<Booking>>;
  acceptBooking(bookingId: string, workerMessage?: string): Promise<BookingServiceResult<Booking>>;
  startBooking(bookingId: string): Promise<BookingServiceResult<Booking>>;
  completeBooking(bookingId: string): Promise<BookingServiceResult<Booking>>;
  cancelBooking(bookingId: string, reason: string): Promise<BookingServiceResult<Booking>>;
  getBookingsByWorker(workerId: string, status?: BookingStatus): Promise<BookingServiceResult<Booking[]>>;
  getBookingsByJob(jobId: string, status?: BookingStatus): Promise<BookingServiceResult<Booking[]>>;
  getBookingsByCustomer(customerId: string, status?: BookingStatus): Promise<BookingServiceResult<Booking[]>>;
  getBookingDetails(bookingId: string): Promise<BookingServiceResult<BookingDetails>>;
  getBooking(bookingId: string): Promise<BookingServiceResult<Booking>>;
  isValidTransition(currentStatus: BookingStatus, newStatus: BookingStatus): boolean;
}

// Export as a service object for compatibility with existing code patterns
export const bookingService: BookingService = {
  createDirectBooking,
  createBooking,
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  getBookingsByWorker,
  getBookingsByJob,
  getBookingsByCustomer,
  getBookingDetails,
  getBooking,
  isValidTransition,
};

export default bookingService;
