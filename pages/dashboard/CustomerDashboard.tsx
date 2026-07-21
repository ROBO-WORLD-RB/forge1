import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookingsByCustomer } from '../../services/bookingService';
import { getJobsByPoster } from '../../services/jobService';
import { getNotifications, markNotificationRead } from '../../services/notificationService';
import { getUnreadCount } from '../../services/chatService';
import { getCategories } from '../../services/workerService';
import { getFavorites } from '../../services/favoriteService';
import {
  getRecommendedWorkersForCustomer,
  type RecommendedWorker,
} from '../../services/recommendationService';
import { getBookingTrend } from '../../services/analyticsService';
import { openForgeAi } from '../../utils/forgeAiEvents';
import type { Booking, Job, Notification as DBNotification, FavoriteWithWorker } from '../../types/database';
import {
  Briefcase, MessageSquare, Bell, Plus, ChevronRight, Loader2, X,
  Calendar, Search, Heart, Star, CheckCircle, Clock, ArrowRight, Sparkles
} from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';
import BookingTrendBars, { type TrendPoint } from '../../components/BookingTrendBars';

function openForgeAiMatch() {
  openForgeAi({ intent: 'match' });
}

const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [favorites, setFavorites] = useState<FavoriteWithWorker[]>([]);
  const [recommended, setRecommended] = useState<RecommendedWorker[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [bookingTrend, setBookingTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fallbackCategories = [
    { id: 'f1', name: 'Electrical', slug: 'electrical' },
    { id: 'f2', name: 'Plumbing', slug: 'plumbing' },
    { id: 'f3', name: 'Carpentry', slug: 'carpentry' },
    { id: 'f4', name: 'Painting', slug: 'painting' },
  ];

  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const categoriesFetch = async () => {
          try {
            const fetchPromise = getCategories();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Categories timeout')), 5000)
            );
            const { data } = await Promise.race([fetchPromise, timeoutPromise]) as any;
            return data || [];
          } catch (e) {
            console.error('Categories fetch failed:', e);
            return fallbackCategories;
          }
        };

        const [bookingsResult, jobsResult, notifResult, unreadResult, categoriesData, favoritesResult, trendResult] =
          await Promise.all([
            getBookingsByCustomer(user.id),
            getJobsByPoster(user.id),
            getNotifications(user.id),
            getUnreadCount(user.id),
            categoriesFetch(),
            getFavorites(user.id),
            getBookingTrend(user.id, 'customer', 14),
          ]);

        if (bookingsResult.data) setBookings(bookingsResult.data);
        if (jobsResult.data) setJobs(jobsResult.data);
        if (notifResult.data) setNotifications(notifResult.data.slice(0, 5));
        if (unreadResult.data !== null) setUnreadMessages(unreadResult.data);
        setCategories(categoriesData.slice(0, 4));
        if (favoritesResult.data) setFavorites(favoritesResult.data);
        if (trendResult.data) setBookingTrend(trendResult.data);

        const preferredSkills = [
          ...new Set(
            (jobsResult.data || [])
              .map((j) => j.category)
              .filter((c): c is string => Boolean(c))
          ),
        ].slice(0, 3);

        const recResult = await getRecommendedWorkersForCustomer(user.id, {
          country: user.country || null,
          location: user.location || null,
          preferredSkills,
          limit: 6,
        });
        if (recResult.data) setRecommended(recResult.data);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.id]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    const result = await markNotificationRead(notificationId);
    if (!result.error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REVIEWED':
        return 'bg-emerald-100 text-emerald-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingBookings = bookings.filter((b) => b.status === 'PENDING');
  const activeBookings = bookings.filter((b) =>
    ['ACCEPTED', 'IN_PROGRESS'].includes(b.status)
  );
  const needsReview = bookings.filter((b) => b.status === 'COMPLETED');
  const openJobs = jobs.filter((j) => j.status === 'open');
  const unreadNotifications = notifications.filter((n) => !n.read_at).length;

  const nextActions: { id: string; title: string; body: string; to: string; cta: string }[] = [];
  if (needsReview.length > 0) {
    nextActions.push({
      id: 'review',
      title: `${needsReview.length} job${needsReview.length === 1 ? '' : 's'} ready to review`,
      body: 'Leave a review to help other customers hire with confidence.',
      to: '/bookings',
      cta: 'Leave review',
    });
  }
  if (pendingBookings.length > 0) {
    nextActions.push({
      id: 'pending',
      title: `${pendingBookings.length} booking${pendingBookings.length === 1 ? '' : 's'} waiting on a pro`,
      body: 'Your request is pending — the worker still needs to accept.',
      to: '/bookings',
      cta: 'Track bookings',
    });
  }
  if (activeBookings.length > 0) {
    nextActions.push({
      id: 'active',
      title: `${activeBookings.length} active project${activeBookings.length === 1 ? '' : 's'}`,
      body: 'Work is accepted or in progress. Message your pro if you need an update.',
      to: '/bookings',
      cta: 'View pipeline',
    });
  }
  if (openJobs.length > 0 && pendingBookings.length === 0 && activeBookings.length === 0) {
    nextActions.push({
      id: 'open-jobs',
      title: `${openJobs.length} open project${openJobs.length === 1 ? '' : 's'}`,
      body: 'Workers can find and apply to your posted projects.',
      to: '/jobs',
      cta: 'View projects',
    });
  }
  if (nextActions.length === 0) {
    nextActions.push({
      id: 'start',
      title: 'Start hiring',
      body: 'Find a verified pro or post a project so workers can apply.',
      to: '/search',
      cta: 'Find workers',
    });
  }

  const pipelineBookings = [
    ...needsReview,
    ...pendingBookings,
    ...activeBookings,
    ...bookings.filter((b) => !['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status)),
  ].slice(0, 5);

  if (loading) {
    return (
      <>
        <PageHelmet title="My dashboard" path="/dashboard/customer" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="My dashboard" path="/dashboard/customer" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-4 md:pt-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6 md:mb-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-forge-orange mb-1">
                Customer
              </p>
              <h1 className="text-2xl font-bold text-forge-navy">My dashboard</h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">
                Discover → Trust → Hire → Manage — your hiring pipeline in one place.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:items-end shrink-0">
              {/* Primary actions — compact; secondary links below on mobile */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Link
                  to="/jobs?create=1"
                  className="bg-forge-orange text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-orange-600 transition-colors shadow-sm shadow-forge-orange/15"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Post</span>
                  <span className="hidden sm:inline">Post Project</span>
                </Link>
                <button
                  type="button"
                  onClick={openForgeAiMatch}
                  className="bg-forge-navy text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-forge-orange transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="sm:hidden">AI Match</span>
                  <span className="hidden sm:inline">Find with AI</span>
                </button>
                <Link
                  to="/search"
                  className="hidden sm:inline-flex bg-white text-forge-navy border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Find Workers
                </Link>
                {/* Desktop: compact secondary pills in the same row */}
                <Link
                  to="/bookings"
                  className="hidden md:inline-flex text-forge-navy border border-gray-200 bg-white px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Bookings
                </Link>
                <Link
                  to="/payments"
                  className="hidden md:inline-flex text-forge-navy border border-gray-200 bg-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Payments
                </Link>
                <Link
                  to="/notifications"
                  className="hidden md:inline-flex text-forge-navy border border-gray-200 bg-white px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Alerts
                  {unreadNotifications > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold min-w-[1.1rem] h-4 px-1 rounded-full flex items-center justify-center">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </Link>
              </div>
              {/* Mobile / tablet: secondary as compact text links */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm md:hidden">
                <Link to="/search" className="sm:hidden text-forge-navy font-medium hover:text-forge-orange">
                  Find Workers
                </Link>
                <Link to="/bookings" className="text-gray-600 hover:text-forge-orange font-medium">
                  Bookings
                </Link>
                <Link to="/payments" className="text-gray-600 hover:text-forge-orange font-medium">
                  Payments
                </Link>
                <Link to="/notifications" className="text-gray-600 hover:text-forge-orange font-medium inline-flex items-center gap-1">
                  Alerts
                  {unreadNotifications > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold min-w-[1.1rem] h-4 px-1 rounded-full flex items-center justify-center">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}

          {/* Pipeline stats — real counts only */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link
              to="/bookings"
              className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-yellow-400 hover:shadow-md transition-shadow block"
            >
              <div className="text-gray-500 text-sm mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Pending
              </div>
              <div className="text-3xl font-bold text-gray-900">{pendingBookings.length}</div>
              <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                Awaiting pro <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
            <Link
              to="/bookings"
              className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-orange hover:shadow-md transition-shadow block"
            >
              <div className="text-gray-500 text-sm mb-1">Active projects</div>
              <div className="text-3xl font-bold text-gray-900">{activeBookings.length}</div>
              <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                Track bookings <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
            <Link
              to="/jobs"
              className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-green hover:shadow-md transition-shadow block"
            >
              <div className="text-gray-500 text-sm mb-1">Open projects</div>
              <div className="text-3xl font-bold text-gray-900">{openJobs.length}</div>
              <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                View projects <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
            <Link
              to="/messages"
              className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow block"
            >
              <div className="text-gray-500 text-sm mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Messages
              </div>
              <div className="text-3xl font-bold text-gray-900">{unreadMessages}</div>
              <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                Open inbox <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="mb-6">
            <BookingTrendBars points={bookingTrend} label="Your bookings (last 14 days)" />
          </div>

          {/* Recommended next actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
            <h2 className="font-bold text-lg text-forge-navy mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-forge-orange" />
              Recommended next
            </h2>
            <div className="space-y-3">
              {nextActions.slice(0, 3).map((action) => (
                <div
                  key={action.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{action.title}</p>
                    <p className="text-sm text-gray-500">{action.body}</p>
                  </div>
                  <Link
                    to={action.to}
                    className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-forge-orange hover:underline"
                  >
                    {action.cta} <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
              {needsReview.length > 0 && (
                <p className="text-xs text-gray-500 flex items-center gap-1 pt-1">
                  <Star className="w-3.5 h-3.5 text-forge-orange" />
                  Reviews use real completed bookings — no placeholder ratings.
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Hiring pipeline */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <h2 className="font-bold text-lg text-gray-900">Hiring pipeline</h2>
                <Link
                  to="/bookings"
                  className="text-forge-orange text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                >
                  My Bookings <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {pipelineBookings.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="mb-4">No bookings yet. Hire a pro or post a project.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Link
                        to="/search"
                        className="bg-forge-orange text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors inline-block"
                      >
                        Find Workers
                      </Link>
                      <Link
                        to="/jobs?create=1"
                        className="bg-gray-100 text-forge-navy px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors inline-block"
                      >
                        Post a Project
                      </Link>
                    </div>
                  </div>
                ) : (
                  pipelineBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      to="/bookings"
                      className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}
                          >
                            {booking.status.replace('_', ' ')}
                          </span>
                          {booking.status === 'COMPLETED' && (
                            <span className="text-xs text-forge-orange font-medium flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3" /> Review due
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                          {booking.customer_message?.split('\n')[0] || 'Booking details'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          #{booking.id.slice(0, 8)} ·{' '}
                          <span className="text-forge-orange">Open in My Bookings</span>
                        </p>
                      </div>
                      <span className="text-forge-orange p-2 rounded-lg shrink-0" aria-hidden="true">
                        <ChevronRight className="w-5 h-5" />
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  Recent alerts
                  {unreadNotifications > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadNotifications}
                    </span>
                  )}
                </h2>
                <Link to="/notifications" className="text-forge-orange text-sm font-medium hover:underline">
                  All
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No booking updates yet</p>
                    <p className="text-xs mt-1">You&apos;ll see accept, start, and complete alerts here.</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${!notification.read_at ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900">{notification.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2">{notification.body}</p>
                          <Link
                            to="/bookings"
                            className="text-xs text-forge-orange font-medium hover:underline mt-1 inline-block"
                          >
                            Open My Bookings
                          </Link>
                        </div>
                        {!notification.read_at && (
                          <button
                            onClick={() => handleMarkNotificationRead(notification.id)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            aria-label="Mark read"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recommended workers */}
          {recommended.length > 0 && (
            <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-forge-orange" />
                  Recommended for you
                </h2>
                <button
                  type="button"
                  onClick={openForgeAiMatch}
                  className="text-forge-orange text-sm font-medium hover:underline"
                >
                  Match with AI
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {recommended.map((w) => {
                  const avatar =
                    (w as any)?.profiles?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=random`;
                  return (
                    <Link
                      key={w.user_id}
                      to={w.profilePath}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-forge-orange/30 hover:bg-orange-50/40 transition-colors"
                    >
                      <img src={avatar} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{w.name}</p>
                        <p className="text-xs text-gray-500 truncate">{w.role || 'Skilled pro'}</p>
                        <p className="text-xs text-forge-orange font-medium mt-0.5">{w.reason}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved workers */}
          <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-forge-orange" />
                Saved workers
              </h2>
              <Link to="/search" className="text-forge-orange text-sm font-medium hover:underline">
                Find more
              </Link>
            </div>
            {favorites.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Heart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">No saved workers yet</p>
                <p className="text-sm mb-4">
                  Tap the heart on a worker profile to save them for later.
                </p>
                <Link
                  to="/search"
                  className="inline-block bg-gray-100 text-forge-navy px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
                >
                  Browse pros
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {favorites.slice(0, 6).map((fav) => {
                  const w = fav.worker;
                  const name = w?.name || 'Worker';
                  const avatar =
                    (w as any)?.profiles?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                  return (
                    <Link
                      key={fav.id}
                      to={`/profile/${fav.worker_user_id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-forge-orange/30 hover:bg-orange-50/40 transition-colors"
                    >
                      <img src={avatar} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{w?.role || 'Skilled pro'}</p>
                        {w && w.review_count > 0 ? (
                          <p className="text-xs text-forge-orange font-medium flex items-center gap-0.5 mt-0.5">
                            <Star className="w-3 h-3 fill-current" />
                            {w.rating.toFixed(1)} ({w.review_count})
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">No reviews yet</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Explore Categories */}
          <div className="mt-8">
            <h2 className="font-bold text-xl text-forge-navy mb-4">Explore services</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/search?category=${cat.slug}`}
                  className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-center justify-center text-center flex-col gap-2 group"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-forge-orange/10 transition-colors">
                    <Briefcase className="w-5 h-5 text-gray-400 group-hover:text-forge-orange" />
                  </div>
                  <span className="font-medium text-gray-900">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerDashboard;
