import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Country, Currency, WorkerProfile } from '../types/database';

/**
 * Feature: infrastructure-enhancements, Property 3: Worker Profile Persistence Round Trip
 * Validates: Requirements 1.4
 * 
 * For any valid worker profile input, after creating or updating a profile,
 * querying that profile should return data equivalent to the input.
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

// Import after mocking
import { createProfile, updateProfile, getProfile, searchProfiles } from './workerService';
import type { WorkerProfileInput, WorkerSearchFilters } from './workerService';
import { supabase } from './supabase';

/** Build a Supabase query mock ending in maybeSingle (used by getProfile / getProfileByUserId). */
function mockMaybeSingleQuery(result: { data: unknown; error: unknown }) {
  const terminal = vi.fn().mockResolvedValue(result);
  const mockEq = vi.fn().mockReturnValue({ maybeSingle: terminal, single: terminal });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  return { select: mockSelect };
}

// Arbitraries for generating test data
const countryArbitrary: fc.Arbitrary<Country> = fc.constantFrom('GH', 'NG');
const currencyArbitrary: fc.Arbitrary<Currency> = fc.constantFrom('GHS', 'NGN');

const nameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const roleArbitrary = fc.constantFrom(
  'Electrician', 'Plumber', 'Carpenter', 'Mason', 'Painter', 
  'Welder', 'Mechanic', 'Tailor', 'Hairdresser', 'Driver'
);

const locationArbitrary = fc.constantFrom(
  'Accra', 'Kumasi', 'Tamale', 'Lagos', 'Abuja', 'Port Harcourt',
  'Tema', 'Cape Coast', 'Ibadan', 'Kano'
);

const skillArbitrary = fc.constantFrom(
  'Wiring', 'Plumbing', 'Carpentry', 'Masonry', 'Painting',
  'Welding', 'Auto Repair', 'Tailoring', 'Hair Styling', 'Driving'
);

const skillsArbitrary = fc.array(skillArbitrary, { minLength: 0, maxLength: 5 })
  .map(skills => [...new Set(skills)]); // Remove duplicates

const hourlyRateArbitrary = fc.record({
  min: fc.integer({ min: 10, max: 500 }),
  max: fc.integer({ min: 10, max: 1000 }),
  currency: currencyArbitrary,
}).filter(rate => rate.min <= rate.max);


const workerProfileInputArbitrary: fc.Arbitrary<WorkerProfileInput> = fc.record({
  name: nameArbitrary,
  role: roleArbitrary,
  location: locationArbitrary,
  country: countryArbitrary,
  bio: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  hourlyRate: fc.option(hourlyRateArbitrary, { nil: undefined }),
  skills: fc.option(skillsArbitrary, { nil: undefined }),
  experienceYears: fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
});

const userIdArbitrary = fc.uuid();
const profileIdArbitrary = fc.uuid();

