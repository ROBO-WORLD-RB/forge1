/**
 * OAuth helpers for Google sign-in via Supabase.
 */

/** App callback path — must match Supabase Redirect URLs and signInWithOAuth redirectTo */
export function getOAuthCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function mapOAuthError(
  error?: string | null,
  description?: string | null
): string {
  const code = (error || '').toLowerCase();
  const msg = (description || error || '').toLowerCase();

  if (code === 'access_denied') {
    return 'Google sign-in was cancelled. Please try again.';
  }

  if (
    msg.includes('provider') &&
    (msg.includes('not enabled') ||
      msg.includes('disabled') ||
      msg.includes('unsupported provider'))
  ) {
    return (
      'Google sign-in is not enabled in Supabase. Open Dashboard → Authentication → Providers → Google, ' +
      'turn it on, and paste your Google Cloud Client ID and Client Secret.'
    );
  }

  if (
    code === 'redirect_uri_mismatch' ||
    msg.includes('redirect_uri') ||
    msg.includes('redirect url') ||
    msg.includes('not allowed') ||
    msg.includes('invalid redirect')
  ) {
    return (
      `This sign-in URL is not allowed. In Supabase → Authentication → URL Configuration → Redirect URLs, add:\n` +
      `${getOAuthCallbackUrl()}`
    );
  }

  if (msg.includes('not a valid implicit grant flow') || msg.includes('pkce')) {
    return 'Sign-in callback failed. Refresh the page and try again, or contact support if it persists.';
  }

  if (description) return description;
  if (error) return error;
  return 'Google sign-in failed. Please try again.';
}

/** Read OAuth error params Supabase/Google append to the callback URL */
export function parseOAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null;

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const error = search.get('error') || hash.get('error');
  const description =
    search.get('error_description') || hash.get('error_description');

  if (!error && !description) return null;
  return mapOAuthError(error, description);
}
