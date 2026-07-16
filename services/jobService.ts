/**
 * Job Service
 * Manages job postings for the BlueCollar marketplace
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { supabase } from './supabase';
import type {
  Job,
  JobInsert,
  JobUpdate,
  JobStatus,
  Country,
  Currency,
} from '../types/database';
import { handleDatabaseError, DatabaseError, ERROR_CODES } from './databaseErrors';
import { startTransaction, captureError } from './monitoringService';

/**
 * Job input data for creating a new job
 */
export interface JobInput {
  title: string;
  description?: string | null;
  category: string;
  location: string;
  location_lat?: number | null;
  location_lng?: number | null;
  country: Country;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: Currency | null;
  media_urls?: string[] | null;
  scheduled_at?: string | null;
}

/**
 * Search filters for job queries
 */
export interface JobSearchFilters {
  category?: string;
  location?: string;
  country?: Country;
  budgetMin?: number;
  budgetMax?: number;
  status?: JobStatus;
}

/**
 * Result type for job service operations
 */
export interface JobServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}


/**
 * Create a new job posting
 * Creates job with status 'open' and stores all job details
 * Requirements: 3.1
 */
export async function createJob(
  posterId: string,
  jobData: JobInput
): Promise<JobServiceResult<Job>> {
  const transaction = startTransaction('job.create', 'db');

  try {
    // Validate required fields
    if (!jobData.title || !jobData.category || !jobData.location || !jobData.country) {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Missing required fields: title, category, location, and country are required',
        },
      };
    }

    // Validate country
    if (!['GH', 'NG'].includes(jobData.country)) {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid country code. Must be GH or NG',
        },
      };
    }

    // Marketplace model: only customers (and admins) post projects; workers apply
    const { data: posterProfile, error: roleError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', posterId)
      .maybeSingle();

    if (roleError) {
      captureError(new Error(roleError.message), { tags: { operation: 'createJob.roleCheck' } });
      return {
        data: null,
        error: handleDatabaseError(roleError),
      };
    }

    if (posterProfile?.role === 'worker') {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message:
            'Workers cannot post projects. Browse available projects to apply, or update your profile to grow your reach.',
        },
      };
    }

    const insertData: JobInsert = {
      poster_user_id: posterId,
      title: jobData.title,
      description: jobData.description ?? null,
      category: jobData.category,
      location: jobData.location,
      location_lat: jobData.location_lat ?? null,
      location_lng: jobData.location_lng ?? null,
      country: jobData.country,
      budget_min: jobData.budget_min ?? null,
      budget_max: jobData.budget_max ?? null,
      currency: jobData.currency ?? null,
      status: 'open',
      media_urls: jobData.media_urls ?? null,
      scheduled_at: jobData.scheduled_at ?? null,
    };

    const { data, error } = await supabase
      .from('jobs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'createJob' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Job,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Update an existing job
 * Updates specified fields and records update timestamp
 * Requirements: 3.2
 */
export async function updateJob(
  jobId: string,
  updates: Partial<JobInput>
): Promise<JobServiceResult<Job>> {
  const transaction = startTransaction('job.update', 'db');

  try {
    // Validate country if provided
    if (updates.country && !['GH', 'NG'].includes(updates.country)) {
      return {
        data: null,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid country code. Must be GH or NG',
        },
      };
    }

    const updateData: JobUpdate = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.location_lat !== undefined) updateData.location_lat = updates.location_lat;
    if (updates.location_lng !== undefined) updateData.location_lng = updates.location_lng;
    if (updates.country !== undefined) updateData.country = updates.country;
    if (updates.budget_min !== undefined) updateData.budget_min = updates.budget_min;
    if (updates.budget_max !== undefined) updateData.budget_max = updates.budget_max;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.scheduled_at !== undefined) updateData.scheduled_at = updates.scheduled_at;
    if (updates.media_urls !== undefined) updateData.media_urls = updates.media_urls;

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'updateJob' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Job,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Delete a job posting
 * Removes the job record from the database
 * Requirements: 3.3
 */
export async function deleteJob(
  jobId: string
): Promise<JobServiceResult<void>> {
  const transaction = startTransaction('job.delete', 'db');

  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'deleteJob' } });
      return {
        data: null,
        error: handleDatabaseError(error),
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
 * Get a job by ID
 * Returns job details including poster information
 * Requirements: 3.4
 */
export async function getJob(
  jobId: string
): Promise<JobServiceResult<Job>> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: data as Job,
    error: null,
  };
}


/**
 * Search jobs with filters
 * Returns jobs matching category, location, and budget criteria
 * Requirements: 3.5
 */
export async function searchJobs(
  filters: JobSearchFilters
): Promise<JobServiceResult<Job[]>> {
  const transaction = startTransaction('job.search', 'db');

  try {
    let query = supabase.from('jobs').select('*');

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }

    if (filters.country) {
      query = query.eq('country', filters.country);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      // Default to open jobs only
      query = query.eq('status', 'open');
    }

    if (filters.budgetMin !== undefined) {
      query = query.gte('budget_max', filters.budgetMin);
    }

    if (filters.budgetMax !== undefined) {
      query = query.lte('budget_min', filters.budgetMax);
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'searchJobs' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: (data || []) as Job[],
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Get all jobs posted by a specific user
 * Returns all jobs where poster_user_id matches the given ID
 * Requirements: 3.6
 */
export async function getJobsByPoster(
  userId: string
): Promise<JobServiceResult<Job[]>> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('poster_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      data: null,
      error: handleDatabaseError(error),
    };
  }

  return {
    data: (data || []) as Job[],
    error: null,
  };
}

/**
 * Update job status
 * Helper function to update job status (open, filled, cancelled)
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<JobServiceResult<Job>> {
  const transaction = startTransaction('job.updateStatus', 'db');

  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'updateJobStatus' } });
      return {
        data: null,
        error: handleDatabaseError(error),
      };
    }

    return {
      data: data as Job,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Job Service interface
 */
export interface JobService {
  createJob(posterId: string, jobData: JobInput): Promise<JobServiceResult<Job>>;
  updateJob(jobId: string, updates: Partial<JobInput>): Promise<JobServiceResult<Job>>;
  deleteJob(jobId: string): Promise<JobServiceResult<void>>;
  getJob(jobId: string): Promise<JobServiceResult<Job>>;
  searchJobs(filters: JobSearchFilters): Promise<JobServiceResult<Job[]>>;
  getJobsByPoster(userId: string): Promise<JobServiceResult<Job[]>>;
  updateJobStatus(jobId: string, status: JobStatus): Promise<JobServiceResult<Job>>;
}

// Export as a service object for compatibility with existing code patterns
export const jobService: JobService = {
  createJob,
  updateJob,
  deleteJob,
  getJob,
  searchJobs,
  getJobsByPoster,
  updateJobStatus,
};

export default jobService;
