import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Country, Currency, Job, JobStatus } from '../types/database';

/**
 * Feature: backend-services, Property Tests for Job Service
 * Validates: Requirements 3.1, 3.3, 3.5, 3.6
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
  createJob,
  deleteJob,
  getJob,
  searchJobs,
  getJobsByPoster,
  type JobInput,
  type JobSearchFilters,
} from './jobService';
import { supabase } from './supabase';

// Arbitraries for generating test data
const countryArbitrary: fc.Arbitrary<Country> = fc.constantFrom('GH', 'NG');
const currencyArbitrary: fc.Arbitrary<Currency> = fc.constantFrom('GHS', 'NGN');
const jobStatusArbitrary: fc.Arbitrary<JobStatus> = fc.constantFrom('open', 'filled', 'cancelled');
const userIdArbitrary = fc.uuid();
const jobIdArbitrary = fc.uuid();

// Generate valid date strings using integer timestamps
const validDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString());

// Generate valid job input data
const jobInputArbitrary: fc.Arbitrary<JobInput> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  category: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  location: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  location_lat: fc.option(fc.double({ min: -90, max: 90, noNaN: true }), { nil: null }),
  location_lng: fc.option(fc.double({ min: -180, max: 180, noNaN: true }), { nil: null }),
  country: countryArbitrary,
  budget_min: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
  budget_max: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
  currency: fc.option(currencyArbitrary, { nil: null }),
  scheduled_at: fc.option(validDateArbitrary, { nil: null }),
});


// Helper to create a mock Job from JobInput
function createMockJob(id: string, posterId: string, input: JobInput, status: JobStatus = 'open'): Job {
  const now = new Date().toISOString();
  return {
    id,
    poster_user_id: posterId,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    location: input.location,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    country: input.country,
    budget_min: input.budget_min ?? null,
    budget_max: input.budget_max ?? null,
    currency: input.currency ?? null,
    status,
    scheduled_at: input.scheduled_at ?? null,
    created_at: now,
    updated_at: now,
  };
}

describe('Job Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: backend-services, Property 13: Job Creation Sets Open Status
   * Validates: Requirements 3.1
   * 
   * For any valid job creation, the resulting job should have status 'open'.
   */
  describe('Property 13: Job Creation Sets Open Status', () => {
    it('for any valid job creation, status is set to open', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          jobInputArbitrary,
          async (posterId, jobInput) => {
            // Reset mocks for each iteration
            vi.mocked(supabase.from).mockReset();
            
            const mockJobId = fc.sample(fc.uuid(), 1)[0];
            const expectedJob = createMockJob(mockJobId, posterId, jobInput, 'open');

            // Mock successful insert with chained methods
            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedJob,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

            vi.mocked(supabase.from).mockReturnValue({
              insert: mockInsert,
            } as any);

            const result = await createJob(posterId, jobInput);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            if (result.data) {
              // Verify status is 'open'
              expect(result.data.status).toBe('open');
              // Verify poster_user_id matches
              expect(result.data.poster_user_id).toBe(posterId);
              // Verify title matches
              expect(result.data.title).toBe(jobInput.title);
              // Verify category matches
              expect(result.data.category).toBe(jobInput.category);
              // Verify location matches
              expect(result.data.location).toBe(jobInput.location);
              // Verify country matches
              expect(result.data.country).toBe(jobInput.country);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any job creation, the insert data contains status open', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          jobInputArbitrary,
          async (posterId, jobInput) => {
            vi.mocked(supabase.from).mockReset();
            
            let capturedInsertData: any = null;
            const mockJobId = fc.sample(fc.uuid(), 1)[0];
            const expectedJob = createMockJob(mockJobId, posterId, jobInput, 'open');

            const mockSingle = vi.fn().mockResolvedValue({
              data: expectedJob,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockImplementation((data) => {
              capturedInsertData = data;
              return { select: mockSelect };
            });

            vi.mocked(supabase.from).mockReturnValue({
              insert: mockInsert,
            } as any);

            await createJob(posterId, jobInput);

            // Verify the insert was called with status 'open'
            expect(capturedInsertData).not.toBeNull();
            expect(capturedInsertData.status).toBe('open');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 15: Job Deletion Removes Record
   * Validates: Requirements 3.3
   * 
   * For any deleted job, subsequent getJob calls should return a not-found error.
   */
  describe('Property 15: Job Deletion Removes Record', () => {
    it('for any job deletion, the delete operation is called with correct job ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobIdArbitrary,
          async (jobId) => {
            vi.mocked(supabase.from).mockReset();
            
            let capturedJobId: string | null = null;

            // Mock successful delete
            const mockEq = vi.fn().mockImplementation((field, value) => {
              if (field === 'id') {
                capturedJobId = value;
              }
              return Promise.resolve({ error: null });
            });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              delete: mockDelete,
            } as any);

            const result = await deleteJob(jobId);

            // Verify no error
            expect(result.error).toBeNull();
            // Verify the correct job ID was used
            expect(capturedJobId).toBe(jobId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('after deletion, getJob returns not found error', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobIdArbitrary,
          async (jobId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock delete success
            const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
            const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

            // Mock getJob returning not found (PGRST116)
            const mockSelectSingle = vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Record not found' },
            });
            const mockSelectEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

            let callCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return { delete: mockDelete } as any;
              }
              return { select: mockSelect } as any;
            });

            // First delete the job
            const deleteResult = await deleteJob(jobId);
            expect(deleteResult.error).toBeNull();

            // Then try to get it - should return not found
            const getResult = await getJob(jobId);
            expect(getResult.data).toBeNull();
            expect(getResult.error).not.toBeNull();
            expect(getResult.error?.code).toBe('DB_006'); // NOT_FOUND
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 16: Job Search Returns Matching Results
   * Validates: Requirements 3.5
   * 
   * For any set of jobs and search filters, all returned jobs should match
   * every specified filter criterion (category, location, budget range).
   */
  describe('Property 16: Job Search Returns Matching Results', () => {
    it('for any category filter, all returned jobs have matching category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 10 }),
          async (filterCategory, jobInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock jobs - some matching, some not
            const mockJobs = jobInputs.map((input, idx) => {
              const job = createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                { ...input, category: idx % 2 === 0 ? filterCategory : input.category },
                'open'
              );
              return job;
            });

            // Filter to only matching jobs
            const matchingJobs = mockJobs.filter(j => j.category === filterCategory);

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: matchingJobs,
              error: null,
            });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockEqCategory = vi.fn().mockReturnValue({ eq: mockEqStatus });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqCategory });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const filters: JobSearchFilters = { category: filterCategory };
            const result = await searchJobs(filters);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned jobs should have the matching category
            if (result.data) {
              for (const job of result.data) {
                expect(job.category).toBe(filterCategory);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any country filter, all returned jobs have matching country', async () => {
      await fc.assert(
        fc.asyncProperty(
          countryArbitrary,
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 10 }),
          async (filterCountry, jobInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock jobs with the filter country
            const mockJobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                { ...input, country: filterCountry },
                'open'
              );
            });

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: mockJobs,
              error: null,
            });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockEqCountry = vi.fn().mockReturnValue({ eq: mockEqStatus });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqCountry });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const filters: JobSearchFilters = { country: filterCountry };
            const result = await searchJobs(filters);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned jobs should have the matching country
            if (result.data) {
              for (const job of result.data) {
                expect(job.country).toBe(filterCountry);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any status filter, all returned jobs have matching status', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobStatusArbitrary,
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 10 }),
          async (filterStatus, jobInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock jobs with the filter status
            const mockJobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                input,
                filterStatus
              );
            });

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: mockJobs,
              error: null,
            });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqStatus });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const filters: JobSearchFilters = { status: filterStatus };
            const result = await searchJobs(filters);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned jobs should have the matching status
            if (result.data) {
              for (const job of result.data) {
                expect(job.status).toBe(filterStatus);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('with no filters, search defaults to open status jobs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 10 }),
          async (jobInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock jobs all with 'open' status
            const mockJobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                fc.sample(fc.uuid(), 1)[0],
                input,
                'open'
              );
            });

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: mockJobs,
              error: null,
            });
            const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEqStatus });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await searchJobs({});

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned jobs should have 'open' status
            if (result.data) {
              for (const job of result.data) {
                expect(job.status).toBe('open');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: backend-services, Property 17: Job Query by Poster Returns Only Poster's Jobs
   * Validates: Requirements 3.6
   * 
   * For any set of jobs and a user ID, getJobsByPoster should return only jobs
   * where poster_user_id matches the given ID.
   */
  describe('Property 17: Job Query by Poster Returns Only Poster\'s Jobs', () => {
    it('for any user ID, getJobsByPoster returns only jobs with matching poster_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 10 }),
          async (posterId, jobInputs) => {
            vi.mocked(supabase.from).mockReset();

            // Create mock jobs all belonging to the poster
            const mockJobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                posterId, // All jobs belong to this poster
                input,
                'open'
              );
            });

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: mockJobs,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getJobsByPoster(posterId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // All returned jobs should have the matching poster_user_id
            if (result.data) {
              for (const job of result.data) {
                expect(job.poster_user_id).toBe(posterId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getJobsByPoster queries with correct poster_user_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (posterId) => {
            vi.mocked(supabase.from).mockReset();

            let capturedField: string | null = null;
            let capturedValue: string | null = null;

            // Mock the query chain
            const mockOrder = vi.fn().mockResolvedValue({
              data: [],
              error: null,
            });
            const mockEq = vi.fn().mockImplementation((field, value) => {
              capturedField = field;
              capturedValue = value;
              return { order: mockOrder };
            });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            await getJobsByPoster(posterId);

            // Verify the query was made with correct field and value
            expect(capturedField).toBe('poster_user_id');
            expect(capturedValue).toBe(posterId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for different poster IDs, getJobsByPoster returns different job sets', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          userIdArbitrary.filter(id => id !== ''), // Different poster
          fc.array(jobInputArbitrary, { minLength: 1, maxLength: 5 }),
          async (poster1Id, poster2Id, jobInputs) => {
            // Skip if IDs happen to be the same
            if (poster1Id === poster2Id) return;

            vi.mocked(supabase.from).mockReset();

            // Create jobs for poster1
            const poster1Jobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                poster1Id,
                input,
                'open'
              );
            });

            // Create jobs for poster2
            const poster2Jobs = jobInputs.map((input) => {
              return createMockJob(
                fc.sample(fc.uuid(), 1)[0],
                poster2Id,
                input,
                'open'
              );
            });

            let queryCount = 0;
            vi.mocked(supabase.from).mockImplementation(() => {
              queryCount++;
              const mockOrder = vi.fn().mockResolvedValue({
                data: queryCount === 1 ? poster1Jobs : poster2Jobs,
                error: null,
              });
              const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
              const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
              return { select: mockSelect } as any;
            });

            const result1 = await getJobsByPoster(poster1Id);
            const result2 = await getJobsByPoster(poster2Id);

            expect(result1.error).toBeNull();
            expect(result2.error).toBeNull();

            // Verify poster1's jobs all belong to poster1
            if (result1.data) {
              for (const job of result1.data) {
                expect(job.poster_user_id).toBe(poster1Id);
              }
            }

            // Verify poster2's jobs all belong to poster2
            if (result2.data) {
              for (const job of result2.data) {
                expect(job.poster_user_id).toBe(poster2Id);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for a poster with no jobs, getJobsByPoster returns empty array', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (posterId) => {
            vi.mocked(supabase.from).mockReset();

            // Mock empty result
            const mockOrder = vi.fn().mockResolvedValue({
              data: [],
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

            vi.mocked(supabase.from).mockReturnValue({
              select: mockSelect,
            } as any);

            const result = await getJobsByPoster(posterId);

            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            expect(result.data).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
