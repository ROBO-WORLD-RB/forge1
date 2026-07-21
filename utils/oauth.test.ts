import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OAUTH_PENDING_ROLE_KEY,
  SIGNUP_ROLE_KEY,
  persistOAuthSignupIntent,
  readOAuthPendingRole,
  readOAuthPendingCountry,
  clearOAuthSignupIntent,
  mapOAuthError,
  getOAuthCallbackUrl,
} from './oauth';

describe('oauth utils', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds callback URL from window origin', () => {
    expect(getOAuthCallbackUrl()).toBe('http://localhost:3000/auth/callback');
  });

  it('maps provider disabled errors', () => {
    const msg = mapOAuthError('validation_failed', 'Provider google is not enabled');
    expect(msg).toContain('Google sign-in is not enabled');
    expect(msg).toContain('Supabase');
  });

  it('maps redirect URI errors with callback URL', () => {
    const msg = mapOAuthError('redirect_uri_mismatch', 'redirect_uri mismatch');
    expect(msg).toContain('http://localhost:3000/auth/callback');
  });

  it('maps access denied', () => {
    expect(mapOAuthError('access_denied', null)).toContain('cancelled');
  });
});

describe('oauth signup intent persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists worker role to session and local storage', () => {
    persistOAuthSignupIntent('worker', 'NG');
    expect(sessionStorage.getItem(OAUTH_PENDING_ROLE_KEY)).toBe('worker');
    expect(localStorage.getItem(OAUTH_PENDING_ROLE_KEY)).toBe('worker');
    expect(localStorage.getItem(SIGNUP_ROLE_KEY)).toBe('worker');
    expect(readOAuthPendingRole()).toBe('worker');
    expect(readOAuthPendingCountry()).toBe('NG');
  });

  it('falls back to forge_signup_role when oauth keys are missing', () => {
    localStorage.setItem(SIGNUP_ROLE_KEY, 'worker');
    localStorage.setItem('forge_signup_country', 'GH');
    expect(readOAuthPendingRole()).toBe('worker');
    expect(readOAuthPendingCountry()).toBe('GH');
  });

  it('clears all signup intent keys', () => {
    persistOAuthSignupIntent('customer', 'GH');
    clearOAuthSignupIntent();
    expect(readOAuthPendingRole()).toBeNull();
  });
});
