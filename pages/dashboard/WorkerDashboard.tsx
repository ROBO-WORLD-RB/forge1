import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookingsByWorker } from '../../services/bookingService';
import { getNotifications, markNotificationRead } from '../../services/notificationService';
import { getActiveSubscription, checkSubscriptionStatus } from '../../services/subscriptionService';
import { getUnreadCount } from '../../services/chatService';
import {
  getPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getEndorsements,
  getProfileByUserId,
  calculateCompletionRate,
} from '../../services/workerService';
import {
  getApplicationsByWorker,
  rankJobsForWorker,
} from '../../services/jobApplicationService';
import { getVerificationStatus } from '../../services/verificationService';
import { getTransactionsByUser } from '../../services/paymentWebhookService';
import { searchJobs } from '../../services/jobService';
import { getBookingTrend } from '../../services/analyticsService';
import ShareTools from '../../components/ShareTools';
import type {
  Booking,
  Notification as DBNotification,
  Subscription,
  JobApplicationWithJob,
  Job,
} from '../../types/database';
import type { WorkerProfile, WorkerTier } from '../../types';
import {
  Clock, CheckCircle, AlertCircle, Briefcase, MessageSquare,
  Bell, CreditCard, ChevronRight, Loader2, X, Star,
  Calendar, Zap, Image as ImageIcon, Share2, Plus, Trash2, Upload,
  Shield, Pencil
} from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';
import BookingTrendBars, { type TrendPoint } from '../../components/BookingTrendBars';
import { uploadPublicFile } from '../../utils/storageUpload';

