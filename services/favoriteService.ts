/**
 * Favorite Service — Customer OS saved workers (M2)
 */

import { supabase } from './supabase';
import type { Favorite, FavoriteWithWorker, WorkerProfile } from '../types/database';
import { handleDatabaseError, DatabaseError } from './databaseErrors';
import { captureError, startTransaction } from './monitoringService';
import { trackFavorite } from '../utils/analytics';

export interface FavoriteServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

/**
 * List favorites for a user, newest first, with worker profile when available.
 */
export async function getFavorites(
  userId: string
): Promise<FavoriteServiceResult<FavoriteWithWorker[]>> {
  const transaction = startTransaction('favorite.list', 'db');

  try {
    const { data, error } = await (supabase.from('favorites') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'getFavorites' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    const favorites = (data || []) as Favorite[];
    if (favorites.length === 0) {
      return { data: [], error: null };
    }

    const workerIds = favorites.map((f) => f.worker_user_id);
    const { data: workers } = await (supabase.from('worker_profiles') as any)
      .select('*, profiles:user_id(avatar_url, username, first_name, last_name)')
      .in('user_id', workerIds);

    const byUserId = new Map<string, WorkerProfile & { profiles?: unknown }>();
    for (const w of workers || []) {
      byUserId.set(w.user_id, w);
    }

    const enriched: FavoriteWithWorker[] = favorites.map((f) => ({
      ...f,
      worker: byUserId.get(f.worker_user_id) || null,
    }));

    return { data: enriched, error: null };
  } finally {
    transaction.finish();
  }
}

/** Returns whether the user has saved this worker. */
export async function isFavorite(
  userId: string,
  workerUserId: string
): Promise<FavoriteServiceResult<boolean>> {
  try {
    const { data, error } = await (supabase.from('favorites') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('worker_user_id', workerUserId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: !!data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || {
        code: 'DB_002' as any,
        message: err?.message || 'Failed to check favorite',
      },
    };
  }
}

/** Save a worker. Idempotent when unique constraint already exists. */
export async function addFavorite(
  userId: string,
  workerUserId: string
): Promise<FavoriteServiceResult<Favorite>> {
  const transaction = startTransaction('favorite.add', 'db');

  try {
    if (userId === workerUserId) {
      return {
        data: null,
        error: { code: 'DB_007' as any, message: 'You cannot favorite yourself' },
      };
    }

    const { data, error } = await (supabase.from('favorites') as any)
      .insert({ user_id: userId, worker_user_id: workerUserId })
      .select()
      .single();

    if (error) {
      // Unique violation → already favorited; return existing
      if (error.code === '23505') {
        const { data: existing } = await (supabase.from('favorites') as any)
          .select('*')
          .eq('user_id', userId)
          .eq('worker_user_id', workerUserId)
          .single();
        if (existing) {
          return { data: existing as Favorite, error: null };
        }
      }
      captureError(new Error(error.message), { tags: { operation: 'addFavorite' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: data as Favorite, error: null };
  } finally {
    transaction.finish();
  }
}

export async function removeFavorite(
  userId: string,
  workerUserId: string
): Promise<FavoriteServiceResult<boolean>> {
  const transaction = startTransaction('favorite.remove', 'db');

  try {
    const { error } = await (supabase.from('favorites') as any)
      .delete()
      .eq('user_id', userId)
      .eq('worker_user_id', workerUserId);

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'removeFavorite' } });
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: true, error: null };
  } finally {
    transaction.finish();
  }
}

export async function toggleFavorite(
  userId: string,
  workerUserId: string
): Promise<FavoriteServiceResult<{ favorited: boolean }>> {
  const current = await isFavorite(userId, workerUserId);
  if (current.error) {
    return { data: null, error: current.error };
  }

  if (current.data) {
    const removed = await removeFavorite(userId, workerUserId);
    if (removed.error) return { data: null, error: removed.error };
    trackFavorite(workerUserId, false);
    return { data: { favorited: false }, error: null };
  }

  const added = await addFavorite(userId, workerUserId);
  if (added.error) return { data: null, error: added.error };
  trackFavorite(workerUserId, true);
  return { data: { favorited: true }, error: null };
}
