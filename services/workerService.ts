/**
 * Worker Service with Supabase CRUD Operations
 * Implements createProfile, updateProfile, getProfile, searchProfiles, and searchWorkersRanked
 * Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { supabase } from './supabase';
import type { 
  WorkerProfile, 
  WorkerProfileInsert, 
  WorkerProfileUpdate,
  ServiceCategory,
  WorkerPortfolio,
  WorkerEndorsement,
  Profile,
  Country,
  Currency,
  WorkerTier
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Input type for creating a worker profile
 */
export interface WorkerProfileInput {
  name: string;
  role: string;
  location: string;
  country: Country;
  bio?: string | null;
  hourlyRate?: { min: number; max: number; currency: Currency };
  skills?: string[];
  experienceYears?: number | null;
  locationLat?: number | null;
  locationLng?: number | null;
}

/**
 * Search filters for querying worker profiles
 */
export interface WorkerSearchFilters {
  location?: string;
  country?: Country;
  skills?: string[];
  minRating?: number;
  maxHourlyRate?: number;
}

/**
 * Ranking factors for composite score calculation
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export interface RankingFactors {
  tierWeight: number;      // Premium: 1.0, Basic: 0.6, Free: 0.3
  ratingScore: number;     // Normalized 0-1
  distanceScore: number;   // Inverse distance, 0-1
  activityBonus: number;   // 0.1 if logged in past 7 days
  completionRate: number;  // completed/accepted, 0-1
  responseTime: number;    // Normalized inverse response time, 0-1
}

/**
 * User location for distance-based ranking
 */
export interface UserLocation {
  lat: number;
  lng: number;
}

/**
 * Extended worker profile with ranking score
 */
export interface RankedWorker extends WorkerProfile {
  compositeScore: number;
  rankingFactors?: RankingFactors;
}

/**
 * Worker statistics for ranking calculations
 */
export interface WorkerStats {
  completedBookings: number;
  acceptedBookings: number;
  averageResponseTimeMinutes: number;
  lastLoginAt: string | null;
}

/**
 * Result type for worker service operations
 */
export interface WorkerServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/** Resolved profile for public profile pages (worker listing or basic customer account). */
export type ResolvedPublicProfile =
  | { kind: 'worker'; profile: DBWorkerWithProfile }
  | { kind: 'customer'; profile: Profile };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Worker Service interface
 */
export interface WorkerService {
  createProfile(userId: string, profile: WorkerProfileInput): Promise<WorkerServiceResult<WorkerProfile>>;
  updateProfile(profileId: string, updates: Partial<WorkerProfileInput>): Promise<WorkerServiceResult<WorkerProfile>>;
  getProfile(profileId: string): Promise<WorkerServiceResult<WorkerProfile>>;
  getProfileByUserId(userId: string): Promise<WorkerServiceResult<DBWorkerWithProfile>>;
  searchProfiles(filters: WorkerSearchFilters): Promise<WorkerServiceResult<WorkerProfile[]>>;
  searchWorkersRanked(filters: WorkerSearchFilters, userLocation?: UserLocation): Promise<WorkerServiceResult<RankedWorker[]>>;
  calculateCompositeScore(worker: WorkerProfile, factors: RankingFactors): number;
  getCategories(): Promise<WorkerServiceResult<ServiceCategory[]>>;
  getProfileByUsername(username: string): Promise<WorkerServiceResult<DBWorkerWithProfile>>;
  getPortfolioItems(workerId: string): Promise<WorkerServiceResult<WorkerPortfolio[]>>;
  createPortfolioItem(workerId: string, item: { title: string; description?: string; media_urls?: string[] }): Promise<WorkerServiceResult<WorkerPortfolio>>;
  deletePortfolioItem(itemId: string): Promise<WorkerServiceResult<boolean>>;
  getEndorsements(workerId: string): Promise<WorkerServiceResult<WorkerEndorsement[]>>;
  createEndorsement(referrerId: string, refereeId: string, text?: string): Promise<WorkerServiceResult<WorkerEndorsement>>;
}

/**
 * Fetch all active service categories from the database
 */
export async function getCategories(): Promise<WorkerServiceResult<ServiceCategory[]>> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data || [],
    error: null,
  };
}


/**
 * Create a new worker profile
 * Inserts profile data into the worker_profiles table
 * Requirements: 1.4
 */
