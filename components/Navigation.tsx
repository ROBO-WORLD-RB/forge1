import React, { useMemo } from 'react';
import {
  Home,
  Search,
  MessageSquare,
  User,
  Briefcase,
  Menu,
  LayoutDashboard,
  Crown,
  Calendar,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';

interface NavProps {
  onToggleSidebar?: () => void;
}

export type OsRole = 'customer' | 'worker' | 'guest';

export type OsNavLink = {
  to: string;
  label: string;
  badge?: number;
  /** Shown in mobile sidebar; omitted from TopNav when true */
  sidebarOnly?: boolean;
};

/** Returns true when `pathname` matches a nav route (exact or prefix for nested paths). */
export function isNavRouteActive(pathname: string, route: string): boolean {
  if (route === '/') return pathname === '/';
  if (route === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (route === '/jobs') {
    return pathname === '/jobs' || pathname.startsWith('/jobs/') || pathname === '/my-jobs';
  }
  if (route === '/auth/login') {
    return pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup');
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function resolveOsRole(role?: string | null, isAuthenticated?: boolean): OsRole {
  if (!isAuthenticated) return 'guest';
  if (role === 'worker') return 'worker';
  return 'customer';
}

/** Full IA for mobile sidebar + desktop secondary links. */
export function getOsSidebarLinks(os: OsRole, unreadNotifications = 0): OsNavLink[] {
  if (os === 'guest') {
    return [
      { to: '/', label: 'Home' },
      { to: '/search', label: 'Find Workers' },
      { to: '/jobs', label: 'Projects' },
    ];
  }

  if (os === 'worker') {
    return [
      { to: '/dashboard', label: 'Worker Hub' },
      { to: '/jobs', label: 'Job Feed' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/messages', label: 'Messages' },
      { to: '/notifications', label: 'Notifications', badge: unreadNotifications },
      { to: '/profile/edit', label: 'Portfolio / Profile' },
      { to: '/subscription', label: 'Subscription / Upgrade' },
      { to: '/my-profile', label: 'Account' },
      { to: '/settings/privacy', label: 'Settings', sidebarOnly: true },
    ];
  }

  // Customer OS
  return [
    { to: '/dashboard', label: 'Customer Hub' },
    { to: '/search', label: 'Find Workers' },
    { to: '/jobs', label: 'Projects' },
    { to: '/jobs?create=1', label: 'Post a Project', sidebarOnly: true },
    { to: '/bookings', label: 'Bookings' },
    { to: '/messages', label: 'Messages' },
    { to: '/notifications', label: 'Notifications', badge: unreadNotifications },
    { to: '/dashboard/customer', label: 'Saved workers', sidebarOnly: true },
    { to: '/my-profile', label: 'Profile' },
    { to: '/settings/privacy', label: 'Settings', sidebarOnly: true },
  ];
}

/** Primary TopNav links (desktop). Secondary items live in sidebar / hub. */
export function getOsTopNavLinks(os: OsRole, unreadNotifications = 0): OsNavLink[] {
  if (os === 'guest') {
    return [
      { to: '/', label: 'Home' },
      { to: '/search', label: 'Find Workers' },
      { to: '/jobs', label: 'Projects' },
    ];
  }

  if (os === 'worker') {
    return [
      { to: '/dashboard', label: 'Worker Hub' },
      { to: '/jobs', label: 'Job Feed' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/messages', label: 'Messages' },
      { to: '/notifications', label: 'Notifications', badge: unreadNotifications },
      { to: '/profile/edit', label: 'Profile' },
    ];
  }

  return [
    { to: '/dashboard', label: 'Customer Hub' },
    { to: '/search', label: 'Find Workers' },
    { to: '/jobs', label: 'Projects' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/messages', label: 'Messages' },
    { to: '/notifications', label: 'Notifications', badge: unreadNotifications },
  ];
}

function navLinkClass(pathname: string, route: string, base = ''): string {
  const active = isNavRouteActive(pathname, route);
  return [
    base,
    active
      ? 'text-forge-orange font-semibold'
      : 'text-gray-600 hover:text-forge-orange transition-colors',
  ]
    .filter(Boolean)
    .join(' ');
}

function bottomNavClass(pathname: string, route: string): string {
  const active = isNavRouteActive(pathname, route);
  return `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 max-w-[4.5rem] py-1 transition-colors ${
    active ? 'text-forge-orange' : 'text-gray-400 hover:text-gray-600'
  }`;
}

function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export const TopNav: React.FC<NavProps> = ({ onToggleSidebar }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const unreadNotifications = useUnreadNotificationCount(isAuthenticated, user?.id);
  const { pathname } = location;
  const os = resolveOsRole(user?.role, isAuthenticated);
  const isWorker = os === 'worker';

  const desktopLinks = useMemo(
    () => getOsTopNavLinks(os, unreadNotifications).filter((l) => !l.sidebarOnly),
    [os, unreadNotifications]
  );

  return (
    <nav className="sticky top-0 z-40 w-full bg-white border-b border-gray-200 shadow-sm pt-safe">
      <div className="h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-forge-navy rounded-lg"
            onClick={onToggleSidebar}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="Forge Logo" className="w-8 h-8 object-contain shrink-0" />
            <span className="text-xl font-bold text-forge-navy tracking-tight">FORGE</span>
            {os !== 'guest' && (
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-forge-muted border border-gray-200 rounded px-1.5 py-0.5">
                {os === 'worker' ? 'Worker' : 'Customer'}
              </span>
            )}
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {desktopLinks.map(({ to, label, badge }) => {
            const routeKey = to.split('?')[0];
            const active = isNavRouteActive(pathname, routeKey);
            return (
              <Link
                key={`${to}-${label}`}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`relative px-3 py-2 rounded-lg ${navLinkClass(pathname, routeKey)}`}
              >
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-forge-orange rounded-full" aria-hidden="true" />
                )}
                <span className="flex items-center gap-1.5">
                  {label}
                  {badge != null && badge > 0 && <UnreadBadge count={badge} />}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {isWorker && (
                <Link
                  to="/subscription"
                  className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
                >
                  <Crown className="w-4 h-4" />
                  Upgrade
                </Link>
              )}
              <Link
                to="/dashboard"
                aria-label={isWorker ? 'Open Worker Hub' : 'Open Customer Hub'}
                className={`flex items-center gap-2 text-sm font-medium rounded-lg px-1.5 py-1 ${
                  isNavRouteActive(pathname, '/dashboard')
                    ? 'text-forge-orange'
                    : 'text-gray-700 hover:text-forge-navy'
                }`}
              >
                <span className="hidden md:block text-right">
                  <span className="block text-xs text-gray-500">
                    {isWorker ? 'Worker Hub' : 'Customer Hub'}
                  </span>
                  {user?.firstName || 'User'}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border ${
                    isNavRouteActive(pathname, '/dashboard')
                      ? 'bg-forge-orange/10 border-forge-orange/30'
                      : 'bg-forge-navy/10 border-gray-200'
                  }`}
                >
                  <User className="w-5 h-5 text-forge-navy" />
                </div>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth/login"
                className={`hidden md:block text-sm font-medium px-3 py-2 rounded-lg ${navLinkClass(pathname, '/auth/login')}`}
              >
                Sign In
              </Link>
              <Link
                to="/auth/signup"
                className="bg-forge-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Join Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

type BottomItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { pathname } = location;
  const os = resolveOsRole(user?.role, isAuthenticated);

  // Max 5 primary tabs — secondary (notifications, settings, subscription) live in sidebar / hub
  const items: BottomItem[] = useMemo(() => {
    if (os === 'guest') {
      return [
        { to: '/', label: 'Home', icon: <Home className="w-5 h-5" aria-hidden="true" /> },
        { to: '/search', label: 'Find Workers', icon: <Search className="w-5 h-5" aria-hidden="true" /> },
        { to: '/jobs', label: 'Projects', icon: <Briefcase className="w-5 h-5" aria-hidden="true" /> },
        { to: '/auth/login', label: 'Sign In', icon: <User className="w-5 h-5" aria-hidden="true" /> },
      ];
    }

    if (os === 'worker') {
      return [
        { to: '/dashboard', label: 'Hub', icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" /> },
        { to: '/jobs', label: 'Job Feed', icon: <Briefcase className="w-5 h-5" aria-hidden="true" /> },
        { to: '/bookings', label: 'Bookings', icon: <Calendar className="w-5 h-5" aria-hidden="true" /> },
        { to: '/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" aria-hidden="true" /> },
        { to: '/profile/edit', label: 'Profile', icon: <User className="w-5 h-5" aria-hidden="true" /> },
      ];
    }

    return [
      { to: '/dashboard', label: 'Hub', icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" /> },
      { to: '/search', label: 'Find Workers', icon: <Search className="w-5 h-5" aria-hidden="true" /> },
      { to: '/jobs', label: 'Projects', icon: <Briefcase className="w-5 h-5" aria-hidden="true" /> },
      { to: '/bookings', label: 'Bookings', icon: <Calendar className="w-5 h-5" aria-hidden="true" /> },
      { to: '/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" aria-hidden="true" /> },
    ];
  }, [os]);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1.5 px-1 flex justify-around items-center z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-bottom"
      aria-label={os === 'worker' ? 'Worker OS navigation' : os === 'customer' ? 'Customer OS navigation' : 'Mobile navigation'}
    >
      {items.map(({ to, label, icon }) => {
        const routeKey = to.split('?')[0];
        const active = isNavRouteActive(pathname, routeKey);
        return (
          <Link
            key={`${to}-${label}`}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={bottomNavClass(pathname, routeKey)}
          >
            {icon}
            <span className="text-[10px] font-medium leading-tight text-center px-0.5 truncate w-full">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
