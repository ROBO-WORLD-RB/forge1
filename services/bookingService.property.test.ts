import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Booking, BookingStatus, Job, Profile, Country, Currency } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Booking Service
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
 */

// Mock Supabase module - must be hoisted
vi.mock('./supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
  };
});

// Mock monitoring service
vi.mock('./monitoringService', () => ({
  startTransaction: vi.fn(() => ({ finish: vi.fn() })),
  captureError: vi.fn(),
}));

// Mock notification service — booking transitions send in-app notifications
vi.mock('./notificationService', () => ({
  createInAppNotification: vi.fn().mockResolvedValue({ data: { id: 'notif-mock' }, error: null }),
}));

// Import after mocking
import {
  createBooking,
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  getBookingsByWorker,
  getBookingsByCustomer,
  getBookingDetails,
  isValidTransition,
  VALID_TRANSITIONS,
  BOOKING_ERROR_CODES,
} from './bookingService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const userIdArbitrary = fc.uuid();
const bookingIdArbitrary = fc.uuid();
const jobIdArbitrary = fc.uuid();
const countryArbitrary: fc.Arbitrary<Country> = fc.constantFrom('GH', 'NG');
const currencyArbitrary: fc.Arbitrary<Currency> = fc.constantFrom('GHS', 'NGN');

const bookingStatusArbitrary: fc.Arbitrary<BookingStatus> = fc.constantFrom(
  'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'
);

// Generate valid date strings
const validDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString());


// Helper to create a mock Job
function createMockJob(id: string, posterId: string): Job {
  const now = new Date().toISOString();
  return {
    id,
    poster_user_id: posterId,
    title: 'Test Job',
    description: 'Test description',
    category: 'plumbing',
    location: 'Accra',
    location_lat: null,
    location_lng: null,
    country: 'GH',
    budget_min: 100,
    budget_max: 500,
    currency: 'GHS',
    status: 'open',
    scheduled_at: null,
    created_at: now,
    updated_at: now,
  };
}

// Helper to create a mock Booking
function createMockBooking(
  id: string,
  jobId: string,
  workerId: string,
  customerId: string,
  status: BookingStatus = 'PENDING',
  customerMessage?: string,
  workerMessage?: string
): Booking {
  const now = new Date().toISOString();
  return {
    id,
    job_id: jobId,
    worker_user_id: workerId,
    customer_user_id: customerId,
    status,
    customer_message: customerMessage ?? null,
    worker_message: workerMessage ?? null,
    scheduled_at: null,
    started_at: status === 'IN_PROGRESS' || status === 'COMPLETED' ? now : null,
    completed_at: status === 'COMPLETED' ? now : null,
    cancelled_at: status === 'CANCELLED' ? now : null,
    cancellation_reason: status === 'CANCELLED' ? 'Test cancellation' : null,
    created_at: now,
    updated_at: now,
  };
}

// Helper to create a mock Profile
function createMockProfile(id: string): Profile {
  const now = new Date().toISOString();
  return {
    id,
    phone: '+233123456789',
    role: 'customer',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    bio: null,
    location: 'Accra',
    country: 'GH',
    avatar_url: null,
    profile_completed: true,
    rating: 4.5,
    review_count: 10,
    verified: true,
    created_at: now,
    updated_at: now,
  };
}

