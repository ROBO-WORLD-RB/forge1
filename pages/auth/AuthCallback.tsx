import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, completeOAuthSignup, waitForAuthSession } from '../../services/authService';
import { Loader2 } from 'lucide-react';
import { UserRole } from '../../types';
import PageHelmet from '../../components/PageHelmet';
import { getSafeRedirectPathFromString, resolvePostAuthPath } from '../../utils/authRedirect';
import { getOAuthCallbackUrl, parseOAuthCallbackError } from '../../utils/oauth';
import { isSupabaseConfigured } from '../../services/supabase';

/**
 * OAuth Callback Page
 * Handles the redirect after Google OAuth sign-in
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finishWithError = (message: string) => {
      if (cancelled) return;
      setError(message);
      setTimeout(() => navigate('/auth/login', { replace: true, state: { oauthError: message } }), 3000);
    };

    const handleCallback = async () => {
      try {
        if (!isSupabaseConfigured()) {
          finishWithError(
            'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
          );
          return;
        }

        const urlError = parseOAuthCallbackError();
        if (urlError) {
          finishWithError(urlError);
          return;
        }

        const session = await waitForAuthSession();
        if (!session?.user) {
          finishWithError(
            `Sign-in did not complete. Add this Redirect URL in Supabase → Authentication → URL Configuration:\n${getOAuthCallbackUrl()}`
          );
          return;
        }

        const user = session.user;

        const { success, error: profileError } = await completeOAuthSignup(
          user.id,
          user.email || '',
          user.user_metadata
        );

        if (!success && profileError) {
          finishWithError('Failed to set up user profile. Please try again.');
          return;
        }

        let profile = await getUserProfile(user.id);
        if (!profile) {
          await new Promise((r) => setTimeout(r, 500));
          profile = await getUserProfile(user.id);
        }

        if (!profile) {
          finishWithError('Failed to load user profile. Please sign in again.');
          return;
        }

        const role = (profile.role || 'customer') as UserRole;

        const appUser = {
          id: user.id,
          phone: profile.phone || user.user_metadata?.phone || '',
          email: user.email,
          role,
          firstName: profile.first_name || undefined,
          lastName: profile.last_name || undefined,
          profileCompleted: profile.profile_completed ?? false,
          avatarUrl: profile.avatar_url || undefined,
          workerStatus: profile.worker_status || 'pending',
        };

        login(appUser, session.access_token);
        await refreshUser();

        const fromPath = localStorage.getItem('oauth_redirect_from');
        localStorage.removeItem('oauth_redirect_from');
        localStorage.removeItem('oauth_pending_role');
        localStorage.removeItem('oauth_pending_country');

        const safeFrom = getSafeRedirectPathFromString(
          fromPath,
          role === UserRole.WORKER ? '/dashboard/worker' : '/dashboard/customer'
        );

        if (cancelled) return;
        navigate(resolvePostAuthPath(appUser, safeFrom), { replace: true });
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        finishWithError(err.message || 'Something went wrong. Please try again.');
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate, login, refreshUser]);

  if (error) {
    return (
      <>
        <PageHelmet title="Authenticating..." />
        <div className="min-h-dynamic bg-gray-50 flex items-center justify-center p-4 pb-nav">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-500 mb-4 whitespace-pre-line">{error}</p>
          <p className="text-sm text-gray-400">Redirecting to sign in...</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Authenticating..." />
      <div className="min-h-dynamic bg-gray-50 flex items-center justify-center p-4 pb-nav">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <Loader2 className="w-12 h-12 text-forge-orange animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Completing Sign In</h2>
        <p className="text-gray-500">Please wait while we set up your account...</p>
      </div>
    </div>
    </>
  );
};

export default AuthCallback;
