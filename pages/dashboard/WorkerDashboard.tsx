import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookingsByWorker } from '../../services/bookingService';
import { getNotifications, markNotificationRead } from '../../services/notificationService';
import { getActiveSubscription, checkSubscriptionStatus } from '../../services/subscriptionService';
import { getUnreadCount } from '../../services/chatService';
import { getPortfolioItems, createPortfolioItem, deletePortfolioItem, getEndorsements, getProfileByUserId } from '../../services/workerService';
import ShareTools from '../../components/ShareTools';
import type { Booking, Notification as DBNotification, Subscription } from '../../types/database';
import type { WorkerProfile, WorkerTier } from '../../types';
import { 
  Clock, CheckCircle, AlertCircle, Briefcase, MessageSquare, 
  Bell, CreditCard, ChevronRight, Loader2, X, Star,
  Calendar, MapPin, DollarSign, Zap, Image as ImageIcon, Share2, Plus, Trash2, Upload
} from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';
import { uploadPublicFile } from '../../utils/storageUpload';

const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'share'>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Portfolio states
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDesc, setPortfolioDesc] = useState('');
  const [portfolioMedia, setPortfolioMedia] = useState('');
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const portfolioFileRef = useRef<HTMLInputElement>(null);

  // Endorsement states
  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [bookingsResult, notifResult, subResult, status, unreadResult, portfolioResult, endorsementsResult, workerProfileResult] = await Promise.all([
          getBookingsByWorker(user.id),
          getNotifications(user.id),
          getActiveSubscription(user.id),
          checkSubscriptionStatus(user.id),
          getUnreadCount(user.id),
          getPortfolioItems(user.id),
          getEndorsements(user.id),
          getProfileByUserId(user.id),
        ]);
        
        if (bookingsResult.data) setBookings(bookingsResult.data);
        if (notifResult.data) setNotifications(notifResult.data.slice(0, 5));
        if (subResult.data) setSubscription(subResult.data);
        setSubscriptionStatus(status);
        if (unreadResult.data !== null) setUnreadMessages(unreadResult.data);
        if (portfolioResult.data) setPortfolios(portfolioResult.data);
        if (endorsementsResult.data) setEndorsements(endorsementsResult.data);

        if (workerProfileResult.data) {
          const wp = workerProfileResult.data;
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
              currency: wp.currency || (wp.country === 'GH' ? 'GHS' : 'NGN'),
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
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
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

      const { data, error: createError } = await createPortfolioItem(user.id, {
        title: portfolioTitle,
        description: portfolioDesc,
        media_urls: [mediaUrl],
      });

      if (createError) {
        setPortfolioError(createError.message);
      } else if (data) {
        setPortfolios(prev => [data, ...prev]);
        setPortfolioTitle('');
        setPortfolioDesc('');
        setPortfolioMedia('');
        setPortfolioFile(null);
        setPortfolioPreview(null);
        if (portfolioFileRef.current) portfolioFileRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Portfolio upload error:', err);
      setPortfolioError(
        err?.message?.includes('timed out')
          ? 'Image upload timed out. Check your connection and try again.'
          : err?.message || 'Failed to add portfolio item.'
      );
    } finally {
      setPortfolioLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    const { data: success, error: deleteError } = await deletePortfolioItem(id);
    if (success) {
      setPortfolios(prev => prev.filter(p => p.id !== id));
    } else if (deleteError) {
      setPortfolioError(deleteError.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeBookings = bookings.filter(b => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status)).length;
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'REVIEWED').length;
  const unreadNotifications = notifications.filter(n => !n.read_at).length;

  // Map user object to WorkerProfile shape for ShareTools
  const shareWorkerProfile: WorkerProfile = workerProfile ?? {
    id: user?.id || '',
    userId: user?.id || '',
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Pro Worker',
    role: user?.specialties?.[0] || 'Skilled Technician',
    location: user?.location || 'Accra',
    country: user?.country || 'GH',
    avatarUrl: user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'Pro')}&background=random`,
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
        <PageHelmet title="Worker Dashboard" path="/dashboard/worker" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Worker Dashboard" path="/dashboard/worker" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-forge-navy">
              Worker Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Welcome back, {user?.firstName || 'Pro'}! Manage your bookings and earnings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link 
              to="/bookings" 
              className="bg-white text-forge-navy border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              My Bookings
            </Link>
            <Link 
              to="/jobs" 
              className="bg-forge-orange text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              Browse Projects
            </Link>
            <Link 
              to="/profile/edit" 
              className="bg-white text-forge-navy border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Grow your reach
            </Link>
            <Link 
              to={`/pro/${user?.username?.replace(/^@/, '') || user?.id}`} 
              className="bg-white text-forge-navy border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              View Public Page
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-forge-orange text-forge-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'portfolio'
                ? 'border-forge-orange text-forge-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Manage Portfolio
          </button>
          <button
            onClick={() => setActiveTab('share')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'share'
                ? 'border-forge-orange text-forge-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Share & QR Code
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}

        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Link
                to="/bookings"
                className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-orange hover:shadow-md transition-shadow block"
              >
                <div className="text-gray-500 text-sm mb-1">Active Bookings</div>
                <div className="text-3xl font-bold text-gray-900">{activeBookings}</div>
                <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                  Track bookings <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
              <Link
                to="/bookings"
                className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-green hover:shadow-md transition-shadow block"
              >
                <div className="text-gray-500 text-sm mb-1">Completed</div>
                <div className="text-3xl font-bold text-gray-900">{completedBookings}</div>
                <span className="text-xs text-forge-orange font-medium mt-2 inline-flex items-center gap-0.5">
                  View bookings <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
                <div className="text-gray-500 text-sm mb-1">Unread Messages</div>
                <div className="text-3xl font-bold text-gray-900">{unreadMessages}</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-500">
                <div className="text-gray-500 text-sm mb-1">Subscription</div>
                <div className="text-lg font-bold text-gray-900 capitalize">
                  {subscription?.tier || 'Free'}
                  {subscriptionStatus === 'expiring' && (
                    <span className="text-xs text-yellow-600 ml-2">Expiring soon</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Bookings */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <h2 className="font-bold text-lg text-gray-900">My Bookings</h2>
                  <Link to="/bookings" className="text-forge-orange text-sm font-medium hover:underline flex items-center gap-1 shrink-0">
                    View bookings <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {bookings.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="mb-3">No booking requests yet</p>
                      <Link to="/bookings" className="text-forge-orange text-sm font-medium hover:underline">
                        Track bookings
                      </Link>
                    </div>
                  ) : (
                    bookings.slice(0, 4).map(booking => (
                      <Link
                        key={booking.id}
                        to="/bookings"
                        className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
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
                    Notifications
                    {unreadNotifications > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {unreadNotifications}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No new notifications</p>
                    </div>
                  ) : (
                    notifications.map(notification => (
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
            </div>

            {/* Upgrade Banner */}
            {(!subscription || subscription.tier === 'free') && (
              <div className="mt-6 bg-gradient-to-r from-forge-navy to-slate-900 rounded-2xl shadow-lg overflow-hidden text-white p-8 relative">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-6 h-6 text-forge-orange fill-forge-orange" />
                    <span className="font-bold uppercase tracking-widest text-xs">Premium Forge</span>
                  </div>
                  <h2 className="font-bold text-2xl mb-2">Boost your business visibility</h2>
                  <p className="text-gray-300 max-w-lg mb-6">
                    Premium workers appear first in search results and get 5x more job invitations.
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

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Add Portfolio Form */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-1 h-fit">
              <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-forge-orange" /> Add Project
              </h2>
              <form onSubmit={handleCreatePortfolio} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                  <input
                    type="text"
                    value={portfolioTitle}
                    onChange={e => setPortfolioTitle(e.target.value)}
                    placeholder="e.g. Modern Kitchen Wiring"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-forge-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={portfolioDesc}
                    onChange={e => setPortfolioDesc(e.target.value)}
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
                    onChange={e => setPortfolioMedia(e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-forge-orange"
                  />
                </div>
                {portfolioError && <p className="text-red-500 text-xs">{portfolioError}</p>}
                <button
                  type="submit"
                  disabled={portfolioLoading}
                  className="w-full bg-forge-navy hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {portfolioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to Portfolio
                </button>
              </form>
            </div>

            {/* List of projects */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-forge-orange" /> Portfolio Projects ({portfolios.length})
                </h2>
                {portfolios.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="italic">No portfolio items found. Add your first project using the form.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {portfolios.map(item => (
                      <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 relative group">
                        <button
                          onClick={() => handleDeletePortfolio(item.id)}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

              {/* Endorsements section */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                <h2 className="font-bold text-lg text-forge-navy mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-forge-green" /> Professional Endorsements ({endorsements.length})
                </h2>
                {endorsements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm italic">You haven't received any pro endorsements yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {endorsements.map(endorsement => (
                      <div key={endorsement.id} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                        <p className="text-gray-700 italic text-sm">"{endorsement.endorsement_text}"</p>
                        <div className="mt-3 flex items-center gap-2">
                          <img
                            src={endorsement.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(endorsement.profiles?.first_name || 'Pro')}&background=random`}
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

        {/* Share Tab */}
        {activeTab === 'share' && (
          <div className="max-w-2xl mx-auto">
            <ShareTools worker={shareWorkerProfile} usernameSlug={user?.username} />
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default WorkerDashboard;