describe('Booking Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 7: Booking Creation Sets PENDING Status
   * Validates: Requirements 2.1
   * 
   * For any valid booking creation with jobId and workerId, the resulting booking
   * should have status 'PENDING'.
   */
  describe('Property 7: Booking Creation Sets PENDING Status', () => {
    it('for any valid booking creation, status is set to PENDING', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobIdArbitrary,
          userIdArbitrary, // workerId
          userIdArbitrary, // customerId (poster)
          fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
          async (jobId, workerId, customerId, customerMessage) => {
            vi.mocked(supabase.from).mockReset();

            const mockJob = createMockJob(jobId, customerId);
            const mockBookingId = fc.sample(fc.uuid(), 1)[0];
            const expectedBooking = createMockBooking(
              mockBookingId,
              jobId,
              workerId,
              customerId,
              'PENDING',
              customerMessage
            );

            // Mock job lookup
            const mockJobSingle = vi.fn().mockResolvedValue({
              data: mockJob,
              error: null,
            });
            const mockJobEq = vi.fn().mockReturnValue({ single: mockJobSingle });
            const mockJobSelect = vi.fn().mockReturnValue({ eq: mockJobEq });

            // Mock booking insert
            const mockBookingSingle = vi.fn().mockResolvedValue({
              data: expectedBooking,
              error: null,
            });
            const mockBookingSelect = vi.fn().mockReturnValue({ single: mockBookingSingle });
            const mockBookingInsert = vi.fn().mockReturnValue({ select: mockBookingSelect });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              callCount++;
              if (table === 'jobs') {
                return { select: mockJobSelect } as any;
              }
              return { insert: mockBookingInsert } as any;
            });

            const result = await createBooking(jobId, workerId, customerMessage);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify status is 'PENDING'
              expect(result.data.status).toBe('PENDING');
              // Verify job_id matches
              expect(result.data.job_id).toBe(jobId);
              // Verify worker_user_id matches
              expect(result.data.worker_user_id).toBe(workerId);
              // Verify customer_user_id matches
              expect(result.data.customer_user_id).toBe(customerId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any booking creation, the insert data contains status PENDING', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedInsertData: any = null;
            const mockJob = createMockJob(jobId, customerId);
            const mockBookingId = fc.sample(fc.uuid(), 1)[0];
            const expectedBooking = createMockBooking(mockBookingId, jobId, workerId, customerId, 'PENDING');

            const mockJobSingle = vi.fn().mockResolvedValue({ data: mockJob, error: null });
            const mockJobEq = vi.fn().mockReturnValue({ single: mockJobSingle });
            const mockJobSelect = vi.fn().mockReturnValue({ eq: mockJobEq });

            const mockBookingSingle = vi.fn().mockResolvedValue({ data: expectedBooking, error: null });
            const mockBookingSelect = vi.fn().mockReturnValue({ single: mockBookingSingle });
            const mockBookingInsert = vi.fn().mockImplementation((data) => {
              capturedInsertData = data;
              return { select: mockBookingSelect };
            });

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'jobs') {
                return { select: mockJobSelect } as any;
              }
              if (table === 'bookings') {
                return { insert: mockBookingInsert } as any;
              }
              return {} as any;
            });

            await createBooking(jobId, workerId);

            expect(capturedInsertData).not.toBeNull();
            expect(capturedInsertData.status).toBe('PENDING');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 8: Booking Valid State Transitions
   * Validates: Requirements 2.2, 2.3, 2.4, 2.5
   * 
   * For any booking, the following state transitions should be valid:
   * PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→COMPLETED, and any non-COMPLETED state→CANCELLED.
   */
  describe('Property 8: Booking Valid State Transitions', () => {
    it('isValidTransition returns true for all valid transitions', () => {
      fc.assert(
        fc.property(
          bookingStatusArbitrary,
          (currentStatus) => {
            const validNextStatuses = VALID_TRANSITIONS[currentStatus];
            
            // For each valid next status, isValidTransition should return true
            for (const nextStatus of validNextStatuses) {
              expect(isValidTransition(currentStatus, nextStatus)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PENDING can transition to ACCEPTED', () => {
      expect(isValidTransition('PENDING', 'ACCEPTED')).toBe(true);
    });

    it('ACCEPTED can transition to IN_PROGRESS', () => {
      expect(isValidTransition('ACCEPTED', 'IN_PROGRESS')).toBe(true);
    });

    it('IN_PROGRESS can transition to COMPLETED', () => {
      expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('PENDING, ACCEPTED, IN_PROGRESS can all transition to CANCELLED', () => {
      expect(isValidTransition('PENDING', 'CANCELLED')).toBe(true);
      expect(isValidTransition('ACCEPTED', 'CANCELLED')).toBe(true);
      expect(isValidTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    });

    it('acceptBooking transitions PENDING to ACCEPTED', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
          async (bookingId, jobId, workerId, customerId, workerMessage) => {
            vi.mocked(supabase.from).mockReset();

            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'PENDING');
            const updatedBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'ACCEPTED', undefined, workerMessage);

            // Mock fetch current booking
            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            // Mock update
            const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedBooking, error: null });
            const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
            const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockFetchSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await acceptBooking(bookingId, workerMessage);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            if (result.data) {
              expect(result.data.status).toBe('ACCEPTED');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('startBooking transitions ACCEPTED to IN_PROGRESS', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'ACCEPTED');
            const updatedBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'IN_PROGRESS');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedBooking, error: null });
            const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
            const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockFetchSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await startBooking(bookingId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            if (result.data) {
              expect(result.data.status).toBe('IN_PROGRESS');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('completeBooking transitions IN_PROGRESS to COMPLETED', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'IN_PROGRESS');
            const updatedBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'COMPLETED');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedBooking, error: null });
            const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
            const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { select: mockFetchSelect } as any;
              }
              return { update: mockUpdate } as any;
            });

            const result = await completeBooking(bookingId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            if (result.data) {
              expect(result.data.status).toBe('COMPLETED');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 9: Booking Invalid State Transitions Rejected
   * Validates: Requirements 2.9
   * 
   * For any booking, invalid state transitions (e.g., PENDING→COMPLETED, CANCELLED→ACCEPTED)
   * should be rejected with an error.
   */
  describe('Property 9: Booking Invalid State Transitions Rejected', () => {
    it('isValidTransition returns false for all invalid transitions', () => {
      const allStatuses: BookingStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'];
      
      fc.assert(
        fc.property(
          bookingStatusArbitrary,
          (currentStatus) => {
            const validNextStatuses = VALID_TRANSITIONS[currentStatus];
            const invalidStatuses = allStatuses.filter(s => !validNextStatuses.includes(s) && s !== currentStatus);
            
            // For each invalid next status, isValidTransition should return false
            for (const invalidStatus of invalidStatuses) {
              expect(isValidTransition(currentStatus, invalidStatus)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('PENDING cannot transition directly to COMPLETED', () => {
      expect(isValidTransition('PENDING', 'COMPLETED')).toBe(false);
    });

    it('PENDING cannot transition directly to IN_PROGRESS', () => {
      expect(isValidTransition('PENDING', 'IN_PROGRESS')).toBe(false);
    });

    it('CANCELLED cannot transition to any other status', () => {
      const allStatuses: BookingStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'];
      for (const status of allStatuses) {
        if (status !== 'CANCELLED') {
          expect(isValidTransition('CANCELLED', status)).toBe(false);
        }
      }
    });

    it('REVIEWED cannot transition to any other status', () => {
      const allStatuses: BookingStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'];
      for (const status of allStatuses) {
        if (status !== 'REVIEWED') {
          expect(isValidTransition('REVIEWED', status)).toBe(false);
        }
      }
    });

    it('acceptBooking rejects invalid transition from COMPLETED', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            // Booking is already COMPLETED
            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'COMPLETED');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockFetchSelect } as any);

            const result = await acceptBooking(bookingId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('startBooking rejects invalid transition from PENDING', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            // Booking is still PENDING (should be ACCEPTED first)
            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'PENDING');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockFetchSelect } as any);

            const result = await startBooking(bookingId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('completeBooking rejects invalid transition from PENDING', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'PENDING');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockFetchSelect } as any);

            const result = await completeBooking(bookingId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cancelBooking rejects invalid transition from COMPLETED', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          fc.string({ minLength: 1, maxLength: 200 }),
          async (bookingId, jobId, workerId, customerId, reason) => {
            vi.mocked(supabase.from).mockReset();

            const currentBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'COMPLETED');

            const mockFetchSingle = vi.fn().mockResolvedValue({ data: currentBooking, error: null });
            const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle });
            const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq });

            vi.mocked(supabase.from).mockReturnValue({ select: mockFetchSelect } as any);

            const result = await cancelBooking(bookingId, reason);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(BOOKING_ERROR_CODES.INVALID_STATUS_TRANSITION);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 10: Booking Query by Worker Returns Only Worker's Bookings
   * Validates: Requirements 2.6
   * 
   * For any set of bookings and a worker ID, getBookingsByWorker should return only bookings
   * where worker_user_id matches the given ID.
   */
  describe('Property 10: Booking Query by Worker Returns Only Worker\'s Bookings', () => {
    it('for any worker ID, getBookingsByWorker returns only bookings with matching worker_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(
            fc.record({
              jobId: jobIdArbitrary,
              customerId: userIdArbitrary,
              status: bookingStatusArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (workerId, bookingInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock bookings all belonging to the worker
            const mockBookings = bookingInputs.map((input) => {
              return createMockBooking(
                fc.sample(fc.uuid(), 1)[0],
                input.jobId,
                workerId, // All bookings belong to this worker
                input.customerId,
                input.status
              );
            });

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: mockBookings,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getBookingsByWorker(workerId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned bookings should have the matching worker_user_id
            if (result.data) {
              for (const booking of result.data) {
                expect(booking.worker_user_id).toBe(workerId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getBookingsByWorker queries with correct worker_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (workerId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedField: string | null = null;
            let capturedValue: string | null = null;

            const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedField = field;
              capturedValue = value;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            await getBookingsByWorker(workerId);

            expect(capturedField).toBe('worker_user_id');
            expect(capturedValue).toBe(workerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getBookingsByWorker with status filter returns only matching status', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          bookingStatusArbitrary,
          fc.array(jobIdArbitrary, { minLength: 1, maxLength: 5 }),
          async (workerId, filterStatus, jobIds) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock bookings with the filter status
            const mockBookings = jobIds.map((jobId) => {
              return createMockBooking(
                fc.sample(fc.uuid(), 1)[0],
                jobId,
                workerId,
                fc.sample(fc.uuid(), 1)[0],
                filterStatus
              );
            });

            const mockOrder = vi.fn().mockResolvedValue({ data: mockBookings, error: null });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockEqWorker = vi.fn().mockReturnValue({ eq: mockEqStatus });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqWorker });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getBookingsByWorker(workerId, filterStatus);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              for (const booking of result.data) {
                expect(booking.worker_user_id).toBe(workerId);
                expect(booking.status).toBe(filterStatus);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 11: Booking Query by Customer Returns Only Customer's Bookings
   * Validates: Requirements 2.7
   * 
   * For any set of bookings and a customer ID, getBookingsByCustomer should return only bookings
   * where customer_user_id matches the given ID.
   */
  describe('Property 11: Booking Query by Customer Returns Only Customer\'s Bookings', () => {
    it('for any customer ID, getBookingsByCustomer returns only bookings with matching customer_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(
            fc.record({
              jobId: jobIdArbitrary,
              workerId: userIdArbitrary,
              status: bookingStatusArbitrary,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (customerId, bookingInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock bookings all belonging to the customer
            const mockBookings = bookingInputs.map((input) => {
              return createMockBooking(
                fc.sample(fc.uuid(), 1)[0],
                input.jobId,
                input.workerId,
                customerId, // All bookings belong to this customer
                input.status
              );
            });

            const mockOrder = vi.fn().mockResolvedValue({
              data: mockBookings,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getBookingsByCustomer(customerId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned bookings should have the matching customer_user_id
            if (result.data) {
              for (const booking of result.data) {
                expect(booking.customer_user_id).toBe(customerId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getBookingsByCustomer queries with correct customer_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (customerId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedField: string | null = null;
            let capturedValue: string | null = null;

            const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedField = field;
              capturedValue = value;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            await getBookingsByCustomer(customerId);

            expect(capturedField).toBe('customer_user_id');
            expect(capturedValue).toBe(customerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getBookingsByCustomer with status filter returns only matching status', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          bookingStatusArbitrary,
          fc.array(jobIdArbitrary, { minLength: 1, maxLength: 5 }),
          async (customerId, filterStatus, jobIds) => {
            vi.mocked(supabase.from).mockReset();

            const mockBookings = jobIds.map((jobId) => {
              return createMockBooking(
                fc.sample(fc.uuid(), 1)[0],
                jobId,
                fc.sample(fc.uuid(), 1)[0],
                customerId,
                filterStatus
              );
            });

            const mockOrder = vi.fn().mockResolvedValue({ data: mockBookings, error: null });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockEqCustomer = vi.fn().mockReturnValue({ eq: mockEqStatus });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqCustomer });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getBookingsByCustomer(customerId, filterStatus);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              for (const booking of result.data) {
                expect(booking.customer_user_id).toBe(customerId);
                expect(booking.status).toBe(filterStatus);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 12: Booking Details Round-Trip
   * Validates: Requirements 2.8
   * 
   * For any created booking, getBookingDetails should return the booking with all original data
   * plus associated job and user information.
   */
  describe('Property 12: Booking Details Round-Trip', () => {
    it('for any booking, getBookingDetails returns booking with associated data', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          bookingStatusArbitrary,
          fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
          fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
          async (bookingId, jobId, workerId, customerId, status, customerMessage, workerMessage) => {
            vi.mocked(supabase.from).mockReset();

            const mockBooking = createMockBooking(
              bookingId,
              jobId,
              workerId,
              customerId,
              status,
              customerMessage ?? undefined,
              workerMessage ?? undefined
            );
            const mockJob = createMockJob(jobId, customerId);
            const mockWorker = createMockProfile(workerId);
            const mockCustomer = createMockProfile(customerId);

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation((table: string) => {
              callCount++;
              
              if (table === 'bookings') {
                const mockSingle = vi.fn().mockResolvedValue({ data: mockBooking, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              
              if (table === 'jobs') {
                const mockSingle = vi.fn().mockResolvedValue({ data: mockJob, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              
              if (table === 'profiles') {
                // Return worker or customer based on call order
                const profile = callCount === 3 ? mockWorker : mockCustomer;
                const mockSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              
              return {} as any;
            });

            const result = await getBookingDetails(bookingId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify booking data is preserved
              expect(result.data.id).toBe(bookingId);
              expect(result.data.job_id).toBe(jobId);
              expect(result.data.worker_user_id).toBe(workerId);
              expect(result.data.customer_user_id).toBe(customerId);
              expect(result.data.status).toBe(status);
              expect(result.data.customer_message).toBe(customerMessage);
              expect(result.data.worker_message).toBe(workerMessage);

              // Verify associated data is included
              expect(result.data.job).toBeDefined();
              expect(result.data.job?.id).toBe(jobId);
              expect(result.data.worker).toBeDefined();
              expect(result.data.worker?.id).toBe(workerId);
              expect(result.data.customer).toBeDefined();
              expect(result.data.customer?.id).toBe(customerId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getBookingDetails returns error for non-existent booking', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          async (bookingId) => {
            vi.mocked(supabase.from).mockReset();

            const mockSingle = vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Record not found' },
            });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getBookingDetails(bookingId);

            expect(result.data).toBeNull();
            expect(result.error).not.toBeNull();
            expect(result.error?.code).toBe(BOOKING_ERROR_CODES.BOOKING_NOT_FOUND);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('booking data integrity is preserved through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          bookingIdArbitrary,
          jobIdArbitrary,
          userIdArbitrary,
          userIdArbitrary,
          async (bookingId, jobId, workerId, customerId) => {
            vi.mocked(supabase.from).mockReset();

            const originalBooking = createMockBooking(bookingId, jobId, workerId, customerId, 'PENDING');
            const mockJob = createMockJob(jobId, customerId);
            const mockWorker = createMockProfile(workerId);
            const mockCustomer = createMockProfile(customerId);

            vi.mocked(supabase.from).mockImplementation((table: string) => {
              if (table === 'bookings') {
                const mockSingle = vi.fn().mockResolvedValue({ data: originalBooking, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              if (table === 'jobs') {
                const mockSingle = vi.fn().mockResolvedValue({ data: mockJob, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              if (table === 'profiles') {
                const mockSingle = vi.fn().mockResolvedValue({ data: mockWorker, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect } as any;
              }
              return {} as any;
            });

            const result = await getBookingDetails(bookingId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Core booking fields should match exactly
              expect(result.data.id).toBe(originalBooking.id);
              expect(result.data.job_id).toBe(originalBooking.job_id);
              expect(result.data.worker_user_id).toBe(originalBooking.worker_user_id);
              expect(result.data.customer_user_id).toBe(originalBooking.customer_user_id);
              expect(result.data.status).toBe(originalBooking.status);
              expect(result.data.created_at).toBe(originalBooking.created_at);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
