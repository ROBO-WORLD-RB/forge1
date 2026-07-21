/**
 * OAuth helpers for Google sign-in via Supabase.
 */

export const OAUTH_PENDING_ROLE_KEY = 'oauth_pending_role';
export const OAUTH_PENDING_COUNTRY_KEY = 'oauth_pending_country';
/** Signup page also writes these before Google redirect — read as fallback after OAuth round-trip */
export const SIGNUP_ROLE_KEY = 'forge_signup_role';
export const SIGNUP_COUNTRY_KEY = 'forge_signup_country';

export type OAuthPendingRole = 'worker' | 'customer';

function readStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Persist signup role/country before Google redirect (sessionStorage + localStorage). */
export function persistOAuthSignupIntent(role: OAuthPendingRole, country: 'GH' | 'NG'): void {
  writeStorageItem(OAUTH_PENDING_ROLE_KEY, role);
  writeStorageItem(OAUTH_PENDING_COUNTRY_KEY, country);
  writeStorageItem(SIGNUP_ROLE_KEY, role);
  writeStorageItem(SIGNUP_COUNTRY_KEY, country);
}

/** Read intended signup role after OAuth callback (oauth keys, then signup-page fallback). */
export function readOAuthPendingRole(): OAuthPendingRole | null {
  const fromOAuth = readStorageItem(OAUTH_PENDING_ROLE_KEY);
  if (fromOAuth === 'worker' || fromOAuth === 'customer') return fromOAuth;

  const fromSignup = readStorageItem(SIGNUP_ROLE_KEY);
  if (fromSignup === 'worker' || fromSignup === 'customer') return fromSignup;

  return null;
}

export function readOAuthPendingCountry(): 'GH' | 'NG' {
  const fromOAuth = readStorageItem(OAUTH_PENDING_COUNTRY_KEY);
  if (fromOAuth === 'GH' || fromOAuth === 'NG') return fromOAuth;

  const fromSignup = readStorageItem(SIGNUP_COUNTRY_KEY);
  if (fromSignup === 'GH' || fromSignup === 'NG') return fromSignup;

  return 'GH';
}

export function clearOAuthSignupIntent(): void {
  removeStorageItem(OAUTH_PENDING_ROLE_KEY);
  removeStorageItem(OAUTH_PENDING_COUNTRY_KEY);
  removeStorageItem(SIGNUP_ROLE_KEY);
  removeStorageItem(SIGNUP_COUNTRY_KEY);
}

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
