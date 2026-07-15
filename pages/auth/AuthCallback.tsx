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
import { withTimeout } from '../../utils/promiseTimeout';

/** Entire OAuth callback must finish or surface an error — never spin forever. */
const AUTH_CALLBACK_HARD_TIMEOUT_MS = 15000;

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
    let settled = false;

    const finishWithError = (message: string) => {
      if (cancelled || settled) return;
      settled = true;
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
        if (settled || cancelled) return;
        if (!session?.user) {
          finishWithError(
            `Sign-in did not complete. Add this Redirect URL in Supabase → Authentication → URL Configuration:\n${getOAuthCallbackUrl()}`
          );
          return;
        }

        const user = session.user;

        const { success, error: profileError } = await withTimeout(
          completeOAuthSignup(user.id, user.email || '', user.user_metadata),
          8000,
          'completeOAuthSignup'
        );
        if (settled || cancelled) return;

        if (!success && profileError) {
          finishWithError('Failed to set up user profile. Please try again.');
          return;
        }

        let profile = await getUserProfile(user.id);
        if (!profile) {
          await new Promise((r) => setTimeout(r, 500));
          profile = await getUserProfile(user.id);
        }
        if (settled || cancelled) return;

        // Proceed with session metadata if profiles table is slow/missing —
        // blocking forever left users on an orange spinner after Google login.
        const role = (profile?.role || user.user_metadata?.role || 'customer') as UserRole;

        const appUser = {
          id: user.id,
          phone: profile?.phone || user.user_metadata?.phone || '',
          email: user.email,
          role,
          firstName: profile?.first_name || user.user_metadata?.first_name || undefined,
          lastName: profile?.last_name || user.user_metadata?.last_name || undefined,
          profileCompleted: profile?.profile_completed ?? false,
          avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
          workerStatus: profile?.worker_status || 'pending',
        };

        settled = true;
        login(appUser, session.access_token);
        // Don't block navigation if profile refresh is slow
        void refreshUser();

        const fromPath = localStorage.getItem('oauth_redirect_from');
        localStorage.removeItem('oauth_redirect_from');
        localStorage.removeItem('oauth_pending_role');
        localStorage.removeItem('oauth_pending_country');

        const safeFrom = getSafeRedirectPathFromString(
          fromPath,
          role === UserRole.WORKER ? '/dashboard/worker' : '/dashboard/customer'
        );

        navigate(resolvePostAuthPath(appUser, safeFrom), { replace: true });
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        finishWithError(err.message || 'Something went wrong. Please try again.');
      }
    };

    const hardTimer = window.setTimeout(() => {
      finishWithError(
        'Sign-in timed out. Check your connection and Supabase Auth redirect URLs, then try again.'
      );
    }, AUTH_CALLBACK_HARD_TIMEOUT_MS);

    handleCallback().finally(() => {
      window.clearTimeout(hardTimer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimer);
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
