/* @refresh reset */
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        const supabaseUser = await getUser();
        if (supabaseUser) {
          const profile = await getUserProfile(supabaseUser.id);
          const appUser = mapToAppUser(supabaseUser, profile);
          setUser(appUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization failed", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const subscription = onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsLoading(true);
        try {
          const profile = await getUserProfile(session.user.id);
          const appUser = mapToAppUser(session.user, profile);
          setUser(appUser);
        } catch (error) {
          console.error("Failed to load user profile", error);
        } finally {
          setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token refreshed, user is still authenticated
        // Optionally refresh profile data
      } else if (event === 'USER_UPDATED' && session?.user) {
        // User data updated, refresh profile
        try {
          const profile = await getUserProfile(session.user.id);
          const appUser = mapToAppUser(session.user, profile);
          setUser(appUser);
        } catch (error) {
          console.error("Failed to refresh user profile", error);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = (newUser: User, _token: string) => {
    // This is called after successful login from the login page
    // The onAuthStateChange will also fire, but we set user immediately for better UX
    setUser(newUser);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const supabaseUser = await getUser();
      if (supabaseUser) {
        const profile = await getUserProfile(supabaseUser.id);
        const appUser = mapToAppUser(supabaseUser, profile);
        setUser(appUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to refresh user", error);
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
