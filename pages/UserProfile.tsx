import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Shield,
  ShieldCheck,
  Calendar,
  Edit3,
  Camera,
  LogOut,
  ChevronRight,
  MessageSquare,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { UserRole, WorkerTier } from '../types';
import PageHelmet from '../components/PageHelmet';
import { getReviewsByUser, getReviewsForWorker } from '../services/reviewService';
import { getProfileByUserId } from '../services/workerService';
import { supabase } from '../services/supabase';
import type { Review } from '../types/database';

type DisplayReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
};

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'settings'>('overview');
  const [reviews, setReviews] = useState<DisplayReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [workerProfileId, setWorkerProfileId] = useState<string | null>(null);
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [liveReviewCount, setLiveReviewCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        if (user.role === UserRole.WORKER) {
          const profileRes = await getProfileByUserId(user.id);
          if (profileRes.data) {
            setWorkerProfileId(profileRes.data.id);
            setLiveRating(profileRes.data.rating);
            setLiveReviewCount(profileRes.data.review_count);

            const reviewsRes = await getReviewsForWorker(profileRes.data.id, 20);
            if (reviewsRes.data?.reviews) {
              const authorIds = [...new Set(reviewsRes.data.reviews.map((r) => r.author_id))];
              const names: Record<string, string> = {};
              if (authorIds.length > 0) {
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, first_name, last_name')
                  .in('id', authorIds);
                for (const p of profiles || []) {
                  names[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Customer';
                }
              }
              setReviews(
                reviewsRes.data.reviews.map((r: Review) => ({
                  id: r.id,
                  author: names[r.author_id] || 'Customer',
                  rating: r.rating,
                  text: r.text || '',
                  date: new Date(r.created_at).toLocaleDateString(),
                }))
              );
            } else {
              setReviews([]);
            }
          } else {
            setReviews([]);
          }
        } else {
          // Customer: show reviews they have written
          const authored = await getReviewsByUser(user.id);
          if (authored.data && authored.data.length > 0) {
            setReviews(
              authored.data.map((r) => ({
                id: r.id,
                author: 'You',
                rating: r.rating,
                text: r.text || '',
                date: new Date(r.created_at).toLocaleDateString(),
              }))
            );
            setLiveReviewCount(authored.data.length);
            const avg =
              authored.data.reduce((sum, r) => sum + r.rating, 0) / authored.data.length;
            setLiveRating(avg);
          } else {
            setReviews([]);
            setLiveReviewCount(0);
            setLiveRating(null);
          }
        }
      } catch (err) {
        console.error('Failed to load reviews', err);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    void loadReviews();
  }, [user?.id, user?.role]);

  if (isLoading) {
    return (
      <>
        <PageHelmet title="My Profile" path="/my-profile" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-orange" />
        </div>
      </>
    );
  }

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  const username = user.username || `@${user.email?.split('@')[0] || 'user'}`;
  const avatarUrl =
    user.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=150`;
  const memberSince = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';
  const rating = liveRating ?? user.rating ?? 0;
  const reviewCount = liveReviewCount ?? user.reviewCount ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <PageHelmet title="My Profile" path="/my-profile" />
      <div className="min-h-dynamic bg-gray-50 pb-nav overflow-x-hidden">
        <div className="h-32 bg-gradient-to-r from-forge-navy to-forge-navy/80 relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
          >
            &larr; Back
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative -mt-16">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="w-24 h-24 rounded-2xl border-4 border-white shadow-md object-cover bg-gray-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=150`;
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => navigate('/profile/edit')}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-forge-orange text-white rounded-full flex items-center justify-center shadow-lg hover:bg-forge-orange/90 transition-colors"
                    aria-label="Edit profile photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  {user.tier === WorkerTier.PREMIUM && (
                    <div
                      className="absolute -top-1 -right-1 w-6 h-6 bg-forge-cyan rounded-full flex items-center justify-center"
                      title="Premium Member"
                    >
                      <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        {fullName}
                      </h1>
                      <p className="text-gray-500">{username}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit3 className="w-4 h-4" />}
                      onClick={() => navigate('/profile/edit')}
                    >
                      Edit Profile
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                    {user.role === UserRole.WORKER && reviewCount > 0 && (
                      <div className="flex items-center gap-1 text-forge-orange font-bold bg-orange-50 px-2 py-1 rounded">
                        <Star className="w-4 h-4 fill-current" />
                        {rating.toFixed(1)} ({reviewCount} reviews)
                      </div>
                    )}
                    {user.role === UserRole.WORKER && reviewCount === 0 && (
                      <div className="text-gray-500 bg-gray-50 px-2 py-1 rounded text-xs">
                        No reviews yet
                      </div>
                    )}
                    {user.role === UserRole.CUSTOMER && (
                      <div className="text-gray-500 bg-gray-50 px-2 py-1 rounded text-xs">
                        {reviewCount > 0
                          ? `${reviewCount} review${reviewCount === 1 ? '' : 's'} written`
                          : 'No reviews written yet'}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      Member since {memberSince}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.role === UserRole.WORKER
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {user.role === UserRole.WORKER ? 'Worker' : 'Customer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-1 mt-6 border-b border-gray-100">
                {(['overview', 'reviews', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                      activeTab === tab ? 'text-forge-orange' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forge-orange" />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <section>
                      <h3 className="text-lg font-bold text-forge-navy mb-4">Contact Information</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="font-medium text-gray-900">{user.email || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Phone className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="font-medium text-gray-900">{user.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Location</p>
                            <p className="font-medium text-gray-900">
                              {user.location ||
                                (user.country === 'GH'
                                  ? 'Ghana'
                                  : user.country === 'NG'
                                    ? 'Nigeria'
                                    : 'Not provided')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Account Type</p>
                            <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {user.bio && (
                      <section>
                        <h3 className="text-lg font-bold text-forge-navy mb-3">About</h3>
                        <p className="text-gray-600 leading-relaxed">{user.bio}</p>
                      </section>
                    )}

                    {user.role === UserRole.WORKER && (
                      <section>
                        <h3 className="text-lg font-bold text-forge-navy mb-4">Reputation</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-gray-50 rounded-xl">
                            <p className="text-2xl font-bold text-forge-navy">
                              {reviewCount > 0 ? rating.toFixed(1) : '—'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Average rating</p>
                          </div>
                          <div className="text-center p-4 bg-gray-50 rounded-xl">
                            <p className="text-2xl font-bold text-forge-navy">{reviewCount}</p>
                            <p className="text-xs text-gray-500 mt-1">Reviews received</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          Stats come from completed bookings only
                          {workerProfileId ? '' : '. Finish your worker profile to collect reviews.'}
                        </p>
                      </section>
                    )}

                    {user.role === UserRole.CUSTOMER && (
                      <section>
                        <h3 className="text-lg font-bold text-forge-navy mb-3">Hiring shortcuts</h3>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to="/search"
                            className="px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-bold hover:bg-orange-600"
                          >
                            Find Workers
                          </Link>
                          <Link
                            to="/jobs?create=1"
                            className="px-4 py-2 bg-gray-100 text-forge-navy rounded-lg text-sm font-bold hover:bg-gray-200"
                          >
                            Post a Project
                          </Link>
                          <Link
                            to="/bookings"
                            className="px-4 py-2 bg-gray-100 text-forge-navy rounded-lg text-sm font-bold hover:bg-gray-200"
                          >
                            My Bookings
                          </Link>
                        </div>
                      </section>
                    )}

                    {user.role === UserRole.WORKER && (
                      <section>
                        <h3 className="text-lg font-bold text-forge-navy mb-4">Subscription</h3>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              user.tier === WorkerTier.PREMIUM ? 'bg-cyan-100' : 'bg-gray-100'
                            }`}
                          >
                            {user.tier === WorkerTier.PREMIUM ? (
                              <ShieldCheck className="w-6 h-6 text-forge-cyan" />
                            ) : (
                              <Shield className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {user.tier === WorkerTier.PREMIUM
                                ? 'Premium Member'
                                : user.tier === WorkerTier.BASIC
                                  ? 'Basic Plan'
                                  : 'Free Plan'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {user.tier === WorkerTier.PREMIUM
                                ? 'Premium visibility and features'
                                : 'Upgrade for higher search visibility'}
                            </p>
                          </div>
                          {user.tier !== WorkerTier.PREMIUM && (
                            <Button size="sm" variant="primary" onClick={() => navigate('/subscription')}>
                              Upgrade
                            </Button>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {reviewsLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
                      </div>
                    ) : reviews.length > 0 ? (
                      <>
                        {user.role === UserRole.WORKER && (
                          <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl mb-2">
                            <div className="text-center">
                              <p className="text-4xl font-bold text-forge-orange">{rating.toFixed(1)}</p>
                              <div className="flex text-forge-orange mt-1 justify-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(rating) ? 'fill-current' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-600">
                                Based on {reviewCount} real review{reviewCount === 1 ? '' : 's'} from
                                completed bookings
                              </p>
                            </div>
                          </div>
                        )}
                        {user.role === UserRole.CUSTOMER && (
                          <p className="text-sm text-gray-500 mb-2">
                            Reviews you have left for workers after completed jobs.
                          </p>
                        )}
                        {reviews.map((review) => (
                          <div key={review.id} className="p-4 bg-gray-50 rounded-xl">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-500" />
                                </div>
                                <span className="font-medium text-gray-900">{review.author}</span>
                              </div>
                              <span className="text-xs text-gray-500">{review.date}</span>
                            </div>
                            <div className="flex text-forge-orange mb-2">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                            <p className="text-gray-600 text-sm">
                              {review.text || 'No written comment.'}
                            </p>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-900 font-medium">No reviews yet</p>
                        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                          {user.role === UserRole.WORKER
                            ? 'Reviews appear here after customers complete bookings and leave feedback.'
                            : 'After a booking is completed, you can leave a review from My Bookings.'}
                        </p>
                        {user.role === UserRole.CUSTOMER && (
                          <Link
                            to="/bookings"
                            className="inline-block mt-4 text-forge-orange text-sm font-bold hover:underline"
                          >
                            Go to My Bookings
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <button
                      type="button"
                      onClick={() => navigate('/profile/edit')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">Edit Profile</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/settings/privacy')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">Privacy & Security</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/notifications')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">Notifications</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="border-t border-gray-100 my-4" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-4 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserProfile;
