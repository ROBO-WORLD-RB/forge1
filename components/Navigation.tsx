import React, { useState, useEffect, useMemo } from 'react';
import { Home, Search, MessageSquare, User, Briefcase, Menu, LogOut, LayoutDashboard, Bell, Crown, Calendar } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotifications } from '../services/notificationService';

interface NavProps {
  onToggleSidebar?: () => void;
}

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
  return `flex flex-col items-center justify-center gap-0.5 min-w-16 py-1 transition-colors ${
    active ? 'text-forge-orange' : 'text-gray-400 hover:text-gray-600'
  }`;
}

function useUnreadNotificationCount(): number {
  const { user, isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setCount(0);
      return;
    }

    let cancelled = false;

    getNotifications(user.id, true).then((result) => {
      if (!cancelled && result.data) {
        setCount(result.data.length);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  return count;
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

type DesktopLink = { to: string; label: string; badge?: number };

export const TopNav: React.FC<NavProps> = ({ onToggleSidebar }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadNotifications = useUnreadNotificationCount();
  const { pathname } = location;
  const isWorker = user?.role === 'worker';
  const isCustomer = !isWorker; // guests + customers share discover CTAs

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const desktopLinks: DesktopLink[] = useMemo(() => {
    const links: DesktopLink[] = [{ to: '/', label: 'Home' }];

    // Customers discover workers; workers browse customer projects (not other workers)
    if (!isAuthenticated || isCustomer) {
      links.push({ to: '/search', label: 'Find Workers' });
    }

    links.push({
      to: '/jobs',
      label: isWorker ? 'Browse Projects' : 'Projects',
    });

    if (isAuthenticated) {
      links.push(
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/bookings', label: 'My Bookings' },
        { to: '/messages', label: 'Messages' },
        { to: '/notifications', label: 'Notifications', badge: unreadNotifications },
      );
      if (isWorker) {
        links.push({ to: '/profile/edit', label: 'Profile' });
      }
    }

    return links;
  }, [isAuthenticated, isCustomer, isWorker, unreadNotifications]);

  return (
    <nav className="sticky top-0 z-40 w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm h-16">
      <div className="flex items-center gap-2">
        <button
          className="md:hidden p-2 -ml-2 text-gray-600 hover:text-forge-navy rounded-lg"
          onClick={onToggleSidebar}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Forge Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold text-forge-navy tracking-tight">FORGE</span>
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-1 text-sm font-medium">
        {desktopLinks.map(({ to, label, badge }) => {
          const active = isNavRouteActive(pathname, to);
          return (
            <Link
              key={`${to}-${label}`}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative px-3 py-2 rounded-lg ${navLinkClass(pathname, to)}`}
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

      <div className="flex items-center gap-3">
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
              className={`hidden md:flex items-center gap-2 text-sm font-medium rounded-lg px-2 py-1 ${
                isNavRouteActive(pathname, '/dashboard')
                  ? 'text-forge-orange'
                  : 'text-gray-700 hover:text-forge-navy'
              }`}
            >
              <span className="text-right">
                <span className="block text-xs text-gray-500">Welcome</span>
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
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
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
    </nav>
  );
};

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const unreadNotifications = useUnreadNotificationCount();
  const { pathname } = location;
  const isWorker = user?.role === 'worker';

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1.5 px-2 flex justify-around items-center z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <Link
        to="/"
        aria-current={isNavRouteActive(pathname, '/') ? 'page' : undefined}
        className={bottomNavClass(pathname, '/')}
      >
        <Home className="w-5 h-5" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-tight">Home</span>
      </Link>
      {/* Customers find workers; workers browse projects instead */}
      {isWorker ? (
        <Link
          to="/jobs"
          aria-current={isNavRouteActive(pathname, '/jobs') ? 'page' : undefined}
          className={bottomNavClass(pathname, '/jobs')}
        >
          <Briefcase className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-tight">Projects</span>
        </Link>
      ) : (
        <>
          <Link
            to="/search"
            aria-current={isNavRouteActive(pathname, '/search') ? 'page' : undefined}
            className={bottomNavClass(pathname, '/search')}
          >
            <Search className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-tight">Workers</span>
          </Link>
          <Link
            to="/jobs"
            aria-current={isNavRouteActive(pathname, '/jobs') ? 'page' : undefined}
            className={bottomNavClass(pathname, '/jobs')}
          >
            <Briefcase className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-tight">Projects</span>
          </Link>
        </>
      )}
      {isAuthenticated ? (
        <>
          <Link
            to="/bookings"
            aria-current={isNavRouteActive(pathname, '/bookings') ? 'page' : undefined}
            className={bottomNavClass(pathname, '/bookings')}
          >
            <Calendar className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-tight">Bookings</span>
          </Link>
          <Link
            to="/messages"
            aria-current={isNavRouteActive(pathname, '/messages') ? 'page' : undefined}
            className={bottomNavClass(pathname, '/messages')}
          >
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-tight">Chat</span>
          </Link>
          <Link
            to="/notifications"
            aria-current={isNavRouteActive(pathname, '/notifications') ? 'page' : undefined}
            className={`${bottomNavClass(pathname, '/notifications')} min-w-14`}
          >
            <span className="relative">
              <Bell className="w-5 h-5" aria-hidden="true" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-0.5 leading-none">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-tight">Alerts</span>
          </Link>
          <Link
            to="/dashboard"
            aria-current={isNavRouteActive(pathname, '/dashboard') ? 'page' : undefined}
            className={`${bottomNavClass(pathname, '/dashboard')} min-w-14`}
          >
            <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-tight">Dash</span>
          </Link>
        </>
      ) : (
        <Link
          to="/auth/login"
          aria-current={isNavRouteActive(pathname, '/auth/login') ? 'page' : undefined}
          className={bottomNavClass(pathname, '/auth/login')}
        >
          <User className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-tight">Sign In</span>
        </Link>
      )}
    </nav>
  );
};
