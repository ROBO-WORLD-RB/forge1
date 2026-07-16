/**
 * Auth Service with Supabase Authentication
 * Implements signUp, signIn, signOut, getUser, and onAuthStateChange
 * Requirements: 1.2, 1.3
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { User as SupabaseUser, Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';
import type { Profile, UserRole } from '../types/database';
import { startTransaction, captureError } from './monitoringService';
import { getOAuthCallbackUrl, mapOAuthError } from '../utils/oauth';
import { withTimeout, withTimeoutFallback } from '../utils/promiseTimeout';

/** Wall-clock budgets so auth UI never spins forever on a hung Supabase call. */
export const AUTH_GET_USER_TIMEOUT_MS = 8000;
export const AUTH_PROFILE_TIMEOUT_MS = 8000;
export const AUTH_SESSION_WAIT_MS = 8000;
export const AUTH_GET_SESSION_ATTEMPT_MS = 3000;

export interface UserMetadata {
  phone: string;
  role: UserRole;
  country: 'GH' | 'NG';
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface AuthResponse {
  user: SupabaseUser | null;
  session: Session | null;
  error: AuthError | null;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthService {
  signUp(email: string, password: string, metadata: UserMetadata): Promise<AuthResponse>;
  signIn(identifier: string, password: string): Promise<AuthResponse>;
  signInWithOtp(phone: string): Promise<{ error: AuthError | null }>;
  verifyOtp(phone: string, token: string): Promise<AuthResponse>;
  signOut(): Promise<void>;
  getUser(): Promise<SupabaseUser | null>;
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): Subscription;
}

/** Fields clients may send through updateUserProfile (privileged columns are server-only). */
export type ClientUpdatableProfileFields = Partial<
  Pick<
    Profile,
    | 'first_name'
    | 'last_name'
    | 'username'
    | 'phone'
    | 'bio'
    | 'location'
    | 'country'
    | 'avatar_url'
    | 'profile_completed'
  >
>;

const CLIENT_UPDATABLE_PROFILE_KEYS = [
  'first_name',
  'last_name',
  'username',
  'phone',
  'bio',
  'location',
  'country',
  'avatar_url',
  'profile_completed',
] as const satisfies readonly (keyof ClientUpdatableProfileFields)[];

function sanitizeProfileUpdates(
  updates: ClientUpdatableProfileFields
): ClientUpdatableProfileFields {
  const sanitized: ClientUpdatableProfileFields = {};
  for (const key of CLIENT_UPDATABLE_PROFILE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sanitized[key] = updates[key];
    }
  }
  return sanitized;
}

function signupRole(role: UserRole): 'worker' | 'customer' {
  return role === 'worker' ? 'worker' : 'customer';
}

/** Normalize username for profiles.username (always @prefix, unique-ish). */
function buildSignupUsername(
  metadata: UserMetadata,
  userId: string
): string {
  const raw = (metadata.username || '').replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const fromNames =
    metadata.firstName && metadata.lastName
      ? `${metadata.firstName}${metadata.lastName}`.toLowerCase().replace(/[^a-z0-9_]/g, '')
      : '';
  const base = raw || fromNames || `user${userId.replace(/-/g, '').slice(0, 8)}`;
  return `@${base}`;
}

function mapSignUpError(error: { message: string; code?: string }): AuthError {
  const msg = error.message.toLowerCase();
  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists')
  ) {
    return {
      message: 'An account with this email already exists. Please sign in instead.',
      code: 'user_already_exists',
    };
  }
  // Supabase Auth when handle_new_user() / profile INSERT fails (unique phone/username, missing trigger, etc.)
  if (
    msg.includes('database error saving new user') ||
    msg.includes('database error creating new user') ||
    msg.includes('unable to sign up new user') ||
    msg.includes('database couldn') ||
    msg.includes("couldn't save new user") ||
    msg.includes('could not save new user')
  ) {
    return {
      message:
        'Unable to create your account. Your phone number or username may already be in use, or the database signup trigger needs updating. Try a different phone/username, or run migration 003 in Supabase.',
      code: 'database_signup_failed',
    };
  }
  return { message: error.message, code: error.code };
}