export async function createProfile(
  userId: string,
  profile: WorkerProfileInput
): Promise<WorkerServiceResult<WorkerProfile>> {
  const transaction = startTransaction('worker.createProfile', 'db');
  
  try {
    const insertData: WorkerProfileInsert = {
      user_id: userId,
      name: profile.name,
      role: profile.role,
      location: profile.location,
      country: profile.country,
      bio: profile.bio ?? null,
      hourly_rate_min: profile.hourlyRate?.min ?? null,
      hourly_rate_max: profile.hourlyRate?.max ?? null,
      currency: profile.hourlyRate?.currency ?? null,
      skills: profile.skills ?? [],
      experience_years: profile.experienceYears ?? null,
      location_lat: profile.locationLat ?? null,
      location_lng: profile.locationLng ?? null,
    };

    const { data, error } = await supabase
      .from('worker_profiles')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createProfile' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as WorkerProfile,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Update an existing worker profile
 * Updates profile data in the worker_profiles table
 * Requirements: 1.4
 */
export async function updateProfile(
  profileId: string,
  updates: Partial<WorkerProfileInput>
): Promise<WorkerServiceResult<WorkerProfile>> {
  const transaction = startTransaction('worker.updateProfile', 'db');
  
  try {
    const updateData: WorkerProfileUpdate = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.country !== undefined) updateData.country = updates.country;
    if (updates.bio !== undefined) updateData.bio = updates.bio;
    if (updates.skills !== undefined) updateData.skills = updates.skills;
    if (updates.experienceYears !== undefined) updateData.experience_years = updates.experienceYears;
    if (updates.locationLat !== undefined) updateData.location_lat = updates.locationLat;
    if (updates.locationLng !== undefined) updateData.location_lng = updates.locationLng;
    
    if (updates.hourlyRate !== undefined) {
      updateData.hourly_rate_min = updates.hourlyRate.min;
      updateData.hourly_rate_max = updates.hourlyRate.max;
      updateData.currency = updates.hourlyRate.currency;
    }

    const { data, error } = await supabase
      .from('worker_profiles')
      .update(updateData)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'updateProfile' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as WorkerProfile,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Extended database worker profile with profile fields
 */
export interface DBWorkerWithProfile extends WorkerProfile {
  profiles?: {
    avatar_url: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  };
}

/**
 * Get a worker profile by ID
 * Retrieves profile data from the worker_profiles table
 * Requirements: 1.4
 */
export async function getProfile(
  profileId: string
): Promise<WorkerServiceResult<DBWorkerWithProfile>> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('*, profiles(avatar_url, username, first_name, last_name, role)')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return {
    data: data as DBWorkerWithProfile,
    error: null,
  };
}

/**
 * Get a worker profile by auth user ID (profiles.id / worker_profiles.user_id)
 */
export async function getProfileByUserId(
  userId: string
): Promise<WorkerServiceResult<DBWorkerWithProfile>> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('*, profiles(avatar_url, username, first_name, last_name, role)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return {
    data: data as DBWorkerWithProfile,
    error: null,
  };
}

/**
 * Resolve a worker profile by worker profile ID or user ID
 */
export async function resolveWorkerProfile(
  identifier: string
): Promise<WorkerServiceResult<DBWorkerWithProfile>> {
  const byId = await getProfile(identifier);
  if (byId.data) {
    return byId;
  }

  const byUserId = await getProfileByUserId(identifier);
  if (byUserId.data) {
    return byUserId;
  }

  if (byUserId.error) {
    return byUserId;
  }
  if (byId.error) {
    return byId;
  }

  return { data: null, error: null };
}

/**
 * Resolve any public profile: worker listing, or basic customer account when no worker_profiles row exists.
 */
export async function resolvePublicProfile(
  identifier: string
): Promise<WorkerServiceResult<ResolvedPublicProfile>> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { data: null, error: null };
  }

  if (!UUID_RE.test(trimmed)) {
    const byUsername = await getProfileByUsername(trimmed);
    if (byUsername.data) {
      return { data: { kind: 'worker', profile: byUsername.data }, error: null };
    }
    if (byUsername.error && byUsername.error.code !== ERROR_CODES.NOT_FOUND) {
      return { data: null, error: byUsername.error };
    }
  }

  const workerResult = await resolveWorkerProfile(trimmed);
  if (workerResult.data) {
    return { data: { kind: 'worker', profile: workerResult.data }, error: null };
  }
  if (workerResult.error) {
    return { data: null, error: workerResult.error };
  }

  const { data: basicProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', trimmed)
    .maybeSingle();

  if (profileError) {
    return {
      data: null,
      error: handleDatabaseError(profileError),
    };
  }

  if (basicProfile) {
    return {
      data: { kind: 'customer', profile: basicProfile as Profile },
      error: null,
    };
  }

  return { data: null, error: null };
}

