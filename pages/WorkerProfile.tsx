import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  resolvePublicProfile,
  getPortfolioItems,
  getEndorsements,
  calculateCompletionRate,
} from '../services/workerService';
import { getReviewsForWorker } from '../services/reviewService';
import { isFavorite, toggleFavorite } from '../services/favoriteService';
import { getBookingsByWorker } from '../services/bookingService';
import { supabase } from '../services/supabase';
import Button from '../components/Button';
import BookingModal from '../components/BookingModal';
import ShareTools from '../components/ShareTools';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, MapPin, Star, MessageSquare, Loader2, Image as ImageIcon, ThumbsUp, Heart, BadgeCheck } from 'lucide-react';
import type { Profile as DBProfile } from '../types/database';
import type { WorkerProfile, WorkerTier, Review as AppReview } from '../types';
import PageHelmet from '../components/PageHelmet';

/**
 * Convert database WorkerProfile to app WorkerProfile type
 */
function mapToAppWorkerProfile(dbProfile: any): WorkerProfile {
  return {
    id: dbProfile.id,
    userId: dbProfile.user_id,
    name: dbProfile.name,
    role: dbProfile.role,
    location: dbProfile.location,
    country: dbProfile.country,
    avatarUrl: dbProfile.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbProfile.name)}&background=random`,
    bio: dbProfile.bio || '',
    hourlyRate: {
      min: dbProfile.hourly_rate_min || 0,
      max: dbProfile.hourly_rate_max || 0,
      currency: dbProfile.currency || (dbProfile.country === 'GH' ? 'GHS' : 'NGN'),
    },
    rating: dbProfile.rating,
    reviewCount: dbProfile.review_count,
    skills: dbProfile.skills || [],
    tier: dbProfile.tier as WorkerTier,
    verified: dbProfile.verified,
    reviews: [], // Reviews are fetched separately
    experienceYears: dbProfile.experience_years || undefined,
  };
}

const WorkerProfilePage: React.FC = () => {
  const { id, username } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  
  const targetIdentifier = username || id;
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [customerProfile, setCustomerProfile] = useState<DBProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [usernameSlug, setUsernameSlug] = useState<string>('');
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [completionPct, setCompletionPct] = useState<number | null>(null);
  const [acceptingWork, setAcceptingWork] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetIdentifier) {
        setError('Profile identifier is required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setWorker(null);
      setCustomerProfile(null);

      try {
        const profileResult = await resolvePublicProfile(targetIdentifier);
        const { data, error: fetchError } = profileResult;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        if (!data) {
          setError('Profile not found');
          return;
        }

        if (data.kind === 'customer') {
          setCustomerProfile(data.profile);
          return;
        }

        const mapped = mapToAppWorkerProfile(data.profile);
        setUsernameSlug(data.profile.profiles?.username || '');
        setAcceptingWork(data.profile.accepting_work !== false);

        const isOwnProfile = user?.id === data.profile.user_id;
        const [portfoliosRes, endorsementsRes, reviewsRes, bookingsRes] = await Promise.all([
          getPortfolioItems(data.profile.user_id),
          getEndorsements(data.profile.user_id),
          getReviewsForWorker(data.profile.id),
          isOwnProfile ? getBookingsByWorker(data.profile.user_id) : Promise.resolve({ data: null, error: null }),
        ]);

        if (isOwnProfile && bookingsRes.data) {
          const accepted = bookingsRes.data.filter((b) =>
            ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED'].includes(b.status)
          );
          const completed = bookingsRes.data.filter((b) =>
            ['COMPLETED', 'REVIEWED'].includes(b.status)
          );
          if (accepted.length > 0) {
            setCompletionPct(Math.round(calculateCompletionRate(completed.length, accepted.length) * 100));
          } else {
            setCompletionPct(null);
          }
        } else {
          setCompletionPct(null);
        }

        if (portfoliosRes.data) {
          setPortfolios(portfoliosRes.data);
        }
        if (endorsementsRes.data) {
          setEndorsements(endorsementsRes.data);
        }

        if (reviewsRes.data) {
          const authorIds = [...new Set(reviewsRes.data.reviews.map(r => r.author_id))];
          const authorNames: Record<string, string> = {};

          if (authorIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', authorIds);

            for (const p of profiles || []) {
              authorNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Customer';
            }
          }

          mapped.reviews = reviewsRes.data.reviews.map((r): AppReview => ({
            id: r.id,
            author: authorNames[r.author_id] || 'Customer',
            rating: r.rating,
            text: r.text || '',
            date: new Date(r.created_at).toLocaleDateString(),
          }));
        } else if (reviewsRes.error) {
          console.warn('Could not load reviews:', reviewsRes.error.message);
        }

        setWorker(mapped);

        if (isAuthenticated && user?.id && user.id !== mapped.userId) {
          const favRes = await isFavorite(user.id, mapped.userId);
          if (favRes.data !== null) setFavorited(favRes.data);
        } else {
          setFavorited(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetIdentifier, isAuthenticated, user?.id]);

  // Deep-link: ?book=1 opens booking modal (e.g. Book again from My Bookings)
  useEffect(() => {
    if (!worker || loading) return;
    if (searchParams.get('book') !== '1') return;
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `${window.location.pathname}?book=1` } });
      return;
    }
    setIsBookingOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('book');
    setSearchParams(next, { replace: true });
  }, [worker, loading, searchParams, isAuthenticated, navigate, setSearchParams]);

  const handleBookClick = () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: window.location.pathname } });
    } else {
      setIsBookingOpen(true);
    }
  };

  const handleFavoriteClick = async () => {
    if (!worker) return;
    if (!isAuthenticated || !user?.id) {
      navigate('/auth/login', { state: { from: window.location.pathname } });
      return;
    }
    if (user.id === worker.userId) return;
    setFavoriteLoading(true);
    const result = await toggleFavorite(user.id, worker.userId);
    if (result.data) setFavorited(result.data.favorited);
    setFavoriteLoading(false);
  };

  const handleMessageClick = () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: window.location.pathname } });
    } else {
      navigate('/messages', { state: { recipientId: worker?.userId } });
    }
  };

  // Loading state
  if (loading) {
    return (
      <>
        <PageHelmet title="Worker Profile" path="/profile/:id" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  // Error state
  if (error || (!worker && !customerProfile)) {
    return (
      <>
        <PageHelmet title="Profile" path="/profile/:id" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {error || 'Profile not found'}
            </h2>
            <p className="text-gray-500 mb-6">
              The profile you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Go Back
              </Button>
              <Button onClick={() => navigate('/search')}>
                Find Workers
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Customer account (no worker_profiles row)
  if (customerProfile) {
    const fullName = [customerProfile.first_name, customerProfile.last_name]
      .filter(Boolean)
      .join(' ') || 'Customer';
    const avatarUrl = customerProfile.avatar_url
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

    return (
      <>
        <PageHelmet title={fullName} path="/profile/:id" />
        <div className="min-h-dynamic bg-gray-50 pb-nav">
          <div className="h-48 bg-forge-navy relative">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
            >
              &larr; Back
            </button>
          </div>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 relative -mt-20">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-6 md:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-28 h-28 rounded-2xl border-4 border-white shadow-md object-cover bg-gray-200"
                />
                <div className="flex-1 space-y-2">
                  <h1 className="text-3xl font-bold text-gray-900">{fullName}</h1>
                  <p className="text-lg text-gray-600">Customer on FORGE</p>
                  {customerProfile.username && (
                    <span className="inline-block text-sm text-forge-orange bg-orange-50 px-2 py-0.5 rounded font-mono font-medium">
                      {customerProfile.username}
                    </span>
                  )}
                  {customerProfile.location && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {customerProfile.location}
                    </p>
                  )}
                </div>
              </div>
              {customerProfile.bio && (
                <p className="text-gray-600 leading-relaxed mt-6">{customerProfile.bio}</p>
              )}
              <p className="text-sm text-gray-500 mt-6 pt-6 border-t border-gray-100">
                This user has not set up a worker profile. You can still message them from your bookings.
              </p>
              {isAuthenticated && (
                <div className="mt-6">
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<MessageSquare className="w-4 h-4" />}
                    onClick={() => navigate('/messages', { state: { recipientId: customerProfile.id } })}
                  >
                    Message
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!worker) {
    return null;
  }

  return (
    <>
    <PageHelmet title="Worker Profile" path="/profile/:id" />
    <div className="min-h-dynamic bg-gray-50 pb-nav">
      {/* Header Background */}
      <div className="h-48 bg-forge-navy relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
        >
          &larr; Back
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative -mt-20">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 md:p-8">
            
            {/* Top Section */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <img 
                src={worker.avatarUrl} 
                alt={worker.name} 
                className="w-32 h-32 rounded-2xl border-4 border-white shadow-md object-cover bg-gray-200"
              />
              
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                      {worker.name}
                      {worker.verified && <span title="Verified Pro"><ShieldCheck className="w-6 h-6 text-forge-cyan" /></span>}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-lg text-gray-600 font-medium">{worker.role}</p>
                      {usernameSlug && (
                        <span className="text-sm text-forge-orange bg-orange-50 px-2 py-0.5 rounded font-mono font-medium">
                          {usernameSlug}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-forge-navy">
                      {worker.hourlyRate.currency} {worker.hourlyRate.min}-{worker.hourlyRate.max}
                      <span className="text-base font-normal text-gray-500">/hr</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {worker.location}
                  </div>
                  {worker.reviewCount > 0 ? (
                    <div className="flex items-center gap-1 text-forge-orange font-bold bg-orange-50 px-2 py-1 rounded">
                      <Star className="w-4 h-4 fill-current" /> {worker.rating.toFixed(1)} ({worker.reviewCount} review{worker.reviewCount === 1 ? '' : 's'})
                    </div>
                  ) : (
                    <div className="bg-gray-50 text-gray-500 px-2 py-1 rounded text-xs font-medium">
                      No reviews yet
                    </div>
                  )}
                  {worker.verified && (
                    <div className="flex items-center gap-1 text-forge-cyan bg-cyan-50 px-2 py-1 rounded text-xs font-bold">
                      <BadgeCheck className="w-3.5 h-3.5" /> KYC verified
                    </div>
                  )}
                  {worker.tier === 'premium' && (
                    <div className="bg-orange-50 text-forge-orange px-2 py-1 rounded text-xs font-bold uppercase">
                      Premium
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 border-t border-gray-100 pt-6">
              <Button size="lg" variant="primary" onClick={handleBookClick}>Book Now</Button>
              <Button size="lg" variant="secondary" icon={<MessageSquare className="w-4 h-4" />} onClick={handleMessageClick}>Message</Button>
              {user?.id !== worker.userId && (
                <Button
                  size="lg"
                  variant={favorited ? 'primary' : 'outline'}
                  icon={<Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />}
                  onClick={handleFavoriteClick}
                  loading={favoriteLoading}
                  className="col-span-2 sm:col-span-1"
                >
                  {favorited ? 'Saved' : 'Save'}
                </Button>
              )}
            </div>

            {/* Booking Modal */}
            <BookingModal
              worker={worker}
              isOpen={isBookingOpen}
              onClose={() => setIsBookingOpen(false)}
            />

            {/* Tabs / Content */}
            <div className="mt-10 grid md:grid-cols-3 gap-8">
              
              {/* Left Column: Bio, Skills, Portfolio, Endorsements */}
              <div className="md:col-span-2 space-y-8">
                <section>
                  <h3 className="text-lg font-bold text-forge-navy mb-3">About Me</h3>
                  <p className="text-gray-600 leading-relaxed">
                    {worker.bio || 'No bio available.'}
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-forge-navy mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {worker.skills.length > 0 ? (
                      worker.skills.map(skill => (
                        <span key={skill} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">No skills listed.</p>
                    )}
                  </div>
                </section>

                {/* Portfolio Showcase Section */}
                <section className="border-t border-gray-100 pt-6">
                  <h3 className="text-lg font-bold text-forge-navy mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-forge-orange" />
                    <span>Project Showcase</span>
                  </h3>
                  {portfolios.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {portfolios.map(item => (
                        <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                          {item.media_urls && item.media_urls.length > 0 && (
                            <img
                              src={item.media_urls[0]}
                              alt={item.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-40 object-cover bg-gray-200"
                            />
                          )}
                          <div className="p-4">
                            <h4 className="font-bold text-gray-950 text-sm">{item.title}</h4>
                            {item.description && (
                              <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                      <p className="text-gray-400 text-sm">No portfolio items uploaded yet.</p>
                    </div>
                  )}
                </section>

                {/* Peer Endorsements Section */}
                <section className="border-t border-gray-100 pt-6">
                  <h3 className="text-lg font-bold text-forge-navy mb-4 flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-forge-green" />
                    <span>Professional Endorsements</span>
                  </h3>
                  {endorsements.length > 0 ? (
                    <div className="space-y-4">
                      {endorsements.map(endorsement => (
                        <div key={endorsement.id} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                          <p className="text-gray-700 italic text-sm">"{endorsement.endorsement_text}"</p>
                          <div className="mt-3 flex items-center gap-2">
                            <img
                              src={endorsement.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(endorsement.profiles?.first_name || 'Pro')}&background=random`}
                              alt="Referrer avatar"
                              loading="lazy"
                              decoding="async"
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
                  ) : (
                    <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                      <p className="text-gray-400 text-sm">No peer endorsements yet.</p>
                    </div>
                  )}
                </section>

                {/* Reviews Section */}
                <section className="border-t border-gray-100 pt-6">
                  <h3 className="text-lg font-bold text-forge-navy mb-4">Reviews</h3>
                  {worker.reviews.length > 0 ? (
                    <div className="space-y-4">
                      {worker.reviews.map(review => (
                        <div key={review.id} className="bg-gray-50 p-4 rounded-xl">
                          <div className="flex justify-between mb-2">
                            <span className="font-bold text-gray-900">{review.author}</span>
                            <span className="text-xs text-gray-500">{review.date}</span>
                          </div>
                          <div className="flex text-forge-warning mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`} />
                            ))}
                          </div>
                          <p className="text-gray-600 text-sm">{review.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">No reviews yet.</p>
                  )}
                </section>
              </div>

              {/* Right Column: Trust signals & Share Tools */}
              <div className="space-y-6">
                <ShareTools worker={worker} usernameSlug={usernameSlug} />

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <h4 className="font-bold text-gray-900 mb-4">Trust signals</h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Identity / KYC</span>
                      <span className={`font-medium text-right ${worker.verified ? 'text-forge-cyan' : 'text-gray-500'}`}>
                        {worker.verified ? 'Verified' : 'Not verified yet'}
                      </span>
                    </li>
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Customer reviews</span>
                      <span className="font-medium text-right text-gray-900">
                        {worker.reviewCount > 0
                          ? `${worker.rating.toFixed(1)} · ${worker.reviewCount}`
                          : 'None yet'}
                      </span>
                    </li>
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Portfolio items</span>
                      <span className="font-medium text-gray-900">{portfolios.length}</span>
                    </li>
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Peer endorsements</span>
                      <span className="font-medium text-gray-900">{endorsements.length}</span>
                    </li>
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-medium text-gray-900 capitalize">{worker.tier}</span>
                    </li>
                    <li className="flex items-start justify-between gap-2">
                      <span className="text-gray-600">Availability</span>
                      <span className="font-medium text-gray-900">
                        {acceptingWork ? 'Accepting work' : 'Paused'}
                      </span>
                    </li>
                    {completionPct !== null && (
                      <li className="flex items-start justify-between gap-2">
                        <span className="text-gray-600">Completion rate</span>
                        <span className="font-medium text-gray-900">{completionPct}%</span>
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-gray-400 mt-4">
                    Only real DB signals — no placeholder hours or fake rates.
                  </p>
                </div>

                {worker.experienceYears && (
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-2">Experience</h4>
                    <p className="text-gray-600">{worker.experienceYears} years</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default WorkerProfilePage;
