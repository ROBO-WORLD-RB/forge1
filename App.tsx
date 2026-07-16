import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';
import PageTransition from './components/PageTransition';
import { useAuth } from './context/AuthContext';
import { TopNav, BottomNav, isNavRouteActive } from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import UpdatePrompt from './components/UpdatePrompt';
import { usePageTracking } from './hooks/useAnalytics';
import { usePWA } from './hooks/usePWA';
import AIChat from './components/AIChat';
import { InstallPrompt } from './components/InstallPrompt';
import { initialize as initSentry, SentryErrorBoundary } from './services/monitoringService';
import { getDefaultDashboardPath, getSafeRedirectPath, resolvePostAuthPath } from './utils/authRedirect';
import { lazyWithRetry } from './utils/lazyWithRetry';

const Home = lazyWithRetry(() => import('./pages/Home'));
const WorkerSearch = lazyWithRetry(() => import('./pages/WorkerSearch'));
const WorkerProfile = lazyWithRetry(() => import('./pages/WorkerProfile'));
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'));
const Messages = lazyWithRetry(() => import('./pages/Messages'));
const Jobs = lazyWithRetry(() => import('./pages/Jobs'));
const JobDetail = lazyWithRetry(() => import('./pages/JobDetail'));
const Bookings = lazyWithRetry(() => import('./pages/Bookings'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const Subscription = lazyWithRetry(() => import('./pages/Subscription'));
const Login = lazyWithRetry(() => import('./pages/auth/Login'));
const Signup = lazyWithRetry(() => import('./pages/auth/Signup'));
const AuthCallback = lazyWithRetry(() => import('./pages/auth/AuthCallback'));
const WorkerOnboarding = lazyWithRetry(() => import('./pages/auth/WorkerOnboarding'));
const ForgotPassword = lazyWithRetry(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/auth/ResetPassword'));
const ProfileEdit = lazyWithRetry(() => import('./pages/ProfileEdit'));
const CustomerDashboard = lazyWithRetry(() => import('./pages/dashboard/CustomerDashboard'));
const WorkerDashboard = lazyWithRetry(() => import('./pages/dashboard/WorkerDashboard'));
// OnboardingPayment kept in pages/auth for later re-enable; route redirects to dashboard for beta
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));

const PAGE_LOAD_TIMEOUT_MS = 12000;

const PageLoader = () => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), PAGE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center bg-white px-6 text-center gap-4">
        <p className="text-gray-700 font-medium">This page is taking too long to load.</p>
        <p className="text-sm text-gray-500 max-w-sm">
          A stalled network request or outdated app cache can cause this. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-forge-orange text-white font-medium hover:opacity-90"
        >
          Reload page
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-orange" />
    </div>
  );
};

const AuthGateLoader = () => <PageLoader />;

// Guest Route — redirect authenticated users away from login/signup
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (isAuthenticated && user) {
    const from = (location.state as { from?: import('react-router-dom').Location })?.from;
    const fallback = getDefaultDashboardPath(user.role);
    const safeFrom = getSafeRedirectPath(from, fallback);
    return <Navigate to={resolvePostAuthPath(user, safeFrom)} replace />;
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Worker Route Component
const WorkerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'worker') {
    return <Navigate to="/dashboard/customer" replace />;
  }

  // Onboarding fee deferred for beta — pending_payment no longer blocks dashboard
  if (!user?.profileCompleted) {
    return <Navigate to="/auth/onboarding" replace />;
  }

  return <>{children}</>;
};

// Customer Route Component
const CustomerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role === 'worker') {
    return <Navigate to="/dashboard/worker" replace />;
  }

  return <>{children}</>;
};

// Worker Onboarding Route — profile setup step for new workers
const WorkerOnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'worker') {
    return <Navigate to="/dashboard/customer" replace />;
  }

  if (user?.profileCompleted) {
    return <Navigate to="/dashboard/worker" replace />;
  }

  return <>{children}</>;
};

// Worker Payment Route — onboarding fee deferred for beta; keep route for later re-enable
const WorkerPaymentRoute: React.FC<{ children?: React.ReactNode }> = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'worker') {
    return <Navigate to="/dashboard/customer" replace />;
  }

  if (!user?.profileCompleted) {
    return <Navigate to="/auth/onboarding" replace />;
  }

  // Beta: skip onboarding fee — always send completed workers to dashboard
  return <Navigate to="/dashboard/worker" replace />;
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthGateLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Dashboard Redirect Component — routes /dashboard to role-specific dashboards.
// Legacy monolithic pages/Dashboard.tsx was removed; use CustomerDashboard / WorkerDashboard.
const DashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'worker') return <Navigate to="/dashboard/worker" replace />;
  return <Navigate to="/dashboard/customer" replace />;
};

const AppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { needRefresh, updateApp, dismissUpdate } = usePWA();
  const isWorker = user?.role === 'worker';
  
  const location = useLocation();
  
  // Track page views
  usePageTracking();

  const sidebarLinks: { to: string; label: string }[] = [
    { to: '/', label: 'Home' },
    ...(!isAuthenticated || !isWorker
      ? [{ to: '/search', label: 'Find Workers' }]
      : []),
    {
      to: '/jobs',
      label: isWorker ? 'Browse Projects' : 'Projects',
    },
    ...(isAuthenticated
      ? [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/messages', label: 'Messages' },
          { to: '/bookings', label: 'My Bookings' },
          ...(isWorker
            ? [
                { to: '/subscription', label: 'Subscription' },
                { to: '/profile/edit', label: 'Edit Profile' },
              ]
            : [{ to: '/jobs?create=1', label: 'Post a Project' }]),
          { to: '/my-profile', label: 'My Profile' },
        ]
      : []),
  ];

  return (
    <div className="min-h-dynamic bg-gray-50 font-sans text-gray-900 flex flex-col">
      <OfflineIndicator />
      {needRefresh && (
        <UpdatePrompt onUpdate={updateApp} onDismiss={dismissUpdate} />
      )}
      <TopNav onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      {/* Skip to content link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-forge-navy focus:rounded-lg focus:shadow-lg focus:outline-2 focus:outline-forge-orange">
        Skip to content
      </a>
      {/* Main Layout */}
      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait">
          <Suspense fallback={<PageLoader />}>
          <Routes location={location} key={location.pathname}>
            {/* Public Routes */}
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/auth/login" element={<GuestRoute><PageTransition><Login /></PageTransition></GuestRoute>} />
            <Route path="/auth/signup" element={<GuestRoute><PageTransition><Signup /></PageTransition></GuestRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/search" element={<PageTransition><WorkerSearch /></PageTransition>} />
            <Route path="/profile/:id" element={<PageTransition><WorkerProfile /></PageTransition>} />
            <Route path="/pro/:username" element={<PageTransition><WorkerProfile /></PageTransition>} />

            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <PageTransition><DashboardRedirect /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/customer" 
              element={
                <CustomerRoute>
                  <PageTransition><CustomerDashboard /></PageTransition>
                </CustomerRoute>
              } 
            />
            <Route 
              path="/dashboard/worker" 
              element={
                <WorkerRoute>
                  <PageTransition><WorkerDashboard /></PageTransition>
                </WorkerRoute>
              } 
            />
            <Route 
              path="/messages" 
              element={
                <ProtectedRoute>
                  <PageTransition><Messages /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/jobs" 
              element={
                <ProtectedRoute>
                  <PageTransition><Jobs /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/jobs/:id" 
              element={
                <ProtectedRoute>
                  <PageTransition><JobDetail /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-jobs" 
              element={
                <ProtectedRoute>
                  <PageTransition><Jobs /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bookings" 
              element={
                <ProtectedRoute>
                  <PageTransition><Bookings /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/subscription" 
              element={
                <ProtectedRoute>
                  <PageTransition><Subscription /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <PageTransition><Notifications /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-profile" 
              element={
                <ProtectedRoute>
                  <PageTransition><UserProfile /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/auth/onboarding" 
              element={
                <WorkerOnboardingRoute>
                  <PageTransition><WorkerOnboarding /></PageTransition>
                </WorkerOnboardingRoute>
              } 
            />
            <Route
              path="/auth/onboarding/payment"
              element={<WorkerPaymentRoute />}
            />
            <Route 
              path="/profile/edit" 
              element={
                <ProtectedRoute>
                  <PageTransition><ProfileEdit /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <PageTransition><AdminDashboard /></PageTransition>
                </AdminRoute>
              } 
            />
          </Routes>
          </Suspense>
        </AnimatePresence>
      </main>

      <BottomNav />
      <InstallPrompt />
      <AIChat />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div className="bg-white w-64 h-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="Forge Logo" className="w-8 h-8 object-contain" />
              <h2 className="text-xl font-bold text-forge-navy">FORGE</h2>
            </div>
            <div className="space-y-1">
                {sidebarLinks.map(({ to, label }) => {
                  const active = isNavRouteActive(location.pathname, to.split('?')[0]);
                  return (
                    <Link
                      key={`${to}-${label}`}
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={`block py-2.5 px-3 rounded-lg font-medium transition-colors ${
                        active
                          ? 'bg-forge-orange/10 text-forge-orange'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {label}
                    </Link>
                  );
                })}
                {isAuthenticated ? (
                  <button onClick={() => { logout(); setIsSidebarOpen(false); }} className="block w-full text-left py-2.5 px-3 rounded-lg text-red-500 font-medium hover:bg-red-50">Sign Out</button>
                ) : (
                  <div className="border-t border-gray-100 pt-4 mt-2 space-y-1">
                    <Link to="/auth/login" className={`block py-2.5 px-3 rounded-lg font-medium ${isNavRouteActive(location.pathname, '/auth/login') ? 'bg-forge-orange/10 text-forge-orange' : 'text-forge-orange hover:bg-orange-50'}`} onClick={() => setIsSidebarOpen(false)}>Sign In</Link>
                    <Link to="/auth/signup" className="block py-2.5 px-3 rounded-lg text-gray-700 font-medium hover:bg-gray-50" onClick={() => setIsSidebarOpen(false)}>Sign Up</Link>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Initialize Sentry on app mount
  useEffect(() => {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    if (sentryDsn) {
      initSentry({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      });
    }
  }, []);

  return (
    <SentryErrorBoundary fallback={<ErrorBoundary><div /></ErrorBoundary>}>
      <ErrorBoundary>
        <HelmetProvider>
          <Router>
            <AppContent />
          </Router>
        </HelmetProvider>
      </ErrorBoundary>
    </SentryErrorBoundary>
  );
};

export default App;
