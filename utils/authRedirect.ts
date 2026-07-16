import type { Location } from 'react-router-dom';
import { UserRole } from '../types';

const AUTH_PREFIX = '/auth/';

/** Paths that must never be used as post-login redirects */
export function isAuthRoute(path: string): boolean {
  return path.startsWith(AUTH_PREFIX);
}

export function getDefaultDashboardPath(role: UserRole | string): string {
  return role === UserRole.WORKER || role === 'worker'
    ? '/dashboard/worker'
    : '/dashboard/customer';
}

export function getSafeRedirectPath(
  from: Location | undefined,
  fallback: string
): string {
  if (!from?.pathname) return fallback;
  const path = `${from.pathname}${from.search || ''}`;
  return getSafeRedirectPathFromString(path, fallback);
}

export function getSafeRedirectPathFromString(
  fromPath: string | null | undefined,
  fallback: string
): string {
  if (!fromPath) return fallback;
  if (isAuthRoute(fromPath)) return fallback;
  return fromPath;
}

export interface PostAuthUser {
  role: UserRole | string;
  profileCompleted?: boolean;
  workerStatus?: string;
}

/** Resolve where to send a user after sign-in or sign-up */
export function resolvePostAuthPath(
  user: PostAuthUser,
  fromPath?: string
): string {
  const fallback = getDefaultDashboardPath(user.role);
  const destination = fromPath && !isAuthRoute(fromPath) ? fromPath : fallback;

  if (user.role === UserRole.WORKER || user.role === 'worker') {
    if (!user.profileCompleted) {
      return '/auth/onboarding';
    }
    // Onboarding fee deferred for beta — pending_payment no longer blocks access
  }

  return destination;
}
