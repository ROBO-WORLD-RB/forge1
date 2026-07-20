/**
 * Analytics Service — M6 server-side event logging
 * Primary store: analytics_events. localStorage kept as offline buffer only.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { AnalyticsEventRow } from '../types/database';

export interface LogEventInput {
  eventName: string;
  properties?: Record<string, unknown>;
  sessionId?: string | null;
  pagePath?: string | null;
  userId?: string | null;
}

export interface AnalyticsServiceResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Persist a product analytics event to Supabase (fire-and-forget friendly).
 * Does not throw — callers should void / ignore failures.
 */
export async function logEvent(
  input: LogEventInput
): Promise<AnalyticsServiceResult<AnalyticsEventRow>> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: { message: 'Supabase not configured' } };
  }

  try {
    let userId = input.userId ?? null;
    if (userId === undefined || userId === null) {
      try {
        const { data } = await supabase.auth.getUser();
        userId = data?.user?.id ?? null;
      } catch {
        userId = null;
      }
    }

    const row = {
      user_id: userId,
      event_name: input.eventName,
      properties: (input.properties || {}) as Record<string, unknown>,
      session_id: input.sessionId ?? null,
      page_path: input.pagePath ?? null,
    };

    const { data, error } = await (supabase.from('analytics_events') as any)
      .insert(row)
      .select()
      .single();

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    return { data: data as AnalyticsEventRow, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Failed to log event' } };
  }
}

/** Bookings created per day for the last N days (for hub sparkline). */
export async function getBookingTrend(
  userId: string,
  role: 'customer' | 'worker',
  days = 14
): Promise<AnalyticsServiceResult<{ date: string; count: number }[]>> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const col = role === 'worker' ? 'worker_user_id' : 'customer_user_id';
    const { data, error } = await (supabase.from('bookings') as any)
      .select('created_at')
      .eq(col, userId)
      .gte('created_at', since.toISOString());

    if (error) {
      return { data: null, error: { message: error.message } };
    }

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const row of data || []) {
      const key = String(row.created_at).slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
    }

    const trend = Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
    return { data: trend, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Failed to load booking trend' } };
  }
}
