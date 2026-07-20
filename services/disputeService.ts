/**
 * Dispute Service — M6 booking disputes MVP
 */

import { supabase } from './supabase';
import type { Dispute, DisputeStatus, BookingStatus } from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { captureError, startTransaction } from './monitoringService';

export interface DisputeServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface DisputeWithMeta extends Dispute {
  booking_status?: BookingStatus | null;
  opener_name?: string | null;
}

const DISPUTABLE: BookingStatus[] = ['IN_PROGRESS', 'COMPLETED', 'REVIEWED'];

export function canOpenDispute(status: BookingStatus): boolean {
  return DISPUTABLE.includes(status);
}

/** Open a dispute on a booking (customer or worker party). */
export async function openDispute(
  bookingId: string,
  openerId: string,
  reason: string
): Promise<DisputeServiceResult<Dispute>> {
  const transaction = startTransaction('dispute.open', 'db');

  try {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      return {
        data: null,
        error: { code: 'DB_007' as any, message: 'Please describe the issue (at least 10 characters).' },
      };
    }

    const { data, error } = await (supabase.from('disputes') as any)
      .insert({
        booking_id: bookingId,
        opener_id: openerId,
        reason: trimmed,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          data: null,
          error: { code: 'DB_007' as any, message: 'An open dispute already exists for this booking.' },
        };
      }
      captureError(new Error(error.message), { tags: { operation: 'openDispute' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as Dispute, error: null };
  } finally {
    transaction.finish();
  }
}

/** Disputes for bookings the user is party to. */
export async function getDisputesForUser(
  userId: string
): Promise<DisputeServiceResult<Dispute[]>> {
  try {
    const { data: bookings, error: bErr } = await (supabase.from('bookings') as any)
      .select('id')
      .or(`customer_user_id.eq.${userId},worker_user_id.eq.${userId}`);

    if (bErr) {
      return { data: null, error: handleDatabaseError(bErr) };
    }

    const ids = (bookings || []).map((b: { id: string }) => b.id);
    if (ids.length === 0) return { data: [], error: null };

    const { data, error } = await (supabase.from('disputes') as any)
      .select('*')
      .in('booking_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as Dispute[], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || { code: 'DB_002' as any, message: err?.message || 'Failed' },
    };
  }
}

/** Open dispute for a specific booking, if any. */
export async function getOpenDisputeForBooking(
  bookingId: string
): Promise<DisputeServiceResult<Dispute | null>> {
  try {
    const { data, error } = await (supabase.from('disputes') as any)
      .select('*')
      .eq('booking_id', bookingId)
      .eq('status', 'open')
      .maybeSingle();

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data as Dispute) || null, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || { code: 'DB_002' as any, message: err?.message || 'Failed' },
    };
  }
}

/** Admin: list disputes, newest first. */
export async function listDisputesAdmin(
  statusFilter?: DisputeStatus | 'all'
): Promise<DisputeServiceResult<DisputeWithMeta[]>> {
  const transaction = startTransaction('dispute.adminList', 'db');

  try {
    let query = (supabase.from('disputes') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'listDisputesAdmin' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    const disputes = (data || []) as Dispute[];
    if (disputes.length === 0) return { data: [], error: null };

    const bookingIds = [...new Set(disputes.map((d) => d.booking_id))];
    const openerIds = [...new Set(disputes.map((d) => d.opener_id))];

    const [{ data: bookings }, { data: profiles }] = await Promise.all([
      (supabase.from('bookings') as any).select('id, status').in('id', bookingIds),
      (supabase.from('profiles') as any)
        .select('id, first_name, last_name, username')
        .in('id', openerIds),
    ]);

    const bookingMap = new Map<string, BookingStatus>();
    for (const b of bookings || []) bookingMap.set(b.id, b.status);

    const nameMap = new Map<string, string>();
    for (const p of profiles || []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || p.id.slice(0, 8);
      nameMap.set(p.id, name);
    }

    const enriched: DisputeWithMeta[] = disputes.map((d) => ({
      ...d,
      booking_status: bookingMap.get(d.booking_id) || null,
      opener_name: nameMap.get(d.opener_id) || null,
    }));

    return { data: enriched, error: null };
  } finally {
    transaction.finish();
  }
}

/** Admin: resolve or close a dispute. */
export async function resolveDispute(
  disputeId: string,
  status: 'resolved' | 'closed',
  notes?: string
): Promise<DisputeServiceResult<Dispute>> {
  const transaction = startTransaction('dispute.resolve', 'db');

  try {
    const { data, error } = await (supabase.rpc as any)('admin_resolve_dispute', {
      p_dispute_id: disputeId,
      p_status: status,
      p_notes: notes ?? null,
    });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'resolveDispute' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as Dispute, error: null };
  } finally {
    transaction.finish();
  }
}
