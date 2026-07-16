import { describe, it, expect } from 'vitest';
import {
  isAuthRoute,
  getDefaultDashboardPath,
  getSafeRedirectPath,
  getSafeRedirectPathFromString,
  resolvePostAuthPath,
} from './authRedirect';
import { UserRole } from '../types';

describe('authRedirect', () => {
  it('treats auth paths as non-redirect targets', () => {
    expect(isAuthRoute('/auth/signup')).toBe(true);
    expect(isAuthRoute('/auth/login')).toBe(true);
    expect(isAuthRoute('/dashboard/customer')).toBe(false);
  });

  it('falls back when from path is an auth route', () => {
    expect(getSafeRedirectPathFromString('/auth/signup', '/dashboard/customer')).toBe(
      '/dashboard/customer'
    );
  });

  it('preserves valid non-auth from paths', () => {
    expect(getSafeRedirectPathFromString('/search?q=plumber', '/dashboard/customer')).toBe(
      '/search?q=plumber'
    );
  });

  it('routes workers with incomplete profiles to onboarding', () => {
    expect(
      resolvePostAuthPath(
        { role: UserRole.WORKER, profileCompleted: false },
        '/dashboard/worker'
      )
    ).toBe('/auth/onboarding');
  });

  it('routes profile-completed workers to dashboard even if pending_payment', () => {
    expect(
      resolvePostAuthPath(
        { role: UserRole.WORKER, profileCompleted: true, workerStatus: 'pending_payment' },
        '/dashboard/worker'
      )
    ).toBe('/dashboard/worker');
  });

  it('routes completed customers to dashboard', () => {
    expect(
      resolvePostAuthPath(
        { role: UserRole.CUSTOMER, profileCompleted: true },
        '/dashboard/customer'
      )
    ).toBe('/dashboard/customer');
  });

  it('defaults dashboard path by role', () => {
    expect(getDefaultDashboardPath(UserRole.WORKER)).toBe('/dashboard/worker');
    expect(getDefaultDashboardPath(UserRole.CUSTOMER)).toBe('/dashboard/customer');
  });

  it('getSafeRedirectPath preserves pathname and search from Location', () => {
    expect(
      getSafeRedirectPath(
        { pathname: '/workers/plumber-123', search: '?tab=reviews', hash: '', state: null, key: 'k' },
        '/dashboard/customer'
      )
    ).toBe('/workers/plumber-123?tab=reviews');
  });

  it('getSafeRedirectPath falls back when from location is missing', () => {
    expect(getSafeRedirectPath(undefined, '/dashboard/worker')).toBe('/dashboard/worker');
  });

  it('getSafeRedirectPathFromString returns fallback for null or empty from path', () => {
    expect(getSafeRedirectPathFromString(null, '/dashboard/customer')).toBe('/dashboard/customer');
    expect(getSafeRedirectPathFromString(undefined, '/dashboard/worker')).toBe('/dashboard/worker');
  });

  it('resolvePostAuthPath honors deep link for completed worker', () => {
    expect(
      resolvePostAuthPath(
        { role: UserRole.WORKER, profileCompleted: true, workerStatus: 'active' },
        '/bookings/abc-123'
      )
    ).toBe('/bookings/abc-123');
  });

  it('resolvePostAuthPath ignores auth deep links and uses role dashboard', () => {
    expect(
      resolvePostAuthPath(
        { role: UserRole.CUSTOMER, profileCompleted: true },
        '/auth/login'
      )
    ).toBe('/dashboard/customer');
  });
});