/**
 * After Auth signup: prefer the SECURITY DEFINER trigger row, then patch safe fields.
 * Never upsert `role` (blocked / RLS). Insert only when trigger missed and session exists.
 */
async function ensureProfileAfterSignup(
  userId: string,
  metadata: UserMetadata,
  role: 'worker' | 'customer',
  hasSession: boolean
): Promise<AuthError | null> {
  const username = buildSignupUsername(metadata, userId);
  const phone = metadata.phone?.trim() ? metadata.phone.trim() : null;

  const existing = await getUserProfile(userId);
  if (existing) {
    if (!hasSession) return null;
    const updated = await updateUserProfile(userId, {
      phone: phone ?? existing.phone ?? undefined,
      first_name: metadata.firstName || existing.first_name || undefined,
      last_name: metadata.lastName || existing.last_name || undefined,
      username: username || existing.username || undefined,
      country: metadata.country || existing.country || undefined,
      profile_completed:
        role === 'customer' ? true : (existing.profile_completed ?? false),
    });
    if (!updated) {
      console.warn('Profile exists but safe-field update failed after signup');
    }
    return null;
  }

  if (!hasSession) {
    // Email confirmation required — trigger should have created the row; if not, user is stuck until migrate.
    console.error('No profile after signup and no session (email confirm?). Run migration 003.');
    return null;
  }

  const { error: insertError } = await (supabase.from('profiles') as any).insert({
    id: userId,
    phone,
    role,
    first_name: metadata.firstName || null,
    last_name: metadata.lastName || null,
    username,
    country: metadata.country,
    profile_completed: role === 'customer',
    worker_status: role === 'worker' ? 'pending' : 'active',
    verified: false,
  });

  if (insertError) {
    captureError(new Error(insertError.message), { tags: { operation: 'ensureProfileAfterSignup' } });
    const lower = insertError.message.toLowerCase();
    if (lower.includes('duplicate') || lower.includes('unique')) {
      return {
        message:
          'That phone number or username is already registered. Try a different one, or sign in.',
        code: 'profile_conflict',
      };
    }
    return {
      message:
        insertError.message ||
        'Account was created but your profile could not be saved. Please contact support.',
      code: 'profile_create_failed',
    };
  }

  return null;
}

function mapSignInError(error: { message: string; code?: string }): AuthError {
  const msg = error.message.toLowerCase();
  const code = error.code?.toLowerCase() ?? '';

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid grant')
  ) {
    return {
      message: 'Invalid email or password. Please try again.',
      code: 'invalid_credentials',
    };
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return {
      message:
        'Email confirmation is still required by Supabase. For beta instant access, turn Confirm email OFF in Authentication → Providers → Email, then try again.',
      code: 'email_not_confirmed',
    };
  }
  return { message: error.message, code: error.code };
}

function isDuplicateSignUpUser(user: SupabaseUser | null, session: Session | null): boolean {
  if (!user || session) return false;
  const identities = user.identities;
  return Array.isArray(identities) && identities.length === 0;
}

/**
 * Wait for OAuth / URL session to be established after PKCE code exchange.
 * getSession() awaits the auth client initializePromise (detectSessionInUrl).
 * Hard wall-clock budget — each attempt and the overall wait are timed out.
 */
export async function waitForAuthSession(
  maxMs = AUTH_SESSION_WAIT_MS,
  delayMs = 200
): Promise<Session | null> {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_GET_SESSION_ATTEMPT_MS,
        'getSession'
      );
      if (error) {
        console.error('OAuth session error:', error.message);
        return null;
      }
      if (data.session) return data.session;
    } catch (err) {
      console.warn('waitForAuthSession attempt failed:', err);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, remaining)));
  }
  return null;
}

/**
 * Sign up a new user with email, password, and metadata
 * Creates user in Supabase Auth and stores profile data in profiles table
 */
