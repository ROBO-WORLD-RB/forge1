import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseClientModule {
  client: SupabaseClient<Database>;
  initialize(): Promise<void>;
  getSession(): Promise<Session | null>;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn(
    'Supabase environment variables are not configured. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Use placeholder values when not configured to prevent crash during development
const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.co';
const effectiveKey = supabaseAnonKey || 'placeholder-key';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  effectiveUrl,
  effectiveKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Supabase OAuth uses PKCE (?code= in callback). Implicit flow rejects that URL.
      flowType: 'pkce',
    },
  }
);

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function initialize(): Promise<void> {
  // Verify connection by attempting to get session
  await getSession();
}

export default supabase;
