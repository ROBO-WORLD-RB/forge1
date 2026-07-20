/**
 * Admin Service — M6 admin profile search helpers
 */

import { supabase } from './supabase';
import { handleDatabaseError, DatabaseError } from './databaseErrors';

export interface AdminServiceResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface AdminProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  country: string | null;
  verified: boolean;
  worker_status: string | null;
  created_at: string;
  email: string | null;
}

/** Admin: search profiles by name / username / phone / email. */
export async function searchProfilesAdmin(
  query?: string,
  limit = 50
): Promise<AdminServiceResult<AdminProfileRow[]>> {
  try {
    const { data, error } = await (supabase.rpc as any)('admin_search_profiles', {
      p_query: query?.trim() || null,
      p_limit: limit,
    });

    if (error) {
      return { data: null, error: handleDatabaseError(error) };
    }

    return { data: (data || []) as AdminProfileRow[], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: handleDatabaseError(err) || { code: 'DB_002' as any, message: err?.message || 'Failed' },
    };
  }
}