export async function signUp(
  email: string,
  password: string,
  metadata: UserMetadata
): Promise<AuthResponse> {
  const transaction = startTransaction('auth.signUp', 'auth');
  
  try {
    // Create user in Supabase Auth
    const role = signupRole(metadata.role);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          phone: metadata.phone,
          role,
          country: metadata.country,
          firstName: metadata.firstName, // Database trigger expects camelCase
          lastName: metadata.lastName,   // Database trigger expects camelCase
          username: metadata.username,
        },
      },
    });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'signUp' } });
      return {
        user: null,
        session: null,
        error: mapSignUpError(error),
      };
    }

    if (isDuplicateSignUpUser(data.user, data.session)) {
      return {
        user: null,
        session: null,
        error: {
          message: 'An account with this email already exists. Please sign in instead.',
          code: 'user_already_exists',
        },
      };
    }

    if (data.user) {
      const profileError = await ensureProfileAfterSignup(
        data.user.id,
        metadata,
        role,
        Boolean(data.session)
      );
      if (profileError) {
        return {
          user: null,
          session: null,
          error: profileError,
        };
      }
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Sign in an existing user with email and password
 * Returns a valid session token on success
 */
export async function signIn(
  identifier: string,
  password: string
): Promise<AuthResponse> {
  const transaction = startTransaction('auth.signIn', 'auth');
  
  try {
    // Check if identifier is an email or phone number
    const isEmail = identifier.includes('@');
    
    const { data, error } = await supabase.auth.signInWithPassword(
      isEmail 
        ? { email: identifier, password }
        : { phone: identifier, password }
    );

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'signIn', type: isEmail ? 'email' : 'phone' } });
      return {
        user: null,
        session: null,
        error: mapSignInError(error),
      };
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Sign in with OTP (One-Time Password) via SMS
 */
export async function signInWithOtp(phone: string): Promise<{ error: AuthError | null }> {
  const transaction = startTransaction('auth.signInWithOtp', 'auth');
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'signInWithOtp' } });
      return { error: { message: error.message, code: error.code } };
    }

    return { error: null };
  } finally {
    transaction.finish();
  }
}

/**
 * Verify OTP code and complete sign in
 */
export async function verifyOtp(phone: string, token: string): Promise<AuthResponse> {
  const transaction = startTransaction('auth.verifyOtp', 'auth');
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      captureError(new Error(error.message), { tags: { operation: 'verifyOtp' } });
      return {
        user: null,
        session: null,
        error: { message: error.message, code: error.code },
      };
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    };
  } finally {
    transaction.finish();
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get the currently authenticated user (network-validated).
 * Timed out so AuthProvider cannot hang forever on a stalled auth API.
 */
export async function getUser(): Promise<SupabaseUser | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_GET_USER_TIMEOUT_MS,
      'getUser'
    );
    if (error) {
      console.error('getUser error:', error.message);
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('getUser failed:', err);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 * Returns a subscription that can be used to unsubscribe
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): Subscription {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}

/**
 * Get the user's profile from the profiles table.
 * Always resolves within AUTH_PROFILE_TIMEOUT_MS (null on error/timeout).
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  return withTimeoutFallback(
    (async () => {
      // Use type assertion to work around Supabase type inference issues
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to get profile:', error.message);
        return null;
      }

      return data as Profile;
    })(),
    AUTH_PROFILE_TIMEOUT_MS,
    null,
    'getUserProfile'
  );
}

/**
 * Update the user's profile in the profiles table
 */
export async function updateUserProfile(
  userId: string,
  updates: ClientUpdatableProfileFields
): Promise<Profile | null> {
  const sanitized = sanitizeProfileUpdates(updates);
  if (Object.keys(sanitized).length === 0) {
    return getUserProfile(userId);
  }

  // Use type assertion to work around Supabase type inference issues
  const { data, error } = await (supabase
    .from('profiles') as any)
    .update(sanitized)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Mark worker onboarding complete and advance status to pending_payment.
 * Prefers the SECURITY DEFINER RPC (migration 009) so the write is atomic.
 * Falls back to a direct update that only changes worker_status when still pending
 * (avoids trigger failures on retries when already pending_payment).
 * Throws on failure — callers must not navigate as if success occurred.
 */
export async function completeWorkerOnboardingProfile(userId: string): Promise<Profile> {
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
    'complete_worker_onboarding'
  );

  if (!rpcError && rpcData) {
    return rpcData as Profile;
  }

  if (rpcError && import.meta.env.DEV) {
    console.warn(
      'complete_worker_onboarding RPC unavailable, using direct update:',
      rpcError.message
    );
  }

  const existing = await getUserProfile(userId);
  const updates: Record<string, unknown> = { profile_completed: true };
  if (!existing || existing.worker_status === 'pending') {
    updates.worker_status = 'pending_payment';
  }

  const { data, error } = await (supabase
    .from('profiles') as any)
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error || !data) {
    const message =
      error?.message ||
      rpcError?.message ||
      'Failed to mark profile as complete';
    console.error('Failed to complete worker onboarding:', message);
    throw new Error(message);
  }

  return data as Profile;
}

