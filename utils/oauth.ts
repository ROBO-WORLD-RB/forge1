/**
 * OAuth helpers for Google sign-in via Supabase.
 */

export const OAUTH_PENDING_ROLE_KEY = 'oauth_pending_role';
export const OAUTH_PENDING_COUNTRY_KEY = 'oauth_pending_country';
/** Signup page also writes these before Google redirect — read as fallback after OAuth round-trip */
export const SIGNUP_ROLE_KEY = 'forge_signup_role';
export const SIGNUP_COUNTRY_KEY = 'forge_signup_country';
/** Cookie survives some mobile OAuth redirects when storage is cleared */
export const OAUTH_INTENT_COOKIE = 'forge_oauth_intent';

export type OAuthPendingRole = 'worker' | 'customer';

const OAUTH_INTENT_MAX_AGE_MS = 15 * 60 * 1000;

function readOAuthIntentCookie(): { role: OAuthPendingRole; country: 'GH' | 'NG' } | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${OAUTH_INTENT_COOKIE}=([^;]*)`)
  );
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as {
      role?: string;
      country?: string;
      t?: number;
    };
    if (!parsed.t || Date.now() - parsed.t > OAUTH_INTENT_MAX_AGE_MS) return null;
    if (parsed.role !== 'worker' && parsed.role !== 'customer') return null;
    const country = parsed.country === 'NG' ? 'NG' : 'GH';
    return { role: parsed.role, country };
  } catch {
    return null;
  }
}

function writeOAuthIntentCookie(role: OAuthPendingRole, country: 'GH' | 'NG'): void {
  if (typeof document === 'undefined') return;
  const payload = encodeURIComponent(
    JSON.stringify({ role, country, t: Date.now() })
  );
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${OAUTH_INTENT_COOKIE}=${payload}; path=/; max-age=900; SameSite=Lax${secure}`;
}

function clearOAuthIntentCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${OAUTH_INTENT_COOKIE}=; path=/; max-age=0`;
}

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

/** Persist signup role/country before Google redirect (storage + cookie). */
export function persistOAuthSignupIntent(role: OAuthPendingRole, country: 'GH' | 'NG'): void {
  writeStorageItem(OAUTH_PENDING_ROLE_KEY, role);
  writeStorageItem(OAUTH_PENDING_COUNTRY_KEY, country);
  writeStorageItem(SIGNUP_ROLE_KEY, role);
  writeStorageItem(SIGNUP_COUNTRY_KEY, country);
  writeOAuthIntentCookie(role, country);
}

/** Read intended signup role after OAuth callback (storage, cookie, signup fallback). */
export function readOAuthPendingRole(): OAuthPendingRole | null {
  const fromOAuth = readStorageItem(OAUTH_PENDING_ROLE_KEY);
  if (fromOAuth === 'worker' || fromOAuth === 'customer') return fromOAuth;

  const fromSignup = readStorageItem(SIGNUP_ROLE_KEY);
  if (fromSignup === 'worker' || fromSignup === 'customer') return fromSignup;

  const fromCookie = readOAuthIntentCookie();
  if (fromCookie?.role) return fromCookie.role;

  return null;
}

export function readOAuthPendingCountry(): 'GH' | 'NG' {
  const fromOAuth = readStorageItem(OAUTH_PENDING_COUNTRY_KEY);
  if (fromOAuth === 'GH' || fromOAuth === 'NG') return fromOAuth;

  const fromSignup = readStorageItem(SIGNUP_COUNTRY_KEY);
  if (fromSignup === 'GH' || fromSignup === 'NG') return fromSignup;

  const fromCookie = readOAuthIntentCookie();
  if (fromCookie?.country) return fromCookie.country;

  return 'GH';
}

export function clearOAuthSignupIntent(): void {
  removeStorageItem(OAUTH_PENDING_ROLE_KEY);
  removeStorageItem(OAUTH_PENDING_COUNTRY_KEY);
  removeStorageItem(SIGNUP_ROLE_KEY);
  removeStorageItem(SIGNUP_COUNTRY_KEY);
  clearOAuthIntentCookie();
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