/**
 * Search worker profiles with filtering support
 * Retrieves profiles from Supabase with support for filtering by location, skills, and rating
 * Requirements: 1.5
 */
export async function searchProfiles(
  filters: WorkerSearchFilters
): Promise<WorkerServiceResult<DBWorkerWithProfile[]>> {
  const transaction = startTransaction('worker.searchProfiles', 'db');
  
  try {
    let query = supabase.from('worker_profiles').select('*, profiles(avatar_url)');

    // Apply location filter (case-insensitive partial match)
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    // Apply country filter (exact match)
    if (filters.country) {
      query = query.eq('country', filters.country);
    }

    // Apply minimum rating filter
    if (filters.minRating !== undefined) {
      query = query.gte('rating', filters.minRating);
    }

    // Apply maximum hourly rate filter
    if (filters.maxHourlyRate !== undefined) {
      query = query.lte('hourly_rate_max', filters.maxHourlyRate);
    }

    // Apply skills filter (profiles must contain all specified skills)
    if (filters.skills && filters.skills.length > 0) {
      query = query.contains('skills', filters.skills);
    }

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'searchProfiles' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data as DBWorkerWithProfile[]) || [],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Tier weight mapping for composite score calculation
 * Requirements: 8.1
 */
export const TIER_WEIGHTS: Record<WorkerTier, number> = {
  premium: 1.0,
  basic: 0.6,
  free: 0.3,
};

/**
 * Weights for each ranking factor in the composite score
 * These can be tuned based on business requirements
 */
const RANKING_WEIGHTS = {
  tier: 0.25,
  rating: 0.25,
  distance: 0.15,
  activity: 0.10,
  completionRate: 0.15,
  responseTime: 0.10,
};

/**
 * Calculate the tier weight for a worker
 * Requirements: 8.1
 */
export function getTierWeight(tier: WorkerTier): number {
  return TIER_WEIGHTS[tier] ?? TIER_WEIGHTS.free;
}

/**
 * Normalize rating to 0-1 scale
 * Requirements: 8.2
 */
export function normalizeRating(rating: number): number {
  // Rating is on a 0-5 scale, normalize to 0-1
  return Math.max(0, Math.min(1, rating / 5));
}

/**
 * Calculate inverse distance score (closer = higher score)
 * Requirements: 8.3
 */
export function calculateDistanceScore(
  workerLat: number | null,
  workerLng: number | null,
  userLocation?: UserLocation
): number {
  // If no user location or worker location, return neutral score
  if (!userLocation || workerLat === null || workerLng === null) {
    return 0.5; // Neutral score when distance can't be calculated
  }

  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(userLocation.lat - workerLat);
  const dLng = toRadians(userLocation.lng - workerLng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(workerLat)) * Math.cos(toRadians(userLocation.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  // Convert distance to inverse score (0-1)
  // Using exponential decay: closer workers get higher scores
  // At 0km = 1.0, at 50km ≈ 0.37, at 100km ≈ 0.14
  const maxDistance = 100; // km - beyond this, score approaches 0
  return Math.exp(-distance / maxDistance);
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate activity bonus for recent logins
 * Requirements: 8.4
 */
export function calculateActivityBonus(lastLoginAt: string | null): number {
  if (!lastLoginAt) {
    return 0;
  }

  const lastLogin = new Date(lastLoginAt);
  const now = new Date();
  const daysSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);

  // 0.1 bonus if logged in within past 7 days
  return daysSinceLogin <= 7 ? 0.1 : 0;
}

/**
 * Calculate completion rate from booking statistics
 * Requirements: 8.5
 */
export function calculateCompletionRate(
  completedBookings: number,
  acceptedBookings: number
): number {
  if (acceptedBookings === 0) {
    return 0.5; // Neutral score for new workers with no bookings
  }
  return Math.min(1, completedBookings / acceptedBookings);
}

/**
 * Calculate response time factor (faster = higher score)
 * Requirements: 8.6
 */
export function calculateResponseTimeFactor(averageResponseTimeMinutes: number): number {
  if (averageResponseTimeMinutes <= 0) {
    return 0.5; // Neutral score for workers with no response data
  }

  // Normalize: 0-15 min = 1.0, 60 min = 0.5, 120+ min approaches 0
  // Using inverse relationship with diminishing returns
  const maxResponseTime = 120; // minutes
  const normalizedTime = Math.min(averageResponseTimeMinutes, maxResponseTime);
  return 1 - (normalizedTime / maxResponseTime);
}

/**
 * Calculate composite score for a worker
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export function calculateCompositeScore(
  worker: WorkerProfile,
  factors: RankingFactors
): number {
  const score = 
    (factors.tierWeight * RANKING_WEIGHTS.tier) +
    (factors.ratingScore * RANKING_WEIGHTS.rating) +
    (factors.distanceScore * RANKING_WEIGHTS.distance) +
    (factors.activityBonus * RANKING_WEIGHTS.activity) +
    (factors.completionRate * RANKING_WEIGHTS.completionRate) +
    (factors.responseTime * RANKING_WEIGHTS.responseTime);

  // Normalize to 0-1 range (max possible is 1.0 + 0.1 activity bonus = 1.1)
  return Math.min(1, Math.max(0, score));
}

/**
 * Booking statuses that count as worker-accepted for completion rate
 */
const ACCEPTED_BOOKING_STATUSES = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED'] as const;
const COMPLETED_BOOKING_STATUSES = ['COMPLETED', 'REVIEWED'] as const;

interface BookingStatsRow {
  worker_user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Aggregate booking stats per worker user id from raw booking rows
 */
export function aggregateBookingStats(
  bookings: BookingStatsRow[]
): Map<string, { completed: number; accepted: number; responseTimesMinutes: number[] }> {
  const stats = new Map<string, { completed: number; accepted: number; responseTimesMinutes: number[] }>();

  for (const booking of bookings) {
    if (!stats.has(booking.worker_user_id)) {
      stats.set(booking.worker_user_id, { completed: 0, accepted: 0, responseTimesMinutes: [] });
    }
    const entry = stats.get(booking.worker_user_id)!;

    if (COMPLETED_BOOKING_STATUSES.includes(booking.status as typeof COMPLETED_BOOKING_STATUSES[number])) {
      entry.completed++;
    }

    if (ACCEPTED_BOOKING_STATUSES.includes(booking.status as typeof ACCEPTED_BOOKING_STATUSES[number])) {
      entry.accepted++;
      const createdMs = new Date(booking.created_at).getTime();
      const updatedMs = new Date(booking.updated_at).getTime();
      if (updatedMs > createdMs) {
        entry.responseTimesMinutes.push((updatedMs - createdMs) / (1000 * 60));
      }
    }
  }

  return stats;
}

/**
 * Fetch booking-based stats and profile activity for ranked search
 */
export async function fetchWorkerStatsForRanking(
  workers: WorkerProfile[]
): Promise<Map<string, WorkerStats>> {
  const statsMap = new Map<string, WorkerStats>();
  const userIds = workers.map((w) => w.user_id);

  for (const worker of workers) {
    statsMap.set(worker.user_id, {
      completedBookings: 0,
      acceptedBookings: 0,
      averageResponseTimeMinutes: 0,
      lastLoginAt: worker.updated_at,
    });
  }

  if (userIds.length === 0) {
    return statsMap;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('worker_user_id, status, created_at, updated_at')
    .in('worker_user_id', userIds);

  if (!bookingsError && bookings) {
    const aggregated = aggregateBookingStats(bookings as BookingStatsRow[]);
    for (const [userId, agg] of aggregated) {
      const existing = statsMap.get(userId);
      if (!existing) continue;
      existing.completedBookings = agg.completed;
      existing.acceptedBookings = agg.accepted;
      if (agg.responseTimesMinutes.length > 0) {
        existing.averageResponseTimeMinutes =
          agg.responseTimesMinutes.reduce((sum, t) => sum + t, 0) / agg.responseTimesMinutes.length;
      }
    }
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, updated_at')
    .in('id', userIds);

  if (!profilesError && profiles) {
    for (const profile of profiles) {
      const existing = statsMap.get(profile.id);
      if (existing) {
        existing.lastLoginAt = profile.updated_at;
      }
    }
  }

  return statsMap;
}

/**
 * Build ranking factors for a worker
 */
export function buildRankingFactors(
  worker: WorkerProfile,
  stats: WorkerStats,
  userLocation?: UserLocation,
  workerCoordinates?: { lat: number; lng: number }
): RankingFactors {
  const coords =
    workerCoordinates ??
    (worker.location_lat != null && worker.location_lng != null
      ? { lat: worker.location_lat, lng: worker.location_lng }
      : undefined);

  return {
    tierWeight: getTierWeight(worker.tier),
    ratingScore: normalizeRating(worker.rating),
    distanceScore: calculateDistanceScore(
      coords?.lat ?? null,
      coords?.lng ?? null,
      userLocation
    ),
    activityBonus: calculateActivityBonus(stats.lastLoginAt),
    completionRate: calculateCompletionRate(stats.completedBookings, stats.acceptedBookings),
    responseTime: calculateResponseTimeFactor(stats.averageResponseTimeMinutes),
  };
}

/**
 * Search workers with ranking and sorting by composite score
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
export async function searchWorkersRanked(
  filters: WorkerSearchFilters,
  userLocation?: UserLocation
): Promise<WorkerServiceResult<RankedWorker[]>> {
  const transaction = startTransaction('worker.searchWorkersRanked', 'db');
  
  try {
    // First, get filtered workers using existing search
    const searchResult = await searchProfiles(filters);
    
    if (searchResult.error) {
      return {
        data: null,
        error: searchResult.error,
      };
    }

    if (!searchResult.data || searchResult.data.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const statsByUserId = await fetchWorkerStatsForRanking(searchResult.data);

    const rankedWorkers: RankedWorker[] = searchResult.data.map((worker) => {
      const stats = statsByUserId.get(worker.user_id) ?? {
        completedBookings: 0,
        acceptedBookings: 0,
        averageResponseTimeMinutes: 0,
        lastLoginAt: worker.updated_at,
      };

      const factors = buildRankingFactors(worker, stats, userLocation);
      const compositeScore = calculateCompositeScore(worker, factors);

      return {
        ...worker,
        compositeScore,
        rankingFactors: factors,
      };
    });

    // Sort by composite score in descending order
    // Requirements: 8.7
    rankedWorkers.sort((a, b) => b.compositeScore - a.compositeScore);

    return {
      data: rankedWorkers,
      error: null,
    };
  } catch (error) {
    captureError(error as Error, { tags: { operation: 'searchWorkersRanked' } });
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get a worker profile by username (custom slug)
 */
export async function getProfileByUsername(
  username: string
): Promise<WorkerServiceResult<DBWorkerWithProfile>> {
  const cleanUsername = username.startsWith('@') ? username : `@${username}`;
  
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (profileError) {
    return {
      data: null,
      error: handleDatabaseError(profileError),
    };
  }

  if (!profileData) {
    return { data: null, error: null };
  }

  return getProfileByUserId(profileData.id);
}

/**
 * Fetch portfolio items for a worker
 */
export async function getPortfolioItems(
  workerId: string
): Promise<WorkerServiceResult<WorkerPortfolio[]>> {
  const { data, error } = await supabase
    .from('worker_portfolios')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data || [],
    error: null,
  };
}

/**
 * Add a new portfolio item
 */
export async function createPortfolioItem(
  workerId: string,
  item: { title: string; description?: string; media_urls?: string[] }
): Promise<WorkerServiceResult<WorkerPortfolio>> {
  const { data, error } = await supabase
    .from('worker_portfolios')
    .insert({
      worker_id: workerId,
      title: item.title,
      description: item.description || null,
      media_urls: item.media_urls || [],
    })
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data,
    error: null,
  };
}

/**
 * Delete a portfolio item
 */
export async function deletePortfolioItem(
  itemId: string
): Promise<WorkerServiceResult<boolean>> {
  const { error } = await supabase
    .from('worker_portfolios')
    .delete()
    .eq('id', itemId);

  if (error) {
    return {
      data: false,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: true,
    error: null,
  };
}

/**
 * Fetch peer endorsements for a worker
 */
export async function getEndorsements(
  workerId: string
): Promise<WorkerServiceResult<WorkerEndorsement[]>> {
  const { data, error } = await supabase
    .from('worker_endorsements')
    .select('*, profiles!worker_endorsements_referrer_id_fkey(first_name, last_name, username, avatar_url, role)')
    .eq('referee_id', workerId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data || [],
    error: null,
  };
}

/**
 * Endorse another worker
 */
export async function createEndorsement(
  referrerId: string,
  refereeId: string,
  text?: string
): Promise<WorkerServiceResult<WorkerEndorsement>> {
  const { data, error } = await supabase
    .from('worker_endorsements')
    .insert({
      referrer_id: referrerId,
      referee_id: refereeId,
      endorsement_text: text || null,
    })
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data,
    error: null,
  };
}

// Export as a service object for compatibility with existing code patterns
export const workerService: WorkerService = {
  createProfile,
  updateProfile,
  getProfile,
  getProfileByUserId,
  searchProfiles,
  searchWorkersRanked,
  calculateCompositeScore,
  getCategories,
  getProfileByUsername,
  getPortfolioItems,
  createPortfolioItem,
  deletePortfolioItem,
  getEndorsements,
  createEndorsement,
};

export default workerService;
