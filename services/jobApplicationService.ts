/**
 * Job Application Service — Worker OS outbound applications (M3)
 *
 * Creates a first-class job_applications row and dual-writes a PENDING booking
 * so the existing Bookings FSM / customer review path keeps working.
 */

import { supabase } from './supabase';
import { createBooking } from './bookingService';
import type {
  Job,
  JobApplication,
  JobApplicationInsert,
  JobApplicationStatus,
  JobApplicationWithJob,
  Booking,
} from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { captureError, startTransaction } from './monitoringService';

export interface JobApplicationServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface ApplyToJobResult {
  application: JobApplication;
  booking: Booking | null;
}

/**
 * Apply to an open job. Idempotent when the worker already applied.
 */
export async function applyToJob(
  jobId: string,
  workerUserId: string,
  message?: string
): Promise<JobApplicationServiceResult<ApplyToJobResult>> {
  const transaction = startTransaction('jobApplication.apply', 'db');

  try {
    const existing = await getApplicationForJob(jobId, workerUserId);
    if (existing.error) {
      return { data: null, error: existing.error };
    }
    if (existing.data) {
      return {
        data: { application: existing.data, booking: null },
        error: null,
      };
    }

    const insertData: JobApplicationInsert = {
      job_id: jobId,
      worker_user_id: workerUserId,
      message: message?.trim() || null,
      status: 'pending',
    };

    const { data: created, error: insertError } = await (supabase
      .from('job_applications') as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const again = await getApplicationForJob(jobId, workerUserId);
        if (again.data) {
          return { data: { application: again.data, booking: null }, error: null };
        }
      }
      captureError(new Error(insertError.message), { tags: { operation: 'applyToJob' } });
      return { data: null, error: handleDatabaseError(insertError) };
    }

    let application = created as JobApplication;
    let booking: Booking | null = null;

    // Dual-write booking so customer Bookings / FSM remain the delivery path
    const bookingResult = await createBooking(jobId, workerUserId, message);
    if (bookingResult.data) {
      booking = bookingResult.data;
      const { data: linked } = await (supabase.from('job_applications') as any)
        .update({ booking_id: booking.id })
        .eq('id', application.id)
        .select()
        .single();
      if (linked) application = linked as JobApplication;
    } else if (bookingResult.error) {
      // Application stands; booking may already exist from a prior path
      console.warn('applyToJob: booking dual-write failed', bookingResult.error.message);
    }

    return { data: { application, booking }, error: null };
  } finally {
    transaction.finish();
  }
}

export async function getApplicationForJob(
  jobId: string,
  workerUserId: string
): Promise<JobApplicationServiceResult<JobApplication | null>> {
  try {
    const { data, error } = await (supabase.from('job_applications') as any)
      .select('*')
      .eq('job_id', jobId)
      .eq('worker_user_id', workerUserId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data as JobApplication) || null, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || {
        code: 'DB_002' as any,
        message: err?.message || 'Failed to load application',
      },
    };
  }
}

/** Worker's applications, newest first, with job row when available. */
export async function getApplicationsByWorker(
  workerUserId: string
): Promise<JobApplicationServiceResult<JobApplicationWithJob[]>> {
  const transaction = startTransaction('jobApplication.listByWorker', 'db');

  try {
    const { data, error } = await (supabase.from('job_applications') as any)
      .select('*')
      .eq('worker_user_id', workerUserId)
      .order('created_at', { ascending: false });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getApplicationsByWorker' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    const apps = (data || []) as JobApplication[];
    if (apps.length === 0) {
      return { data: [], error: null };
    }

    const jobIds = [...new Set(apps.map((a) => a.job_id))];
    const { data: jobs } = await (supabase.from('jobs') as any)
      .select('*')
      .in('id', jobIds);

    const byId = new Map<string, Job>();
    for (const j of jobs || []) {
      byId.set(j.id, j as Job);
    }

    const enriched: JobApplicationWithJob[] = apps.map((a) => ({
      ...a,
      job: byId.get(a.job_id) || null,
    }));

    return { data: enriched, error: null };
  } finally {
    transaction.finish();
  }
}

/** Pending (and all) applications for a job — for posters. */
export async function getApplicationsByJob(
  jobId: string,
  status?: JobApplicationStatus
): Promise<JobApplicationServiceResult<JobApplication[]>> {
  try {
    let query = (supabase.from('job_applications') as any)
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as JobApplication[], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || {
        code: 'DB_002' as any,
        message: err?.message || 'Failed to load applications',
      },
    };
  }
}

export async function withdrawApplication(
  applicationId: string,
  workerUserId: string
): Promise<JobApplicationServiceResult<JobApplication>> {
  const transaction = startTransaction('jobApplication.withdraw', 'db');

  try {
    const { data, error } = await (supabase.from('job_applications') as any)
      .update({ status: 'withdrawn' })
      .eq('id', applicationId)
      .eq('worker_user_id', workerUserId)
      .select()
      .single();

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'withdrawApplication' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as JobApplication, error: null };
  } finally {
    transaction.finish();
  }
}

/** Score open jobs for a worker by skills / role / country (no AI). */
export function rankJobsForWorker(
  jobs: Job[],
  opts: {
    skills?: string[];
    role?: string;
    country?: string | null;
    location?: string | null;
  }
): Array<Job & { matchScore: number; matchReason: string }> {
  const skills = (opts.skills || []).map((s) => s.toLowerCase());
  const role = (opts.role || '').toLowerCase();
  const country = opts.country || null;
  const location = (opts.location || '').toLowerCase();

  return jobs
    .map((job) => {
      let score = 0;
      const reasons: string[] = [];
      const cat = (job.category || '').toLowerCase();

      if (cat && skills.some((s) => s === cat || s.includes(cat) || cat.includes(s))) {
        score += 3;
        reasons.push('Matches your skills');
      } else if (cat && role && (role.includes(cat) || cat.includes(role))) {
        score += 2;
        reasons.push('Matches your trade');
      }

      if (country && job.country === country) {
        score += 1;
        reasons.push('Same country');
      }

      if (
        location &&
        job.location &&
        (job.location.toLowerCase().includes(location) ||
          location.includes(job.location.toLowerCase()))
      ) {
        score += 1;
        reasons.push('Nearby location');
      }

      return {
        ...job,
        matchScore: score,
        matchReason: reasons[0] || 'Open project',
      };
    })
    .filter((j) => j.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || b.created_at.localeCompare(a.created_at));
}
