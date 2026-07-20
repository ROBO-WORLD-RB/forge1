import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJob, deleteJob, updateJobStatus } from '../services/jobService';
import { getBookingsByJob } from '../services/bookingService';
import {
  applyToJob,
  getApplicationForJob,
  getApplicationsByJob,
} from '../services/jobApplicationService';
import { draftQuoteWithAI } from '../services/aiMatchService';
import type { Job, Booking, JobApplication } from '../types/database';
import { CATEGORIES } from '../constants';
import { 
  ArrowLeft, Briefcase, MapPin, DollarSign, Calendar, 
  Trash2, Loader2, Play, X, ChevronLeft, ChevronRight,
  Users, Send, CheckCircle, MessageSquare, AlertCircle, RefreshCw, Sparkles
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [draftingQuote, setDraftingQuote] = useState(false);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [existingApplication, setExistingApplication] = useState<JobApplication | null>(null);
  const [jobBookings, setJobBookings] = useState<Booking[]>([]);
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  useEffect(() => {
    if (id) fetchJob();
  }, [id]);

  useEffect(() => {
    if (!id || !job) return;
    if (user?.id === job.poster_user_id) {
      fetchJobBookings();
      fetchJobApplications();
    } else if (user?.role === 'worker' && user.id) {
      checkWorkerApplication();
    }
  }, [id, job?.id, job?.poster_user_id, user?.id, user?.role]);

  const fetchJob = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const result = await getJob(id);
    if (result.error) {
      setError(result.error.message || 'Failed to load job details.');
    } else if (result.data) {
      setJob(result.data);
    } else {
      setError('Job not found');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!job || !confirm('Are you sure you want to delete this job?')) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteJob(job.id);
    if (!result.error) {
      navigate('/jobs');
    } else {
      setDeleteError(result.error.message || 'Failed to delete job');
    }
    setDeleting(false);
  };

  const handleStatusChange = async (status: 'open' | 'filled' | 'cancelled') => {
    if (!job) return;
    setStatusUpdating(true);
    setStatusError(null);
    const result = await updateJobStatus(job.id, status);
    if (result.data) {
      setJob(result.data);
    } else if (result.error) {
      setStatusError(result.error.message || 'Failed to update job status');
    }
    setStatusUpdating(false);
  };

  const fetchJobBookings = async () => {
    if (!id) return;
    setBookingsLoading(true);
    const result = await getBookingsByJob(id, 'PENDING');
    if (result.data) {
      setJobBookings(result.data);
    }
    setBookingsLoading(false);
  };

  const fetchJobApplications = async () => {
    if (!id) return;
    const result = await getApplicationsByJob(id, 'pending');
    if (result.data) {
      setJobApplications(result.data);
    }
  };

  const checkWorkerApplication = async () => {
    if (!id || !user?.id) return;
    const appResult = await getApplicationForJob(id, user.id);
    if (appResult.data) {
      setExistingApplication(appResult.data);
    }
    const result = await getBookingsByJob(id);
    if (result.data) {
      const mine = result.data.find(b => b.worker_user_id === user.id);
      if (mine) setExistingBooking(mine);
    }
  };

  const handleApply = async () => {
    if (!job || !user?.id) return;
    setApplying(true);
    setApplyError(null);
    const result = await applyToJob(job.id, user.id, applyMessage || undefined);
    if (result.error) {
      setApplyError(result.error.message);
    } else if (result.data) {
      setExistingApplication(result.data.application);
      if (result.data.booking) setExistingBooking(result.data.booking);
    }
    setApplying(false);
  };

  const hasApplied = !!existingApplication || !!existingBooking;

  const isOwner = user?.id === job?.poster_user_id;
  const isWorker = user?.role === 'worker';
  const canMessagePoster =
    !!user &&
    !isOwner &&
    !!job?.poster_user_id &&
    job.poster_user_id !== user.id;
  const categorySlug = CATEGORIES.find(c => c.title === job?.category)?.id || '';
  const workersSearchUrl = categorySlug ? `/search?category=${categorySlug}` : '/search';
  const mediaUrls = job?.media_urls || [];

  const handleMessagePoster = () => {
    if (!job?.poster_user_id) return;
    navigate('/messages', {
      state: {
        recipientId: job.poster_user_id,
        bookingId: existingBooking?.id,
      },
    });
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'filled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'filled': return 'Filled';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getBookingStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Awaiting review';
      case 'ACCEPTED': return 'Accepted';
      case 'IN_PROGRESS': return 'In progress';
      case 'COMPLETED': return 'Completed';
      case 'REVIEWED': return 'Reviewed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  const getApplicationStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Awaiting review';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Not selected';
      case 'withdrawn': return 'Withdrawn';
      default: return status;
    }
  };

  const pendingApplications =
    jobApplications.length > 0
      ? jobApplications
      : jobBookings.map((b) => ({
          id: b.id,
          worker_user_id: b.worker_user_id,
          message: b.customer_message,
          status: 'pending' as const,
          booking_id: b.id,
        }));

  if (loading) {
    return (
      <>
        <PageHelmet title="Project Details" path="/jobs/:id" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Loading project details...</p>
        </div>
      </>
    );
  }

  if (error || !job) {
    return (
      <>
        <PageHelmet title="Project Details" path="/jobs/:id" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-lg font-medium text-forge-navy mb-1">
            {error === 'Job not found' ? 'Job not found' : 'Couldn\'t load job'}
          </p>
          <p className="text-red-600 text-sm mb-4 text-center max-w-sm">{error || 'This job may have been removed.'}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchJob}
              className="inline-flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <Link to="/jobs" className="text-forge-orange hover:underline text-sm font-medium">Back to Projects</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Project Details" path="/jobs/:id" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Projects
        </button>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Media Gallery */}
          {mediaUrls.length > 0 && (
            <div className="relative bg-gray-900">
              <div className="aspect-video relative">
                {isVideo(mediaUrls[mediaIndex]) ? (
                  <video
                    src={mediaUrls[mediaIndex]}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={mediaUrls[mediaIndex]}
                    alt={`Job media ${mediaIndex + 1}`}
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => setShowLightbox(true)}
                  />
                )}
              </div>
              
              {/* Navigation Arrows */}
              {mediaUrls.length > 1 && (
                <>
                  <button
                    onClick={() => setMediaIndex(i => (i - 1 + mediaUrls.length) % mediaUrls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setMediaIndex(i => (i + 1) % mediaUrls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Thumbnails */}
              {mediaUrls.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {mediaUrls.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setMediaIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        idx === mediaIndex ? 'border-forge-orange' : 'border-transparent'
                      }`}
                    >
                      {isVideo(url) ? (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Job Details */}
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {job.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.location}, {job.country === 'GH' ? '🇬🇭 Ghana' : '🇳🇬 Nigeria'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Posted {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {isOwner && (
                <div className="flex flex-col items-end gap-2">
                  {deleteError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {deleteError}
                    </p>
                  )}
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Budget */}
            {(job.budget_min || job.budget_max) && (
              <div className="flex items-center gap-2 mb-6 p-4 bg-green-50 rounded-xl">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">
                  Budget: {job.currency} {job.budget_min?.toLocaleString()} - {job.budget_max?.toLocaleString()}
                </span>
              </div>
            )}

            {/* Description */}
            {job.description && (
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Owner: find workers & pending applications */}
            {isOwner && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="font-medium text-gray-900 mb-3">Find Workers</h3>
                <Link
                  to={workersSearchUrl}
                  className="inline-flex items-center gap-2 text-forge-orange hover:underline font-medium"
                >
                  <Users className="w-4 h-4" />
                  Browse {job.category} professionals
                </Link>

                {bookingsLoading ? (
                  <div className="flex items-center gap-2 mt-4 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading applications...
                  </div>
                ) : pendingApplications.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Pending Applications ({pendingApplications.length})
                    </h4>
                    <div className="space-y-3">
                      {pendingApplications.map((app) => (
                        <div key={app.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <Link
                              to={`/profile/${app.worker_user_id}`}
                              className="font-medium text-forge-orange hover:underline"
                            >
                              View worker profile
                            </Link>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                              {app.status === 'pending'
                                ? 'Awaiting review'
                                : getApplicationStatusLabel(app.status)}
                            </span>
                          </div>
                          {app.message && (
                            <p className="text-sm text-gray-600 mt-2 flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              {app.message}
                            </p>
                          )}
                          <Link
                            to="/bookings"
                            className="text-sm text-gray-500 hover:text-gray-700 mt-2 inline-block"
                          >
                            Manage in Bookings →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : job.status === 'open' ? (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">No applications yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Workers who apply will appear here.</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Owner Actions */}
            {isOwner && job.status === 'open' && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="font-medium text-gray-900 mb-3">Manage Job</h3>
                {statusError && (
                  <div className="mb-3 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {statusError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange('filled')}
                    disabled={statusUpdating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {statusUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Mark as Filled
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={statusUpdating}
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel Job
                  </button>
                </div>
              </div>
            )}

            {/* Worker apply flow */}
            {!isOwner && isWorker && user && job.status === 'open' && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                {hasApplied ? (
                  <div className="p-4 bg-green-50 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">Application submitted</p>
                      <p className="text-sm text-green-700 mt-1">
                        Status:{' '}
                        {existingBooking
                          ? getBookingStatusLabel(existingBooking.status)
                          : getApplicationStatusLabel(existingApplication?.status || 'pending')}
                        . The job poster will review your request.
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Tip: send a short message so the customer can reply quickly.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <button
                          type="button"
                          onClick={handleMessagePoster}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Message job poster
                        </button>
                        <Link to="/bookings" className="text-sm text-forge-orange hover:underline">
                          View in My Bookings →
                        </Link>
                        <Link to="/dashboard/worker" className="text-sm text-gray-500 hover:underline">
                          Worker Hub
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-gray-900 mb-1">Apply for this job</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Introduce yourself, then message the poster if you have questions.
                    </p>
                    <div className="flex justify-end mb-2">
                      <button
                        type="button"
                        disabled={draftingQuote}
                        onClick={async () => {
                          if (!job) return;
                          setDraftingQuote(true);
                          setApplyError(null);
                          const { text, error } = await draftQuoteWithAI({
                            title: job.title,
                            description: job.description,
                            category: job.category,
                            location: job.location,
                            country: job.country,
                            budgetMin: job.budget_min,
                            budgetMax: job.budget_max,
                            currency: job.currency,
                          });
                          if (error) {
                            setApplyError(error);
                          } else if (text) {
                            setApplyMessage(text);
                          }
                          setDraftingQuote(false);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-forge-navy bg-orange-50 border border-forge-orange/20 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                      >
                        {draftingQuote ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-forge-orange" />
                        )}
                        Generate quote
                      </button>
                    </div>
                    <textarea
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                      placeholder="Introduce yourself and explain why you're a good fit..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-forge-orange mb-3 resize-none"
                    />
                    <p className="text-[11px] text-gray-400 mb-3">
                      AI drafts text only — review before sending. Not a payment or invoice.
                    </p>
                    {applyError && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {applyError}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleApply}
                        disabled={applying}
                        className="flex-1 py-3 bg-forge-orange text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {applying ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Submit application
                          </>
                        )}
                      </button>
                      {canMessagePoster && (
                        <button
                          type="button"
                          onClick={handleMessagePoster}
                          className="flex-1 py-3 border border-forge-orange text-forge-orange rounded-xl font-medium hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-5 h-5" />
                          Message poster
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Contact job poster (customers / other roles, or workers when job is not open) */}
            {canMessagePoster && !(isWorker && job.status === 'open') && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <button
                  type="button"
                  onClick={handleMessagePoster}
                  className="w-full py-3 bg-forge-orange text-white rounded-xl font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  Message Job Poster
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={mediaUrls[mediaIndex]}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
    </>
  );
};

export default JobDetail;
