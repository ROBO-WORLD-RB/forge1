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
  LogOut,
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

type BottomItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
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

/** Pathname keys used by BottomNav — must never appear in the hamburger sidebar. */
export function getOsBottomNavRoutes(os: OsRole): string[] {
  if (os === 'guest') return ['/', '/search'];
  if (os === 'worker') return ['/jobs', '/bookings', '/messages', '/dashboard/worker'];
  return ['/', '/search', '/bookings', '/messages'];
}

/** Primary mobile bottom tabs only (3–4). Secondary destinations live in the hamburger. */
export function getOsBottomNavItems(os: OsRole): Omit<BottomItem, 'icon'>[] {
  if (os === 'guest') {
    return [
      { to: '/', label: 'Home' },
      { to: '/search', label: 'Find pros' },
    ];
  }

  if (os === 'worker') {
    return [
      { to: '/jobs', label: 'Jobs' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/messages', label: 'Chat' },
      { to: '/dashboard/worker', label: 'Dashboard' },
    ];
  }

  return [
    { to: '/', label: 'Home' },
    { to: '/search', label: 'Find pros' },
    { to: '/bookings', label: 'My jobs' },
    { to: '/messages', label: 'Chat' },
  ];
}

function pathKey(to: string): string {
  return to.split('?')[0];
}

/** Mobile sidebar + secondary links. Never overlaps BottomNav destinations. */
export function getOsSidebarLinks(os: OsRole, unreadNotifications = 0): OsNavLink[] {
  const bottomRoutes = new Set(getOsBottomNavRoutes(os));

  let links: OsNavLink[];

  if (os === 'guest') {
    links = [
      { to: '/jobs', label: 'Projects' },
    ];
  } else if (os === 'worker') {
    links = [
      { to: '/profile/edit', label: 'Portfolio' },
      { to: '/subscription', label: 'Upgrade' },
      { to: '/wallet', label: 'Payments' },
      { to: '/notifications', label: 'Alerts', badge: unreadNotifications },
      { to: '/my-profile', label: 'Account' },
      { to: '/settings/privacy', label: 'Settings' },
    ];
  } else {
    // Customer — dashboard, projects, payments, alerts, profile, settings
    links = [
      { to: '/dashboard', label: 'My dashboard' },
      { to: '/jobs', label: 'Projects' },
      { to: '/payments', label: 'Payments' },
      { to: '/notifications', label: 'Alerts', badge: unreadNotifications },
      { to: '/my-profile', label: 'Profile' },
      { to: '/settings/privacy', label: 'Settings' },
    ];
  }

  return links.filter((l) => !bottomRoutes.has(pathKey(l.to)));
}

/** Primary TopNav links (desktop). Richer than mobile bottom bar. */
export function getOsTopNavLinks(os: OsRole, unreadNotifications = 0): OsNavLink[] {
  if (os === 'guest') {
    return [
      { to: '/', label: 'Home' },
      { to: '/search', label: 'Find pros' },
      { to: '/jobs', label: 'Projects' },
    ];
  }

  if (os === 'worker') {
    return [
      { to: '/dashboard/worker', label: 'Dashboard' },
      { to: '/jobs', label: 'Jobs' },
      { to: '/bookings', label: 'Bookings' },
      { to: '/messages', label: 'Chat' },
      { to: '/notifications', label: 'Alerts', badge: unreadNotifications },
      { to: '/profile/edit', label: 'Portfolio' },
    ];
  }

  return [
    { to: '/dashboard', label: 'My dashboard' },
    { to: '/search', label: 'Find pros' },
    { to: '/jobs', label: 'Projects' },
    { to: '/bookings', label: 'My jobs' },
    { to: '/messages', label: 'Chat' },
    { to: '/notifications', label: 'Alerts', badge: unreadNotifications },
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
  return `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 max-w-[5rem] min-h-[44px] py-1.5 px-0.5 transition-colors ${
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

function bottomIcon(to: string, os: OsRole): React.ReactNode {
  const cls = 'w-5 h-5';
  if (to === '/') return <Home className={cls} aria-hidden="true" />;
  if (to === '/search') return <Search className={cls} aria-hidden="true" />;
  if (to === '/jobs') return <Briefcase className={cls} aria-hidden="true" />;
  if (to === '/bookings') return <Calendar className={cls} aria-hidden="true" />;
  if (to === '/messages') return <MessageSquare className={cls} aria-hidden="true" />;
  if (to.startsWith('/dashboard')) return <LayoutDashboard className={cls} aria-hidden="true" />;
  if (to === '/auth/login') return <User className={cls} aria-hidden="true" />;
  if (os === 'worker') return <Briefcase className={cls} aria-hidden="true" />;
  return <Home className={cls} aria-hidden="true" />;
}

export const TopNav: React.FC<NavProps> = ({ onToggleSidebar }) => {
  const { user, isAuthenticated, logout } = useAuth();
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
      <div className="h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ml-1 text-gray-600 hover:text-forge-navy rounded-lg"
            onClick={onToggleSidebar}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2 min-w-0 min-h-[44px]">
            <img src="/logo.png" alt="Forge Logo" className="w-8 h-8 object-contain shrink-0" />
            <span className="text-lg sm:text-xl font-bold text-forge-navy tracking-tight truncate">FORGE</span>
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

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 md:gap-3">
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
                aria-label={isWorker ? 'Open dashboard' : 'Open my dashboard'}
                className={`flex items-center gap-2 text-sm font-medium rounded-lg min-h-[44px] px-1.5 py-1 ${
                  isNavRouteActive(pathname, '/dashboard')
                    ? 'text-forge-orange'
                    : 'text-gray-700 hover:text-forge-navy'
                }`}
              >
                <span className="hidden md:block text-right">
                  <span className="block text-xs text-gray-500">
                    {isWorker ? 'Dashboard' : 'My dashboard'}
                  </span>
                  {user?.firstName || 'User'}
                </span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border ${
                    isNavRouteActive(pathname, '/dashboard')
                      ? 'bg-forge-orange/10 border-forge-orange/30'
                      : 'bg-forge-navy/10 border-gray-200'
                  }`}
                >
                  <User className="w-5 h-5 text-forge-navy" />
                </div>
              </Link>
              {/* Desktop Sign Out — mobile keeps sidebar Sign Out (avoids safe-area clash) */}
              <button
                type="button"
                onClick={() => void logout()}
                className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth/login"
                className={`text-sm font-medium px-3 py-2 rounded-lg min-h-[44px] inline-flex items-center ${navLinkClass(pathname, '/auth/login')}`}
              >
                Sign In
              </Link>
              <Link
                to="/auth/signup"
                className="bg-forge-navy text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors min-h-[44px] inline-flex items-center"
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

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { pathname } = location;
  const os = resolveOsRole(user?.role, isAuthenticated);

  const items: BottomItem[] = useMemo(() => {
    return getOsBottomNavItems(os).map((item) => ({
      ...item,
      icon: bottomIcon(item.to, os),
    }));
  }, [os]);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1 px-0.5 flex justify-around items-stretch z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      aria-label={os === 'worker' ? 'Worker navigation' : os === 'customer' ? 'Customer navigation' : 'Mobile navigation'}
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
            <span className={`flex items-center justify-center ${active ? 'text-forge-orange' : ''}`}>
              {icon}
            </span>
            <span className="text-[10px] font-medium leading-tight text-center px-0.5 truncate w-full">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