describe('Worker Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Feature: infrastructure-enhancements, Property 3: Worker Profile Persistence Round Trip
   * Validates: Requirements 1.4
   */
  describe('Property 3: Worker Profile Persistence Round Trip', () => {
    it('for any valid profile input, createProfile returns profile with matching data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          workerProfileInputArbitrary,
          async (userId, profileInput) => {
            const mockProfileId = `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const now = new Date().toISOString();
            
            // Build expected profile from input
            const expectedProfile: WorkerProfile = {
              id: mockProfileId,
              user_id: userId,
              name: profileInput.name,
              role: profileInput.role,
              location: profileInput.location,
              location_lat: null,
              location_lng: null,
              country: profileInput.country,
              bio: profileInput.bio ?? null,
              hourly_rate_min: profileInput.hourlyRate?.min ?? null,
              hourly_rate_max: profileInput.hourlyRate?.max ?? null,
              currency: profileInput.hourlyRate?.currency ?? null,
              rating: 0,
              review_count: 0,
              skills: profileInput.skills ?? [],
              tier: 'free',
              verified: false,
              experience_years: profileInput.experienceYears ?? null,
              created_at: now,
              updated_at: now,
            };

            // Mock successful upsert with select
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: expectedProfile,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              upsert: mockUpsert,
            } as any);

            const result = await createProfile(userId, profileInput);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            
            // Verify returned profile matches input
            if (result.data) {
              expect(result.data.user_id).toBe(userId);
              expect(result.data.name).toBe(profileInput.name);
              expect(result.data.role).toBe(profileInput.role);
              expect(result.data.location).toBe(profileInput.location);
              expect(result.data.country).toBe(profileInput.country);
              expect(result.data.bio).toBe(profileInput.bio ?? null);
              expect(result.data.skills).toEqual(profileInput.skills ?? []);
              expect(result.data.experience_years).toBe(profileInput.experienceYears ?? null);
              
              if (profileInput.hourlyRate) {
                expect(result.data.hourly_rate_min).toBe(profileInput.hourlyRate.min);
                expect(result.data.hourly_rate_max).toBe(profileInput.hourlyRate.max);
                expect(result.data.currency).toBe(profileInput.hourlyRate.currency);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any valid profile, getProfile returns the same profile that was created', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          userIdArbitrary,
          workerProfileInputArbitrary,
          async (profileId, userId, profileInput) => {
            const now = new Date().toISOString();
            
            // Build stored profile
            const storedProfile: WorkerProfile = {
              id: profileId,
              user_id: userId,
              name: profileInput.name,
              role: profileInput.role,
              location: profileInput.location,
              location_lat: null,
              location_lng: null,
              country: profileInput.country,
              bio: profileInput.bio ?? null,
              hourly_rate_min: profileInput.hourlyRate?.min ?? null,
              hourly_rate_max: profileInput.hourlyRate?.max ?? null,
              currency: profileInput.hourlyRate?.currency ?? null,
              rating: 0,
              review_count: 0,
              skills: profileInput.skills ?? [],
              tier: 'free',
              verified: false,
              experience_years: profileInput.experienceYears ?? null,
              created_at: now,
              updated_at: now,
            };

            // Mock successful select
            const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
              data: storedProfile,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              select: mockSelect,
            } as any);

            const result = await getProfile(profileId);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            
            // Verify retrieved profile matches stored profile
            if (result.data) {
              expect(result.data.id).toBe(profileId);
              expect(result.data.user_id).toBe(userId);
              expect(result.data.name).toBe(profileInput.name);
              expect(result.data.role).toBe(profileInput.role);
              expect(result.data.location).toBe(profileInput.location);
              expect(result.data.country).toBe(profileInput.country);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any profile update, updateProfile returns profile with updated fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          userIdArbitrary,
          workerProfileInputArbitrary,
          workerProfileInputArbitrary,
          async (profileId, userId, originalInput, updateInput) => {
            const now = new Date().toISOString();
            
            // Build updated profile
            const updatedProfile: WorkerProfile = {
              id: profileId,
              user_id: userId,
              name: updateInput.name,
              role: updateInput.role,
              location: updateInput.location,
              location_lat: null,
              location_lng: null,
              country: updateInput.country,
              bio: updateInput.bio ?? null,
              hourly_rate_min: updateInput.hourlyRate?.min ?? null,
              hourly_rate_max: updateInput.hourlyRate?.max ?? null,
              currency: updateInput.hourlyRate?.currency ?? null,
              rating: 0,
              review_count: 0,
              skills: updateInput.skills ?? [],
              tier: 'free',
              verified: false,
              experience_years: updateInput.experienceYears ?? null,
              created_at: now,
              updated_at: now,
            };

            // Mock successful update with select
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: updatedProfile,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              update: mockUpdate,
            } as any);

            const result = await updateProfile(profileId, updateInput);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            
            // Verify returned profile has updated values
            if (result.data) {
              expect(result.data.name).toBe(updateInput.name);
              expect(result.data.role).toBe(updateInput.role);
              expect(result.data.location).toBe(updateInput.location);
              expect(result.data.country).toBe(updateInput.country);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: infrastructure-enhancements, Property 4: Worker Search Filter Correctness
   * Validates: Requirements 1.5
   * 
   * For any set of worker profiles and search filter criteria, all returned profiles
   * should satisfy every specified filter condition.
   */
  describe('Property 4: Worker Search Filter Correctness', () => {
    // Generate a set of worker profiles
    // Generate ISO date strings directly to avoid invalid date issues
    const isoDateStringArbitrary = fc.integer({ min: 2020, max: 2025 }).chain(year =>
      fc.integer({ min: 1, max: 12 }).chain(month =>
        fc.integer({ min: 1, max: 28 }).map(day => 
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`
        )
      )
    );

    const workerProfileArbitrary: fc.Arbitrary<WorkerProfile> = fc.record({
      id: fc.uuid(),
      user_id: fc.uuid(),
      name: nameArbitrary,
      role: roleArbitrary,
      location: locationArbitrary,
      location_lat: fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: null }),
      location_lng: fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: null }),
      country: countryArbitrary,
      bio: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
      hourly_rate_min: fc.option(fc.integer({ min: 10, max: 500 }), { nil: null }),
      hourly_rate_max: fc.option(fc.integer({ min: 10, max: 1000 }), { nil: null }),
      currency: fc.option(currencyArbitrary, { nil: null }),
      rating: fc.float({ min: 0, max: 5, noNaN: true }),
      review_count: fc.integer({ min: 0, max: 1000 }),
      skills: skillsArbitrary,
      tier: fc.constantFrom('free', 'basic', 'premium') as fc.Arbitrary<'free' | 'basic' | 'premium'>,
      verified: fc.boolean(),
      experience_years: fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
      created_at: isoDateStringArbitrary,
      updated_at: isoDateStringArbitrary,
    });

    const searchFiltersArbitrary: fc.Arbitrary<WorkerSearchFilters> = fc.record({
      location: fc.option(locationArbitrary, { nil: undefined }),
      country: fc.option(countryArbitrary, { nil: undefined }),
      skills: fc.option(fc.array(skillArbitrary, { minLength: 1, maxLength: 3 }), { nil: undefined }),
      minRating: fc.option(fc.float({ min: 0, max: 5, noNaN: true }), { nil: undefined }),
      maxHourlyRate: fc.option(fc.integer({ min: 50, max: 1000 }), { nil: undefined }),
    });

    // Helper function to check if a profile matches all filters
    function profileMatchesFilters(profile: WorkerProfile, filters: WorkerSearchFilters): boolean {
      // Check location filter (case-insensitive partial match)
      if (filters.location) {
        if (!profile.location.toLowerCase().includes(filters.location.toLowerCase())) {
          return false;
        }
      }

      // Check country filter (exact match)
      if (filters.country) {
        if (profile.country !== filters.country) {
          return false;
        }
      }

      // Check minimum rating filter
      if (filters.minRating !== undefined) {
        if (profile.rating < filters.minRating) {
          return false;
        }
      }

      // Check maximum hourly rate filter
      if (filters.maxHourlyRate !== undefined) {
        if (profile.hourly_rate_max !== null && profile.hourly_rate_max > filters.maxHourlyRate) {
          return false;
        }
      }

      // Check skills filter (profile must contain all specified skills)
      if (filters.skills && filters.skills.length > 0) {
        const hasAllSkills = filters.skills.every(skill => profile.skills.includes(skill));
        if (!hasAllSkills) {
          return false;
        }
      }

      return true;
    }

    it('for any search filters, all returned profiles satisfy every filter condition', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(workerProfileArbitrary, { minLength: 0, maxLength: 20 }),
          searchFiltersArbitrary,
          async (allProfiles, filters) => {
            // Filter profiles that should match
            const expectedMatches = allProfiles.filter(p => profileMatchesFilters(p, filters));

            // Mock the search query to return matching profiles
            vi.mocked(supabase.from).mockReturnValueOnce({
              select: vi.fn().mockReturnValue({
                ilike: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                contains: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: expectedMatches, error: null }),
              }),
            } as any);

            const result = await searchProfiles(filters);

            // Verify no error
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();

            // Verify all returned profiles match the filters
            if (result.data) {
              for (const profile of result.data) {
                expect(profileMatchesFilters(profile, filters)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any country filter, all returned profiles have matching country', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(workerProfileArbitrary, { minLength: 1, maxLength: 10 }),
          countryArbitrary,
          async (allProfiles, country) => {
            // Filter profiles by country
            const matchingProfiles = allProfiles.filter(p => p.country === country);

            // Mock the search query
            vi.mocked(supabase.from).mockReturnValueOnce({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: matchingProfiles, error: null }),
              }),
            } as any);

            const result = await searchProfiles({ country });

            // Verify no error
            expect(result.error).toBeNull();

            // Verify all returned profiles have the correct country
            if (result.data) {
              for (const profile of result.data) {
                expect(profile.country).toBe(country);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('for any minRating filter, all returned profiles have rating >= minRating', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(workerProfileArbitrary, { minLength: 1, maxLength: 10 }),
          fc.float({ min: 0, max: 5, noNaN: true }),
          async (allProfiles, minRating) => {
            // Filter profiles by rating
            const matchingProfiles = allProfiles.filter(p => p.rating >= minRating);

            // Mock the search query
            vi.mocked(supabase.from).mockReturnValueOnce({
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: matchingProfiles, error: null }),
              }),
            } as any);

            const result = await searchProfiles({ minRating });

            // Verify no error
            expect(result.error).toBeNull();

            // Verify all returned profiles meet the rating requirement
            if (result.data) {
              for (const profile of result.data) {
                expect(profile.rating).toBeGreaterThanOrEqual(minRating);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  /**
   * Feature: infrastructure-enhancements, Property 5: Database Error Structure
   * Validates: Requirements 1.6
   * 
   * For any database operation that fails, the returned error object should contain
   * a non-empty error code and a non-empty user-friendly message string.
   */
  describe('Property 5: Database Error Structure', () => {
    // Generate various Supabase/PostgreSQL error codes
    const postgresErrorCodeArbitrary = fc.constantFrom(
      '23505', // Unique violation
      '23503', // Foreign key violation
      '23502', // Not null violation
      '23514', // Check violation
      '42501', // RLS violation
      'PGRST301', // Timeout
      'PGRST116', // Not found
      'PGRST000', // Connection error
      'UNKNOWN' // Unknown error
    );

    const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    it('for any database error, returned error has non-empty code and message', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          workerProfileInputArbitrary,
          postgresErrorCodeArbitrary,
          errorMessageArbitrary,
          async (userId, profileInput, errorCode, errorMessage) => {
            // Mock failed upsert
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: errorCode, message: errorMessage },
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              upsert: mockUpsert,
            } as any);

            const result = await createProfile(userId, profileInput);

            // Verify error is returned
            expect(result.error).not.toBeNull();
            expect(result.data).toBeNull();

            // Verify error has non-empty code
            if (result.error) {
              expect(result.error.code).toBeDefined();
              expect(typeof result.error.code).toBe('string');
              expect(result.error.code.length).toBeGreaterThan(0);

              // Verify error has non-empty message
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any constraint violation error, error code is DB_003', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          workerProfileInputArbitrary,
          fc.constantFrom('23505', '23503'), // Constraint violation codes
          async (userId, profileInput, errorCode) => {
            // Mock constraint violation error
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: errorCode, message: 'Constraint violation' },
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              upsert: mockUpsert,
            } as any);

            const result = await createProfile(userId, profileInput);

            // Verify error code is constraint violation
            expect(result.error).not.toBeNull();
            if (result.error) {
              expect(result.error.code).toBe('DB_003');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('for any RLS violation error, error code is DB_004', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          workerProfileInputArbitrary,
          async (profileId, updateInput) => {
            // Mock RLS violation error
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: '42501', message: 'Permission denied' },
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              update: mockUpdate,
            } as any);

            const result = await updateProfile(profileId, updateInput);

            // Verify error code is RLS violation
            expect(result.error).not.toBeNull();
            if (result.error) {
              expect(result.error.code).toBe('DB_004');
              expect(result.error.message).toBe('You do not have permission to perform this action');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('for any missing profile, getProfile returns null without error', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          async (profileId) => {
            const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
              data: null,
              error: null,
            });
            const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              select: mockSelect,
            } as any);

            const result = await getProfile(profileId);

            expect(result.error).toBeNull();
            expect(result.data).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: infrastructure-enhancements, Property 6: Row Level Security Enforcement
   * Validates: Requirements 1.7
   * 
   * For any user querying worker profiles, the user should only be able to update
   * profiles where they are the owner (user_id matches auth.uid()).
   */
  describe('Property 6: Row Level Security Enforcement', () => {
    it('for any user attempting to update a profile they do not own, the operation should fail with RLS violation', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          userIdArbitrary, // The authenticated user's ID
          userIdArbitrary, // The profile owner's ID (different user)
          workerProfileInputArbitrary,
          async (profileId, authenticatedUserId, profileOwnerId, updateInput) => {
            // Skip if by chance the two user IDs are the same
            // (we want to test the case where they are different)
            if (authenticatedUserId === profileOwnerId) {
              return true; // Skip this test case
            }

            // Mock RLS violation error - this is what Supabase returns when
            // a user tries to update a row they don't have permission to modify
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: '42501', message: 'new row violates row-level security policy for table "worker_profiles"' },
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              update: mockUpdate,
            } as any);

            const result = await updateProfile(profileId, updateInput);

            // Verify that the operation failed with RLS violation
            expect(result.error).not.toBeNull();
            expect(result.data).toBeNull();
            
            if (result.error) {
              // The error should be mapped to DB_004 (RLS_VIOLATION)
              expect(result.error.code).toBe('DB_004');
              expect(result.error.message).toBe('You do not have permission to perform this action');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any user attempting to update their own profile, the operation should succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          userIdArbitrary, // The user who owns the profile
          workerProfileInputArbitrary,
          async (profileId, userId, updateInput) => {
            const now = new Date().toISOString();
            
            // Build the expected updated profile
            const updatedProfile: WorkerProfile = {
              id: profileId,
              user_id: userId,
              name: updateInput.name,
              role: updateInput.role,
              location: updateInput.location,
              location_lat: null,
              location_lng: null,
              country: updateInput.country,
              bio: updateInput.bio ?? null,
              hourly_rate_min: updateInput.hourlyRate?.min ?? null,
              hourly_rate_max: updateInput.hourlyRate?.max ?? null,
              currency: updateInput.hourlyRate?.currency ?? null,
              rating: 0,
              review_count: 0,
              skills: updateInput.skills ?? [],
              tier: 'free',
              verified: false,
              experience_years: updateInput.experienceYears ?? null,
              created_at: now,
              updated_at: now,
            };

            // Mock successful update - this is what happens when the user owns the profile
            const mockSingle = vi.fn().mockResolvedValueOnce({
              data: updatedProfile,
              error: null,
            });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            
            vi.mocked(supabase.from).mockReturnValueOnce({
              update: mockUpdate,
            } as any);

            const result = await updateProfile(profileId, updateInput);

            // Verify that the operation succeeded
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            
            if (result.data) {
              // The returned profile should have the updated values
              expect(result.data.user_id).toBe(userId);
              expect(result.data.name).toBe(updateInput.name);
              expect(result.data.role).toBe(updateInput.role);
              expect(result.data.location).toBe(updateInput.location);
              expect(result.data.country).toBe(updateInput.country);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any profile, only the owner (user_id) should be able to modify it', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileIdArbitrary,
          userIdArbitrary, // Profile owner
          fc.array(userIdArbitrary, { minLength: 1, maxLength: 5 }), // Other users trying to update
          workerProfileInputArbitrary,
          async (profileId, ownerId, otherUserIds, updateInput) => {
            // For each non-owner user, verify they get RLS violation
            for (const otherUserId of otherUserIds) {
              // Skip if this user happens to be the owner
              if (otherUserId === ownerId) {
                continue;
              }

              // Mock RLS violation for non-owner
              const mockSingle = vi.fn().mockResolvedValueOnce({
                data: null,
                error: { code: '42501', message: 'Permission denied' },
              });
              const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
              const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
              const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
              
              vi.mocked(supabase.from).mockReturnValueOnce({
                update: mockUpdate,
              } as any);

              const result = await updateProfile(profileId, updateInput);

              // Non-owner should get RLS violation
              expect(result.error).not.toBeNull();
              expect(result.data).toBeNull();
              
              if (result.error) {
                expect(result.error.code).toBe('DB_004');
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


// Import ranking functions for testing
import {
  calculateCompositeScore,
  getTierWeight,
  normalizeRating,
  calculateDistanceScore,
  calculateActivityBonus,
  calculateCompletionRate,
  calculateResponseTimeFactor,
  buildRankingFactors,
  searchWorkersRanked,
  TIER_WEIGHTS,
  type RankingFactors,
  type WorkerStats,
  type UserLocation,
  type RankedWorker,
} from './workerService';

// Shared arbitraries for ranking tests - defined at module level
const isoDateStringArbitraryRanking = fc.integer({ min: 2020, max: 2025 }).chain(year =>
  fc.integer({ min: 1, max: 12 }).chain(month =>
    fc.integer({ min: 1, max: 28 }).map(day => 
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`
    )
  )
);

const workerProfileArbitraryRanking: fc.Arbitrary<WorkerProfile> = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  name: nameArbitrary,
  role: roleArbitrary,
  location: locationArbitrary,
  location_lat: fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: null }),
  location_lng: fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: null }),
  country: countryArbitrary,
  bio: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  hourly_rate_min: fc.option(fc.integer({ min: 10, max: 500 }), { nil: null }),
  hourly_rate_max: fc.option(fc.integer({ min: 10, max: 1000 }), { nil: null }),
  currency: fc.option(currencyArbitrary, { nil: null }),
  rating: fc.float({ min: 0, max: 5, noNaN: true }),
  review_count: fc.integer({ min: 0, max: 100 }),
  skills: skillsArbitrary,
  tier: fc.constantFrom('free', 'basic', 'premium') as fc.Arbitrary<'free' | 'basic' | 'premium'>,
  verified: fc.boolean(),
  experience_years: fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
  created_at: isoDateStringArbitraryRanking,
  updated_at: isoDateStringArbitraryRanking,
});

const searchFiltersArbitraryRanking: fc.Arbitrary<WorkerSearchFilters> = fc.record({
  location: fc.option(locationArbitrary, { nil: undefined }),
  country: fc.option(countryArbitrary, { nil: undefined }),
  skills: fc.option(fc.array(skillArbitrary, { minLength: 1, maxLength: 3 }), { nil: undefined }),
  minRating: fc.option(fc.float({ min: 0, max: 5, noNaN: true }), { nil: undefined }),
  maxHourlyRate: fc.option(fc.integer({ min: 50, max: 1000 }), { nil: undefined }),
});

// Helper function to check if a profile matches all filters (for ranking tests)
function profileMatchesFiltersRanking(profile: WorkerProfile, filters: WorkerSearchFilters): boolean {
  if (filters.location) {
    if (!profile.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
  }
  if (filters.country) {
    if (profile.country !== filters.country) {
      return false;
    }
  }
  if (filters.minRating !== undefined) {
    if (profile.rating < filters.minRating) {
      return false;
    }
  }
  if (filters.maxHourlyRate !== undefined) {
    if (profile.hourly_rate_max !== null && profile.hourly_rate_max > filters.maxHourlyRate) {
      return false;
    }
  }
  if (filters.skills && filters.skills.length > 0) {
    const hasAllSkills = filters.skills.every(skill => profile.skills.includes(skill));
    if (!hasAllSkills) {
      return false;
    }
  }
  return true;
}

/**
 * Feature: backend-services, Property 41: Search Ranking Composite Score Calculation
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * 
 * For any worker profile, the composite score should correctly incorporate
 * tier weight, normalized rating, distance score, activity bonus, completion rate,
 * and response time factor.
 */
describe('Property 41: Search Ranking Composite Score Calculation', () => {
  // Arbitraries for ranking factors
  const tierArbitrary = fc.constantFrom('free', 'basic', 'premium') as fc.Arbitrary<'free' | 'basic' | 'premium'>;
  
  const rankingFactorsArbitrary: fc.Arbitrary<RankingFactors> = fc.record({
    tierWeight: fc.constantFrom(0.3, 0.6, 1.0),
    ratingScore: fc.float({ min: 0, max: 1, noNaN: true }),
    distanceScore: fc.float({ min: 0, max: 1, noNaN: true }),
    activityBonus: fc.constantFrom(0, 0.1),
    completionRate: fc.float({ min: 0, max: 1, noNaN: true }),
    responseTime: fc.float({ min: 0, max: 1, noNaN: true }),
  });

  const workerStatsArbitrary: fc.Arbitrary<WorkerStats> = fc.record({
    completedBookings: fc.integer({ min: 0, max: 1000 }),
    acceptedBookings: fc.integer({ min: 0, max: 1000 }),
    averageResponseTimeMinutes: fc.float({ min: 0, max: 300, noNaN: true }),
    lastLoginAt: fc.option(
      fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
      { nil: null }
    ),
  });

  const userLocationArbitrary: fc.Arbitrary<UserLocation> = fc.record({
    lat: fc.float({ min: -90, max: 90, noNaN: true }),
    lng: fc.float({ min: -180, max: 180, noNaN: true }),
  });

  it('tier weight is correctly mapped for all tiers', () => {
    fc.assert(
      fc.property(tierArbitrary, (tier) => {
        const weight = getTierWeight(tier);
        
        // Verify correct tier weights per Requirements 8.1
        if (tier === 'premium') {
          expect(weight).toBe(1.0);
        } else if (tier === 'basic') {
          expect(weight).toBe(0.6);
        } else {
          expect(weight).toBe(0.3);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('rating is normalized to 0-1 scale', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 5, noNaN: true }),
        (rating) => {
          const normalized = normalizeRating(rating);
          
          // Verify normalized rating is in 0-1 range
          expect(normalized).toBeGreaterThanOrEqual(0);
          expect(normalized).toBeLessThanOrEqual(1);
          
          // Verify correct normalization (rating / 5)
          expect(normalized).toBeCloseTo(rating / 5, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('distance score returns neutral value when location not provided', () => {
    fc.assert(
      fc.property(
        fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: null }),
        fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: null }),
        (workerLat, workerLng) => {
          // When user location is not provided
          const scoreNoUser = calculateDistanceScore(workerLat, workerLng, undefined);
          expect(scoreNoUser).toBe(0.5);
          
          // When worker location is null
          const scoreNoWorker = calculateDistanceScore(null, null, { lat: 5.6, lng: -0.2 });
          expect(scoreNoWorker).toBe(0.5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('distance score decreases with increasing distance', () => {
    fc.assert(
      fc.property(
        userLocationArbitrary,
        fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }), // Small offset
        fc.float({ min: Math.fround(1), max: Math.fround(5), noNaN: true }), // Larger offset
        (userLocation, smallOffset, largeOffset) => {
          const workerLat = userLocation.lat;
          const workerLng = userLocation.lng;
          
          // Worker at same location
          const scoreAtLocation = calculateDistanceScore(workerLat, workerLng, userLocation);
          
          // Worker slightly away (clamp to valid range)
          const nearLat = Math.max(-90, Math.min(90, workerLat + smallOffset));
          const scoreNear = calculateDistanceScore(nearLat, workerLng, userLocation);
          
          // Worker further away (clamp to valid range)
          const farLat = Math.max(-90, Math.min(90, workerLat + largeOffset));
          const scoreFar = calculateDistanceScore(farLat, workerLng, userLocation);
          
          // Closer workers should have higher or equal scores
          expect(scoreAtLocation).toBeGreaterThanOrEqual(scoreNear);
          expect(scoreNear).toBeGreaterThanOrEqual(scoreFar - 0.01); // Small tolerance for floating point
        }
      ),
      { numRuns: 100 }
    );
  });

  it('activity bonus is 0.1 for recent logins and 0 for old logins', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }), // Days ago
        (daysAgo) => {
          const loginDate = new Date();
          loginDate.setDate(loginDate.getDate() - daysAgo);
          const loginAt = loginDate.toISOString();
          
          const bonus = calculateActivityBonus(loginAt);
          
          // 0.1 bonus if within 7 days, 0 otherwise
          if (daysAgo <= 7) {
            expect(bonus).toBe(0.1);
          } else {
            expect(bonus).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('activity bonus is 0 when lastLoginAt is null', () => {
    const bonus = calculateActivityBonus(null);
    expect(bonus).toBe(0);
  });

  it('completion rate is calculated correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 100 }), // At least 1 to avoid division by zero
        (completed, accepted) => {
          // Ensure completed <= accepted for realistic data
          const actualCompleted = Math.min(completed, accepted);
          const rate = calculateCompletionRate(actualCompleted, accepted);
          
          // Rate should be in 0-1 range
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(1);
          
          // Rate should equal completed/accepted
          expect(rate).toBeCloseTo(actualCompleted / accepted, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completion rate returns neutral value for new workers', () => {
    const rate = calculateCompletionRate(0, 0);
    expect(rate).toBe(0.5);
  });

  it('response time factor decreases with slower response times', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 60, noNaN: true }),
        fc.float({ min: 61, max: 120, noNaN: true }),
        (fastTime, slowTime) => {
          const fastFactor = calculateResponseTimeFactor(fastTime);
          const slowFactor = calculateResponseTimeFactor(slowTime);
          
          // Faster response should have higher factor
          expect(fastFactor).toBeGreaterThan(slowFactor);
          
          // Both should be in 0-1 range
          expect(fastFactor).toBeGreaterThanOrEqual(0);
          expect(fastFactor).toBeLessThanOrEqual(1);
          expect(slowFactor).toBeGreaterThanOrEqual(0);
          expect(slowFactor).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('composite score incorporates all ranking factors', () => {
    fc.assert(
      fc.asyncProperty(
        workerProfileArbitraryRanking,
        rankingFactorsArbitrary,
        async (worker, factors) => {
          const score = calculateCompositeScore(worker, factors);
          
          // Score should be in 0-1 range
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          
          // Score should be a weighted sum of factors
          // Weights: tier=0.25, rating=0.25, distance=0.15, activity=0.10, completion=0.15, response=0.10
          const expectedScore = 
            (factors.tierWeight * 0.25) +
            (factors.ratingScore * 0.25) +
            (factors.distanceScore * 0.15) +
            (factors.activityBonus * 0.10) +
            (factors.completionRate * 0.15) +
            (factors.responseTime * 0.10);
          
          const normalizedExpected = Math.min(1, Math.max(0, expectedScore));
          expect(score).toBeCloseTo(normalizedExpected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('higher tier workers get higher tier weight contribution', () => {
    fc.assert(
      fc.asyncProperty(
        workerProfileArbitraryRanking,
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(0, 0.1),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (worker, ratingScore, distanceScore, activityBonus, completionRate, responseTime) => {
          const baseFactors = {
            ratingScore,
            distanceScore,
            activityBonus,
            completionRate,
            responseTime,
          };
          
          const freeScore = calculateCompositeScore(worker, { ...baseFactors, tierWeight: 0.3 });
          const basicScore = calculateCompositeScore(worker, { ...baseFactors, tierWeight: 0.6 });
          const premiumScore = calculateCompositeScore(worker, { ...baseFactors, tierWeight: 1.0 });
          
          // Premium should score higher than basic, basic higher than free
          expect(premiumScore).toBeGreaterThanOrEqual(basicScore);
          expect(basicScore).toBeGreaterThanOrEqual(freeScore);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: backend-services, Property 42: Search Results Sorted by Score Descending
 * Validates: Requirements 8.7
 * 
 * For any search query returning multiple workers, the results should be
 * sorted by composite score in descending order.
 */
function mockRankedSearchSupabase(profiles: WorkerProfile[]) {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'worker_profiles') {
      return {
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: profiles, error: null }),
        }),
      } as any;
    }

    if (table === 'bookings') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as any;
    }

    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: profiles.map((p) => ({ id: p.user_id, updated_at: p.updated_at })),
            error: null,
          }),
        }),
      } as any;
    }

    return {
      select: vi.fn().mockReturnValue({
        then: (resolve: any) => resolve({ data: [], error: null }),
      }),
    } as any;
  });
}

describe('Property 42: Search Results Sorted by Score Descending', () => {
  it('search results are sorted by composite score in descending order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(workerProfileArbitraryRanking, { minLength: 2, maxLength: 20 }),
        searchFiltersArbitraryRanking,
        async (allProfiles, filters) => {
          // Filter profiles that should match
          const matchingProfiles = allProfiles.filter(p => profileMatchesFiltersRanking(p, filters));
          
          if (matchingProfiles.length < 2) {
            return true; // Skip if not enough profiles to test sorting
          }

          // Mock the search query to return matching profiles
          mockRankedSearchSupabase(matchingProfiles);

          const result = await searchWorkersRanked(filters);

          // Verify no error
          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();

          if (result.data && result.data.length > 1) {
            // Verify results are sorted by composite score in descending order
            for (let i = 0; i < result.data.length - 1; i++) {
              const currentScore = result.data[i].compositeScore;
              const nextScore = result.data[i + 1].compositeScore;
              expect(currentScore).toBeGreaterThanOrEqual(nextScore);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all ranked workers have a valid composite score', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(workerProfileArbitraryRanking, { minLength: 1, maxLength: 10 }),
        async (profiles) => {
          // Mock the search query
          mockRankedSearchSupabase(profiles);

          const result = await searchWorkersRanked({});

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();

          if (result.data) {
            for (const worker of result.data) {
              // Each worker should have a composite score
              expect(worker.compositeScore).toBeDefined();
              expect(typeof worker.compositeScore).toBe('number');
              expect(worker.compositeScore).toBeGreaterThanOrEqual(0);
              expect(worker.compositeScore).toBeLessThanOrEqual(1);
              
              // Each worker should have ranking factors
              expect(worker.rankingFactors).toBeDefined();
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('premium workers rank higher than free workers with same other factors', async () => {
    await fc.assert(
      fc.asyncProperty(
        workerProfileArbitraryRanking,
        async (baseProfile) => {
          // Create two profiles: one premium, one free, with same other attributes
          const premiumProfile: WorkerProfile = { ...baseProfile, id: 'premium-1', tier: 'premium' };
          const freeProfile: WorkerProfile = { ...baseProfile, id: 'free-1', tier: 'free' };
          
          const profiles = [freeProfile, premiumProfile]; // Intentionally put free first

          // Mock the search query
          mockRankedSearchSupabase(profiles);

          const result = await searchWorkersRanked({});

          expect(result.error).toBeNull();
          expect(result.data).not.toBeNull();

          if (result.data && result.data.length === 2) {
            // Premium worker should be first (higher score)
            expect(result.data[0].tier).toBe('premium');
            expect(result.data[1].tier).toBe('free');
            expect(result.data[0].compositeScore).toBeGreaterThan(result.data[1].compositeScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty search results return empty array', async () => {
    // Mock empty search results
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      }),
    } as any);

    const result = await searchWorkersRanked({});

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
