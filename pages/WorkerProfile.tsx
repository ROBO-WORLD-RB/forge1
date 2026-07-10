import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProfile, getProfileByUsername, getPortfolioItems, getEndorsements } from '../services/workerService';
import { getReviewsForWorker } from '../services/reviewService';
import { supabase } from '../services/supabase';
import Button from '../components/Button';
import BookingModal from '../components/BookingModal';
import ShareTools from '../components/ShareTools';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, MapPin, Star, MessageSquare, Flag, Loader2, Image as ImageIcon, ThumbsUp } from 'lucide-react';
import type { WorkerProfile as DBWorkerProfile } from '../types/database';
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
  const { isAuthenticated } = useAuth();
  
  const targetIdentifier = username || id;
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [endorsements, setEndorsements] = useState<any[]>([]);
  const [usernameSlug, setUsernameSlug] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetIdentifier) {
        setError('Profile identifier is required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let profileResult;

        if (username) {
          profileResult = await getProfileByUsername(targetIdentifier);
        } else {
          profileResult = await getProfile(targetIdentifier);
        }

        const { data, error: fetchError } = profileResult;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        if (!data) {
          setError('Worker profile not found');
          return;
        }

        const mapped = mapToAppWorkerProfile(data);
        setUsernameSlug(data.profiles?.username || '');

        const [portfoliosRes, endorsementsRes, reviewsRes] = await Promise.all([
          getPortfolioItems(data.user_id),
          getEndorsements(data.user_id),
          getReviewsForWorker(data.id),
        ]);

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
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetIdentifier]);

  const handleBookClick = () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: window.location.pathname } });
    } else {
      setIsBookingOpen(true);
    }
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
  if (error || !worker) {
    return (
      <>
        <PageHelmet title="Worker Profile" path="/profile/:id" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {error || 'Worker not found'}
            </h2>
            <p className="text-gray-500 mb-6">
              The profile you're looking for doesn't exist or couldn't be loaded.
            </p>
            <Button onClick={() => navigate('/search')}>
              Back to Search
            </Button>
          </div>
        </div>
      </>
    );
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

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {worker.location}
                  </div>
                  <div className="flex items-center gap-1 text-forge-orange font-bold bg-orange-50 px-2 py-1 rounded">
                    <Star className="w-4 h-4 fill-current" /> {worker.rating} ({worker.reviewCount} reviews)
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mt-8 border-t border-gray-100 pt-6">
              <Button size="lg" variant="primary" onClick={handleBookClick}>Book Now</Button>
              <Button size="lg" variant="secondary" icon={<MessageSquare className="w-4 h-4" />} onClick={handleMessageClick}>Message</Button>
            </div>

            {/* Booking Modal */}
            <BookingModal
              worker={worker}
              isOpen={isBookingOpen}
              onClose={() => setIsBookingOpen(false)}
              onSuccess={() => {
                setIsBookingOpen(false);
                navigate('/bookings');
              }}
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

              {/* Right Column: Stats & Share Tools */}
              <div className="space-y-6">
                {/* Share Tools Component */}
                <ShareTools worker={worker} usernameSlug={usernameSlug} />

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <h4 className="font-bold text-gray-900 mb-4">Availability</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mon - Fri</span>
                      <span className="font-medium">8:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saturday</span>
                      <span className="font-medium">9:00 AM - 4:00 PM</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Sunday</span>
                      <span>Closed</span>
                    </div>
                  </div>
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
