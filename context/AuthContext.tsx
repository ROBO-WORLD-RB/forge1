/* @refresh reset */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, UserRole, WorkerTier } from '../types';
import { 
  signOut, 
  getUser, 
  getUserProfile, 
  onAuthStateChange 
} from '../services/authService';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Absolute ceiling so route gates never show a spinner forever. */
const AUTH_BOOTSTRAP_HARD_TIMEOUT_MS = 10000;

/**
 * Convert Supabase user and profile to app User type
 */
function mapToAppUser(
  supabaseUser: { id: string; email?: string; user_metadata?: any; created_at?: string },
  profile?: { 
    phone: string; 
    role: string; 
    first_name: string | null; 
    last_name: string | null;
    username: string | null;
    bio: string | null;
    location: string | null;
    country: 'GH' | 'NG' | null;
    avatar_url: string | null;
    profile_completed: boolean;
    worker_status?: string;
    specialties?: string[];
    rating?: number;
    review_count?: number;
    tier?: string;
    created_at?: string;
  } | null
): User {
  const metadata = supabaseUser.user_metadata || {};
  
  // Get avatar URL from profile, or fall back to Google OAuth avatar
  const avatarUrl = profile?.avatar_url 
    || metadata.avatar_url 
    || metadata.picture 
    || undefined;

  // Get name from profile, or fall back to Google OAuth name
  const firstName = profile?.first_name 
    || metadata.first_name 
    || metadata.firstName
    || (metadata.full_name || metadata.name || '').split(' ')[0] 
    || undefined;
  
  const lastName = profile?.last_name 
    || metadata.last_name 
    || metadata.lastName
    || (metadata.full_name || metadata.name || '').split(' ').slice(1).join(' ') 
    || undefined;

  // Generate username from profile or Google data
  const username = profile?.username 
    || metadata.username 
    || (firstName && lastName ? `@${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/[^a-z0-9@]/g, '') : undefined);
  
  return {
    id: supabaseUser.id,
    phone: profile?.phone || metadata.phone || '',
    email: supabaseUser.email,
    role: (profile?.role || metadata.role || 'customer') as UserRole,
    firstName,
    lastName,
    username,
    bio: profile?.bio || undefined,
    location: profile?.location || metadata.location || undefined,
    country: profile?.country || metadata.country || undefined,
    profileCompleted: profile?.profile_completed ?? false,
    workerStatus: profile?.worker_status || 'pending',
    specialties: profile?.specialties || [],
    avatarUrl,
    rating: profile?.rating ?? 0,
    reviewCount: profile?.review_count ?? 0,
    memberSince: profile?.created_at || supabaseUser.created_at,
    tier: (profile?.tier || 'free') as WorkerTier,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Hard ceiling — even if getUser/profile somehow never settle, unlock the UI.
    const hardTimer = window.setTimeout(() => {
      if (mountedRef.current) {
        console.warn('Auth bootstrap hard timeout — clearing loading state');
        setIsLoading(false);
      }
    }, AUTH_BOOTSTRAP_HARD_TIMEOUT_MS);

    const initAuth = async () => {
      try {
        const supabaseUser = await getUser();
        if (!mountedRef.current) return;
        if (supabaseUser) {
          // Profile failure must not block auth; map with metadata fallbacks.
          const profile = await getUserProfile(supabaseUser.id);
          if (!mountedRef.current) return;
          setUser(mapToAppUser(supabaseUser, profile));
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization failed', error);
        if (mountedRef.current) setUser(null);
      } finally {
        if (mountedRef.current) setIsLoading(false);
        window.clearTimeout(hardTimer);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const subscription = onAuthStateChange(async (event, session: Session | null) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Do not set isLoading=true here — login()/signup already set the user.
        // Flipping loading caused GuestRoute/ProtectedRoute to flash and bounce.
        try {
          const profile = await getUserProfile(session.user.id);
          if (!mountedRef.current) return;
          // Prefer fresh profile; if fetch fails, keep existing context user
          // so we do not reset profileCompleted mid-onboarding.
          if (profile) {
            setUser(mapToAppUser(session.user, profile));
          } else {
            setUser((prev) => prev ?? mapToAppUser(session.user, null));
          }
        } catch (error) {
          console.error('Failed to load user profile', error);
          if (mountedRef.current) {
            setUser((prev) => prev ?? mapToAppUser(session.user, null));
          }
        } finally {
          if (mountedRef.current) setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          setUser(null);
          setIsLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token refreshed, user is still authenticated
      } else if (event === 'USER_UPDATED' && session?.user) {
        try {
          const profile = await getUserProfile(session.user.id);
          if (!mountedRef.current) return;
          if (profile) {
            setUser(mapToAppUser(session.user, profile));
          } else {
            setUser((prev) => prev ?? mapToAppUser(session.user, null));
          }
        } catch (error) {
          console.error('Failed to refresh user profile', error);
          if (mountedRef.current) {
            setUser((prev) => prev ?? mapToAppUser(session.user, null));
          }
        }
      }
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(hardTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = (newUser: User, _token: string) => {
    // Called after successful login — set user immediately for better UX.
    setUser(newUser);
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const supabaseUser = await getUser();
      if (supabaseUser) {
        const profile = await getUserProfile(supabaseUser.id);
        // Never clobber a known session with a null profile fetch (timeout/error):
        // that resets profileCompleted to false and causes onboarding loops.
        if (profile) {
          setUser(mapToAppUser(supabaseUser, profile));
        } else {
          setUser((prev) => prev ?? mapToAppUser(supabaseUser, null));
        }
      }
      // If getUser() returns null after a successful login/signup, keep the
      // existing context user — clearing it would bounce guests back to signup.
    } catch (error) {
      console.error('Failed to refresh user', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
