import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapOAuthError, getOAuthCallbackUrl } from './oauth';

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