/**
 * Sign in with Google OAuth
 * Redirects to Google for authentication
 */
export async function signInWithGoogle(role: UserRole, country: 'GH' | 'NG'): Promise<{ error: AuthError | null }> {
  const transaction = startTransaction('auth.signInWithGoogle', 'auth');

  if (!isSupabaseConfigured()) {
    return {
      error: {
        message:
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.',
        code: 'supabase_not_configured',
      },
    };
  }

  try {
    // Persist before redirect — navigation may occur before signInWithOAuth resolves
    localStorage.setItem('oauth_pending_role', role);
    localStorage.setItem('oauth_pending_country', country);

    const redirectTo = getOAuthCallbackUrl();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      localStorage.removeItem('oauth_pending_role');
      localStorage.removeItem('oauth_pending_country');
      captureError(new Error(error.message), { tags: { operation: 'signInWithGoogle' } });
      return {
        error: {
          message: mapOAuthError(error.code, error.message),
          code: error.code,
        },
      };
    }

    return { error: null };
  } finally {
    transaction.finish();
  }
}

/**
 * Google user metadata from OAuth
 */
export interface GoogleUserMetadata {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Complete OAuth signup by creating profile after Google redirect
 * Extracts Google account info including profile picture
 */
export async function completeOAuthSignup(
  userId: string,
  email: string,
  userMetadata?: GoogleUserMetadata
): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> {
  try {
    // Get stored role and country from localStorage
    const role = signupRole(
      (localStorage.getItem('oauth_pending_role') as UserRole) || 'customer'
    );
    const country = (localStorage.getItem('oauth_pending_country') as 'GH' | 'NG') || 'GH';
    
    // Clear stored values
    localStorage.removeItem('oauth_pending_role');
    localStorage.removeItem('oauth_pending_country');

    const { error: roleError } = await (supabase as any).rpc('assign_initial_role', { p_role: role });
    if (roleError) {
      // Non-fatal for returning users — role is already committed on the profile
      console.warn('assign_initial_role:', roleError.message);
    }

    // Extract Google profile data
    const fullName = userMetadata?.full_name || userMetadata?.name || '';
    const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture || null;
    
    // Parse name
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate username from Google name or email
    const username = firstName && lastName
      ? `@${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/[^a-z0-9@]/g, '')
      : email 
        ? `@${email.split('@')[0].replace(/[^a-z0-9]/g, '')}`
        : `@user${Date.now().toString(36)}`;

    // Check if profile already exists
    const existingProfile = await getUserProfile(userId);
    if (existingProfile) {
      // Update existing profile with Google data if missing
      if (!existingProfile.avatar_url && avatarUrl) {
        await updateUserProfile(userId, { avatar_url: avatarUrl });
      }
      if (!existingProfile.first_name && firstName) {
        await updateUserProfile(userId, { 
          first_name: firstName,
          last_name: lastName || existingProfile.last_name,
        });
      }
      return { success: true, isNewUser: false };
    }

    // Insert with role/worker_status so RLS INSERT policy passes (trigger normally created the row)
    const { error: profileError } = await (supabase.from('profiles') as any).insert({
      id: userId,
      phone: null,
      role,
      first_name: firstName || null,
      last_name: lastName || null,
      username,
      country,
      avatar_url: avatarUrl,
      profile_completed: role === 'customer',
      worker_status: role === 'worker' ? 'pending' : 'active',
      verified: false,
    });

    if (profileError) {
      console.error('Failed to create profile:', profileError.message);
      return { success: false, error: profileError.message };
    }

    return { success: true, isNewUser: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Export as a service object for compatibility with existing code patterns
export const authService: AuthService = {
  signUp,
  signIn,
  signInWithOtp,
  verifyOtp,
  signOut,
  getUser,
  onAuthStateChange,
};

export default authService;