const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'share'>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<JobApplicationWithJob[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('none');
  const [kycVerified, setKycVerified] = useState(false);
  const [earningsEstimate, setEarningsEstimate] = useState(0);
  const [earningsCurrency, setEarningsCurrency] = useState('GHS');
  const [recommendedJobs, setRecommendedJobs] = useState<Array<Job & { matchScore: number; matchReason: string }>>([]);
  const [acceptingWork, setAcceptingWork] = useState(true);
  const [rawWorkerProfile, setRawWorkerProfile] = useState<any>(null);
  const [bookingTrend, setBookingTrend] = useState<TrendPoint[]>([]);

  // Portfolio states
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDesc, setPortfolioDesc] = useState('');
  const [portfolioMedia, setPortfolioMedia] = useState('');
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const portfolioFileRef = useRef<HTMLInputElement>(null);

  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          bookingsResult,
          notifResult,
          subResult,
          status,
          unreadResult,
          portfolioResult,
          endorsementsResult,
          workerProfileResult,
          appsResult,
          kycResult,
          txnResult,
          jobsResult,
          trendResult,
        ] = await Promise.all([
          getBookingsByWorker(user.id),
          getNotifications(user.id),
          getActiveSubscription(user.id),
          checkSubscriptionStatus(user.id),
          getUnreadCount(user.id),
          getPortfolioItems(user.id),
          getEndorsements(user.id),
          getProfileByUserId(user.id),
          getApplicationsByWorker(user.id),
          getVerificationStatus(user.id),
          getTransactionsByUser(user.id, 'booking'),
          searchJobs({ status: 'open', country: user.country as any }),
          getBookingTrend(user.id, 'worker', 14),
        ]);

        if (bookingsResult.data) setBookings(bookingsResult.data);
        if (trendResult.data) setBookingTrend(trendResult.data);
        if (notifResult.data) setNotifications(notifResult.data.slice(0, 5));
        if (subResult.data) setSubscription(subResult.data);
        setSubscriptionStatus(status);
        if (unreadResult.data !== null) setUnreadMessages(unreadResult.data);
        if (portfolioResult.data) setPortfolios(portfolioResult.data);
        if (endorsementsResult.data) setEndorsements(endorsementsResult.data);
        if (appsResult.data) setApplications(appsResult.data);

        if (kycResult.data) {
          setKycStatus(kycResult.data.overallStatus);
          setKycVerified(kycResult.data.isVerified);
        }

        const currency = user.country === 'GH' ? 'GHS' : 'NGN';
        setEarningsCurrency(currency);

        // Honest earnings: booking transactions if any, else 0 (no fake numbers)
        const txns = txnResult.data || [];
        const paid = txns.filter((t) => t.status === 'success' || t.status === 'completed');
        const fromTxns = paid.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        setEarningsEstimate(fromTxns);

        let wpRaw: any = null;
        if (workerProfileResult.data) {
          const wp = workerProfileResult.data;
          wpRaw = wp;
          setRawWorkerProfile(wp);
          setAcceptingWork(wp.accepting_work !== false);
          setWorkerProfile({
            id: wp.id,
            userId: wp.user_id,
            name: wp.name,
            role: wp.role,
            location: wp.location,
            country: wp.country,
            avatarUrl: wp.profiles?.avatar_url || user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(wp.name)}&background=random`,
            bio: wp.bio || '',
            hourlyRate: {
              min: wp.hourly_rate_min || 0,
              max: wp.hourly_rate_max || 0,
              currency: wp.currency || currency,
            },
            rating: wp.rating,
            reviewCount: wp.review_count,
            skills: wp.skills || [],
            tier: (wp.tier as WorkerTier) || WorkerTier.FREE,
            verified: wp.verified,
            reviews: [],
            experienceYears: wp.experience_years || undefined,
          });
        }

        const openJobs = jobsResult.data || [];
        const ranked = rankJobsForWorker(openJobs, {
          skills: wpRaw?.skills || user.specialties || [],
          role: wpRaw?.role || user.specialties?.[0] || '',
          country: user.country,
          location: wpRaw?.location || user.location || '',
        }).slice(0, 5);
        setRecommendedJobs(ranked);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, navigate]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    const result = await markNotificationRead(notificationId);
    if (!result.error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }
  };

  const handlePortfolioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPortfolioError('Please choose an image file.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPortfolioError('Image must be 5MB or smaller.');
      e.target.value = '';
      return;
    }
    setPortfolioError(null);
    setPortfolioFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPortfolioPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetPortfolioForm = () => {
    setPortfolioTitle('');
    setPortfolioDesc('');
    setPortfolioMedia('');
    setPortfolioFile(null);
    setPortfolioPreview(null);
    setEditingPortfolioId(null);
    if (portfolioFileRef.current) portfolioFileRef.current.value = '';
  };

  const startEditPortfolio = (item: any) => {
    setEditingPortfolioId(item.id);
    setPortfolioTitle(item.title || '');
    setPortfolioDesc(item.description || '');
    setPortfolioMedia(item.media_urls?.[0] || '');
    setPortfolioPreview(item.media_urls?.[0] || null);
    setPortfolioFile(null);
    setPortfolioError(null);
    setActiveTab('portfolio');
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!portfolioTitle.trim()) {
      setPortfolioError('Project title is required');
      return;
    }

    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      let mediaUrl =
        portfolioMedia.trim() ||
        `https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60`;

      if (portfolioFile) {
        const fileExt = portfolioFile.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/portfolio-${Date.now()}.${fileExt}`;
        mediaUrl = await uploadPublicFile('avatars', fileName, portfolioFile, {
          upsert: true,
          label: 'Portfolio image upload',
          timeoutMs: 45_000,
        });
      }

      if (editingPortfolioId) {
        const { data, error: updateError } = await updatePortfolioItem(editingPortfolioId, {
          title: portfolioTitle,
          description: portfolioDesc,
          media_urls: [mediaUrl],
        });
        if (updateError) {
          setPortfolioError(updateError.message);
        } else if (data) {
          setPortfolios((prev) => prev.map((p) => (p.id === data.id ? data : p)));
          resetPortfolioForm();
        }
      } else {
        const { data, error: createError } = await createPortfolioItem(user.id, {
          title: portfolioTitle,
          description: portfolioDesc,
          media_urls: [mediaUrl],
        });

        if (createError) {
          setPortfolioError(createError.message);
        } else if (data) {
          setPortfolios((prev) => [data, ...prev]);
          resetPortfolioForm();
        }
      }
    } catch (err: any) {
      console.error('Portfolio upload error:', err);
      setPortfolioError(
        err?.message?.includes('timed out')
          ? 'Image upload timed out. Check your connection and try again.'
          : err?.message || 'Failed to save portfolio item.'
      );
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    const { data: success, error: deleteError } = await deletePortfolioItem(id);
    if (success) {
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
      if (editingPortfolioId === id) resetPortfolioForm();
    } else if (deleteError) {
      setPortfolioError(deleteError.message);
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
      case 'REVIEWED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
      case 'withdrawn':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingRequests = bookings.filter((b) => b.status === 'PENDING');
  const activeJobs = bookings.filter((b) => ['ACCEPTED', 'IN_PROGRESS'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'REVIEWED');
  const acceptedForRate = bookings.filter((b) =>
    ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED'].includes(b.status)
  );
  const completionRate = calculateCompletionRate(completedBookings.length, acceptedForRate.length);
  const completionPct =
    acceptedForRate.length === 0 ? null : Math.round(completionRate * 100);
  const pendingApps = applications.filter((a) => a.status === 'pending');
  const unreadNotifications = notifications.filter((n) => !n.read_at).length;

  const checklist = [
    { id: 'bio', label: 'Bio', done: !!(rawWorkerProfile?.bio || user?.bio), to: '/profile/edit' },
    {
      id: 'skills',
      label: 'Skills',
      done: (rawWorkerProfile?.skills?.length || 0) > 0,
      to: '/profile/edit',
    },
    {
      id: 'rates',
      label: 'Pricing',
      done: !!(rawWorkerProfile?.hourly_rate_min || rawWorkerProfile?.hourly_rate_max),
      to: '/profile/edit',
    },
    { id: 'portfolio', label: 'Portfolio item', done: portfolios.length > 0, tab: 'portfolio' as const },
    {
      id: 'kyc',
      label: 'KYC docs',
      done: kycVerified || kycStatus === 'approved' || kycStatus === 'pending',
      to: '/profile/edit',
    },
    {
      id: 'location',
      label: 'Location',
      done: !!(rawWorkerProfile?.location || user?.location),
      to: '/profile/edit',
    },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;

  const subLabel =
    subscriptionStatus === 'active'
      ? subscription?.tier || 'active'
      : subscriptionStatus === 'expiring'
        ? `${subscription?.tier || 'Plan'} (expiring)`
        : subscriptionStatus === 'expired'
          ? 'Expired'
          : 'Free';

  const kycLabel =
    kycVerified || kycStatus === 'approved'
      ? 'Verified'
      : kycStatus === 'pending'
        ? 'Pending review'
        : kycStatus === 'rejected'
          ? 'Needs resubmit'
          : 'Not started';

  const shareWorkerProfile: WorkerProfile = workerProfile ?? {
    id: user?.id || '',
    userId: user?.id || '',
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Pro Worker',
    role: user?.specialties?.[0] || 'Skilled Technician',
    location: user?.location || 'Accra',
    country: user?.country || 'GH',
    avatarUrl:
      user?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'Pro')}&background=random`,
    bio: user?.bio || '',
    hourlyRate: {
      min: 15,
      max: 45,
      currency: user?.country === 'GH' ? 'GHS' : 'NGN',
    },
    rating: user?.rating || 5.0,
    reviewCount: user?.reviewCount || 0,
    skills: user?.specialties || [],
    tier: (user?.tier as any) || 'free',
    verified: user?.workerStatus === 'active',
    reviews: [],
  };

  if (loading) {
    return (
      <>
        <PageHelmet title="Worker Hub" path="/dashboard/worker" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Worker Hub" path="/dashboard/worker" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6 md:mb-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-forge-orange mb-1">
                Worker OS
              </p>
              <h1 className="text-2xl font-bold text-forge-navy">Worker Hub</h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">
                Welcome back, {user?.firstName || 'Pro'} — run your business: requests, jobs, portfolio, and
                growth.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:items-end shrink-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Link
                  to="/jobs"
                  className="bg-forge-orange text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-orange-600 transition-colors"
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="sm:hidden">Jobs</span>
                  <span className="hidden sm:inline">Browse Jobs</span>
                </Link>
                <Link
                  to="/profile/edit"
                  className="bg-forge-navy text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-forge-orange transition-colors"
                >
                  <Star className="w-4 h-4" />
                  <span className="sm:hidden">Profile</span>
                  <span className="hidden sm:inline">Grow profile</span>
                </Link>
                {/* Desktop: compact secondary in same row */}
                <button
                  type="button"
                  onClick={() => setActiveTab('portfolio')}
                  className="hidden md:inline-flex bg-white text-forge-navy border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Portfolio
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('share')}
                  className="hidden md:inline-flex bg-white text-forge-navy border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <Link
                  to="/subscription"
                  className="hidden md:inline-flex bg-white text-forge-navy border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium items-center gap-1.5 hover:bg-gray-50 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade
                </Link>
              </div>
              {/* Mobile: secondary as compact text links */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm md:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('portfolio')}
                  className="text-gray-600 hover:text-forge-orange font-medium"
                >
                  Portfolio
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('share')}
                  className="text-gray-600 hover:text-forge-orange font-medium"
                >
                  Share
                </button>
                <Link to="/subscription" className="text-gray-600 hover:text-forge-orange font-medium">
                  Upgrade
                </Link>
              </div>
            </div>
          </div>

          <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
            {(['overview', 'portfolio', 'share'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
                  activeTab === tab
                    ? 'border-forge-orange text-forge-orange'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'portfolio' ? 'Manage Portfolio' : 'Share & QR Code'}
              </button>
            ))}
          </div>

          {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Link
                  to="/bookings"
                  className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-yellow-400 hover:shadow-md transition-shadow block"
                >
                  <div className="text-gray-500 text-sm mb-1">Pending requests</div>
                  <div className="text-3xl font-bold text-gray-900">{pendingRequests.length}</div>
                  <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                    Respond <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
                <Link
                  to="/bookings"
                  className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-orange hover:shadow-md transition-shadow block"
                >
                  <div className="text-gray-500 text-sm mb-1">Active jobs</div>
                  <div className="text-3xl font-bold text-gray-900">{activeJobs.length}</div>
                  <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                    Track <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
                <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-green">
                  <div className="text-gray-500 text-sm mb-1">Completed</div>
                  <div className="text-3xl font-bold text-gray-900">{completedBookings.length}</div>
                  <span className="text-xs text-gray-400 mt-2 block">
                    {completionPct === null
                      ? 'Completion rate — n/a yet'
                      : `${completionPct}% completion rate`}
                  </span>
                </div>
                <Link
                  to="/wallet"
                  className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow block"
                >
                  <div className="text-gray-500 text-sm mb-1">Earnings estimate</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {earningsCurrency} {earningsEstimate.toLocaleString()}
                  </div>
                  <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                    Open wallet <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>

              <div className="mb-6">
                <BookingTrendBars points={bookingTrend} label="Your bookings (last 14 days)" />
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-forge-orange shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Subscription</p>
                    <p className="font-semibold text-forge-navy capitalize">{subLabel}</p>
                    {subscription?.expires_at && subscriptionStatus !== 'none' && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Renews/expires {new Date(subscription.expires_at).toLocaleDateString()}
                      </p>
                    )}
                    <Link to="/subscription" className="text-xs text-forge-orange font-medium hover:underline">
                      {subscriptionStatus === 'active' || subscriptionStatus === 'expiring'
                        ? 'Manage plan'
                        : 'Upgrade visibility'}
                    </Link>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-forge-green shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">KYC status</p>
                    <p className="font-semibold text-forge-navy">{kycLabel}</p>
                    <Link to="/profile/edit" className="text-xs text-forge-orange font-medium hover:underline">
                      {kycVerified || kycStatus === 'approved' ? 'View verification' : 'Upload documents'}
                    </Link>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Availability</p>
                    <p className="font-semibold text-forge-navy">
                      {acceptingWork ? 'Accepting work' : 'Paused'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {rawWorkerProfile?.hourly_rate_min != null
                        ? `${rawWorkerProfile.currency || earningsCurrency} ${rawWorkerProfile.hourly_rate_min}–${rawWorkerProfile.hourly_rate_max || '—'}/hr`
                        : 'Set rates in profile'}
                    </p>
                    <Link to="/profile/edit" className="text-xs text-forge-orange font-medium hover:underline">
                      Edit pricing
                    </Link>
                  </div>
                </div>
              </div>

              {/* Profile completeness */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-8 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-forge-navy">Profile completeness</h2>
                  <span className="text-sm text-gray-500">
                    {checklistDone}/{checklist.length}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-forge-orange rounded-full transition-all"
                    style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                  />
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.tab) setActiveTab(item.tab);
                        else if (item.to) navigate(item.to);
                      }}
                      className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg border ${
                        item.done
                          ? 'border-emerald-100 bg-emerald-50/50 text-emerald-800'
                          : 'border-gray-100 hover:border-forge-orange/40 text-gray-600'
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle className="w-4 h-4 text-forge-green shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {recommendedJobs.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-lg text-gray-900">Recommended for you</h2>
                    <Link to="/jobs" className="text-forge-orange text-sm font-medium hover:underline flex items-center gap-1">
                      Job Feed <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {recommendedJobs.map((job) => (
                      <Link
                        key={job.id}
                        to={`/jobs/${job.id}`}
                        className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {job.category} · {job.location} · {job.matchReason}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-forge-orange shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="font-bold text-lg text-gray-900">My applications</h2>
                    <Link
                      to="/jobs"
                      className="text-forge-orange text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                    >
                      Browse jobs <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {applications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="mb-3">No applications yet</p>
                        <Link to="/jobs" className="text-forge-orange text-sm font-medium hover:underline">
                          Browse Job Feed
                        </Link>
                      </div>
                    ) : (
                      applications.slice(0, 5).map((app) => (
                        <Link
                          key={app.id}
                          to={app.job_id ? `/jobs/${app.job_id}` : '/jobs'}
                          className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}
                              >
                                {app.status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(app.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 mt-1 font-medium truncate">
                              {app.job?.title || 'Open project'}
                            </p>
                            {app.message && (
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{app.message}</p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-forge-orange shrink-0" />
                        </Link>
                      ))
                    )}
                  </div>
                  {pendingApps.length > 0 && (
                    <div className="px-4 py-2 bg-yellow-50 text-xs text-yellow-800 border-t border-yellow-100">
                      {pendingApps.length} awaiting customer review
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="font-bold text-lg text-gray-900">Inbound bookings</h2>
                    <Link
                      to="/bookings"
                      className="text-forge-orange text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
                    >
                      View bookings <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {bookings.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="mb-3">No booking requests yet</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('share')}
                          className="text-forge-orange text-sm font-medium hover:underline"
                        >
                          Share your profile
                        </button>
                      </div>
                    ) : (
                      bookings.slice(0, 4).map((booking) => (
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
                              <span className="text-xs text-gray-400">
                                {new Date(booking.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                              {booking.customer_message || 'No message'}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-forge-orange shrink-0" />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                      Notifications
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
                      <div className="p-6 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No new notifications</p>
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
                              <p className="text-xs text-gray-500 line-clamp-1">{notification.body}</p>
                            </div>
                            {!notification.read_at && (
                              <button
                                onClick={() => handleMarkNotificationRead(notification.id)}
                                className="text-gray-400 hover:text-gray-600 p-1"
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

                <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-forge-orange" />
                    <h2 className="font-bold text-lg text-gray-900">Messages</h2>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{unreadMessages}</p>
                  <p className="text-sm text-gray-500 mb-4">unread conversations</p>
                  <Link
                    to="/messages"
                    className="inline-flex items-center gap-1 text-forge-orange text-sm font-medium hover:underline"
                  >
                    Open inbox <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {(!subscription || subscription.tier === 'free' || subscriptionStatus === 'none') && (
                <div className="mt-6 bg-gradient-to-r from-forge-navy to-slate-900 rounded-2xl shadow-lg overflow-hidden text-white p-8 relative">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Star className="w-6 h-6 text-forge-orange fill-forge-orange" />
                      <span className="font-bold uppercase tracking-widest text-xs">Premium Forge</span>
                    </div>
                    <h2 className="font-bold text-2xl mb-2">Boost your business visibility</h2>
                    <p className="text-gray-300 max-w-lg mb-6">
                      Paid tiers activate via Paystack webhook only. Upgrade to appear higher in search.
                    </p>
                    <Link
                      to="/subscription"
                      className="bg-forge-orange text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-600 transition-all inline-block shadow-lg shadow-forge-orange/20"
                    >
                      Upgrade to Premium
                    </Link>
                  </div>
                  <Zap className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 rotate-12" />
                </div>
              )}
            </>
          )}

          {activeTab === 'portfolio' && (
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-1 h-fit">
                <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                  {editingPortfolioId ? (
                    <>
                      <Pencil className="w-5 h-5 text-forge-orange" /> Edit Project
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-forge-orange" /> Add Project
                    </>
                  )}
                </h2>
                <form onSubmit={handleCreatePortfolio} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                    <input
                      type="text"
                      value={portfolioTitle}
                      onChange={(e) => setPortfolioTitle(e.target.value)}
                      placeholder="e.g. Modern Kitchen Wiring"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-forge-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={portfolioDesc}
                      onChange={(e) => setPortfolioDesc(e.target.value)}
                      placeholder="Describe what work you did..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-forge-orange resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
                    <input
                      ref={portfolioFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePortfolioFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => portfolioFileRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-forge-orange hover:bg-orange-50/40 transition-colors flex flex-col items-center gap-2"
                    >
                      {portfolioPreview ? (
                        <img src={portfolioPreview} alt="" className="w-full h-28 object-cover rounded-lg" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-400" />
                          <span className="text-sm text-gray-500">Upload a photo of your work</span>
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">Or paste an image URL below (optional)</p>
                    <input
                      type="text"
                      value={portfolioMedia}
                      onChange={(e) => setPortfolioMedia(e.target.value)}
                      placeholder="https://..."
                      className="w-full mt-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-forge-orange"
                    />
                  </div>
                  {portfolioError && <p className="text-red-500 text-xs">{portfolioError}</p>}
                  <div className="flex gap-2">
                    {editingPortfolioId && (
                      <button
                        type="button"
                        onClick={resetPortfolioForm}
                        className="flex-1 border border-gray-200 text-gray-700 font-medium py-2 px-4 rounded-xl hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={portfolioLoading}
                      className="flex-1 bg-forge-navy hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {portfolioLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : editingPortfolioId ? (
                        <Pencil className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {editingPortfolioId ? 'Save changes' : 'Add to Portfolio'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-forge-orange" /> Portfolio Projects (
                    {portfolios.length})
                  </h2>
                  {portfolios.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="italic">No portfolio items yet. Add your first project using the form.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {portfolios.map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 relative group"
                        >
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            <button
                              onClick={() => startEditPortfolio(item)}
                              className="bg-white/90 hover:bg-white text-forge-navy p-1.5 rounded-full shadow"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePortfolio(item.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {item.media_urls && item.media_urls.length > 0 && (
                            <img
                              src={item.media_urls[0]}
                              alt={item.title}
                              className="w-full h-32 object-cover bg-gray-200"
                            />
                          )}
                          <div className="p-4">
                            <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                            {item.description && (
                              <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-forge-green" /> Professional Endorsements (
                    {endorsements.length})
                  </h2>
                  {endorsements.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm italic">You haven&apos;t received any pro endorsements yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {endorsements.map((endorsement) => (
                        <div
                          key={endorsement.id}
                          className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50"
                        >
                          <p className="text-gray-700 italic text-sm">
                            &quot;{endorsement.endorsement_text}&quot;
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <img
                              src={
                                endorsement.profiles?.avatar_url ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(endorsement.profiles?.first_name || 'Pro')}&background=random`
                              }
                              alt="Referrer avatar"
                              className="w-6 h-6 rounded-full object-cover bg-gray-200"
                            />
                            <div>
                              <span className="text-xs font-bold text-gray-900">
                                {endorsement.profiles?.first_name} {endorsement.profiles?.last_name}
                              </span>
                              <span className="text-[10px] text-gray-500 block">
                                Verified {endorsement.profiles?.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="max-w-2xl mx-auto">
              <p className="text-sm text-gray-500 mb-4 text-center">
                Share your FORGE profile link or QR code to win more bookings.
              </p>
              <ShareTools worker={shareWorkerProfile} usernameSlug={user?.username} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WorkerDashboard;
