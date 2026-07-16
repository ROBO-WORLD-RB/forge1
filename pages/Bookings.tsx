import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getBookingsByCustomer, 
  getBookingsByWorker, 
  acceptBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  getBookingDetails
} from '../services/bookingService';
import type { Booking, BookingStatus } from '../types/database';
import { 
  Briefcase, Clock, CheckCircle, XCircle, Play, 
  Loader2, MessageSquare, Calendar, Star, AlertCircle, RefreshCw
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';
import ReviewModal from '../components/ReviewModal';

const Bookings: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  const isWorker = user?.role === 'worker';

  useEffect(() => {
    if (!user?.id) return;
    fetchBookings();
  }, [user?.id, statusFilter]);

  const fetchBookings = async () => {
    if (!user?.id) return;
    setLoading(true);
    setFetchError(null);
    
    const status = statusFilter === 'all' ? undefined : statusFilter;
    const result = isWorker 
      ? await getBookingsByWorker(user.id, status)
      : await getBookingsByCustomer(user.id, status);
    
    if (result.error) {
      setFetchError(result.error.message || 'Failed to load bookings.');
      setBookings([]);
    } else if (result.data) {
      setBookings(result.data);
    }
    setLoading(false);
  };

  const runAction = async (
    bookingId: string,
    action: () => Promise<{ data?: Booking | null; error?: { message?: string } | null }>
  ) => {
    setActionLoading(bookingId);
    setActionError(null);
    const result = await action();
    if (result.data) {
      setBookings(prev => prev.map(b => b.id === bookingId ? result.data! : b));
    } else if (result.error) {
      setActionError(result.error.message || 'Action failed. Please try again.');
    }
    setActionLoading(null);
  };

  const handleAccept = (bookingId: string) =>
    runAction(bookingId, () => acceptBooking(bookingId, 'I accept this booking'));

  const handleStart = (bookingId: string) =>
    runAction(bookingId, () => startBooking(bookingId));

  const handleComplete = (bookingId: string) =>
    runAction(bookingId, () => completeBooking(bookingId));

  const handleCancel = async (bookingId: string) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;
    runAction(bookingId, () => cancelBooking(bookingId, reason));
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'REVIEWED': return 'bg-emerald-100 text-emerald-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: BookingStatus) => {
    const workerLabels: Record<BookingStatus, string> = {
      PENDING: 'Awaiting your response',
      ACCEPTED: 'Ready to start',
      IN_PROGRESS: 'Work in progress',
      COMPLETED: 'Awaiting customer review',
      REVIEWED: 'Reviewed',
      CANCELLED: 'Cancelled',
    };
    const customerLabels: Record<BookingStatus, string> = {
      PENDING: 'Waiting for worker',
      ACCEPTED: 'Worker accepted',
      IN_PROGRESS: 'Work in progress',
      COMPLETED: 'Ready to review',
      REVIEWED: 'Reviewed',
      CANCELLED: 'Cancelled',
    };
    return (isWorker ? workerLabels : customerLabels)[status];
  };

  const getFilterLabel = (status: BookingStatus | 'all') => {
    if (status === 'all') return 'All';
    const shortLabels: Record<BookingStatus, string> = {
      PENDING: 'Pending',
      ACCEPTED: 'Accepted',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      REVIEWED: 'Reviewed',
      CANCELLED: 'Cancelled',
    };
    return shortLabels[status];
  };

  const canMessage = (status: BookingStatus) => status !== 'CANCELLED';

  const getStatusIcon = (status: BookingStatus) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-5 h-5" />;
      case 'ACCEPTED': return <CheckCircle className="w-5 h-5" />;
      case 'IN_PROGRESS': return <Play className="w-5 h-5" />;
      case 'COMPLETED': return <CheckCircle className="w-5 h-5" />;
      case 'REVIEWED': return <CheckCircle className="w-5 h-5" />;
      case 'CANCELLED': return <XCircle className="w-5 h-5" />;
      default: return <Briefcase className="w-5 h-5" />;
    }
  };

  const statuses: (BookingStatus | 'all')[] = ['all', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'CANCELLED'];

  const handleReviewSuccess = () => {
    if (!reviewBooking) return;
    setBookings(prev =>
      prev.map(b => b.id === reviewBooking.id ? { ...b, status: 'REVIEWED' as BookingStatus } : b)
    );
    setReviewBooking(null);
  };

  return (
    <>
    <PageHelmet title="My Bookings" path="/bookings" />
    <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-forge-navy">My Bookings</h1>
          <p className="text-gray-500 mt-1">
            {isWorker ? 'Manage your service requests' : 'Track your booked services'}
          </p>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-forge-orange text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {getFilterLabel(status)}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {actionError}
            </span>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 text-xs font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Bookings List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl">
            <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Loading bookings...</p>
          </div>
        ) : fetchError ? (
          <div className="text-center py-12 bg-white rounded-xl px-6">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium text-forge-navy">Couldn&apos;t load bookings</p>
            <p className="text-gray-500 mt-1 text-sm">{fetchError}</p>
            <button
              onClick={fetchBookings}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl px-6">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-forge-navy">No bookings found</p>
            <p className="text-gray-500 mt-1 text-sm">
              {statusFilter !== 'all' 
                ? `No ${getFilterLabel(statusFilter).toLowerCase()} bookings` 
                : isWorker 
                  ? 'You haven\'t received any booking requests yet'
                  : 'You haven\'t made any bookings yet'}
            </p>
            {!isWorker && statusFilter === 'all' && (
              <Link 
                to="/search" 
                className="inline-block mt-4 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Find workers to book
              </Link>
            )}
            {isWorker && statusFilter === 'all' && (
              <Link 
                to="/jobs" 
                className="inline-block mt-4 text-forge-orange text-sm font-medium hover:underline"
              >
                Browse open projects
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusIcon(booking.status)}
                    </div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Booking #{booking.id.slice(0, 8)}
                      </p>
                      <Link
                        to={`/profile/${isWorker ? booking.customer_user_id : booking.worker_user_id}`}
                        className="text-sm text-forge-orange hover:underline mt-1 inline-block"
                      >
                        View {isWorker ? 'customer' : 'worker'} profile
                      </Link>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(booking.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                {booking.customer_message && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Customer message:</p>
                    <p className="text-sm text-gray-700">{booking.customer_message}</p>
                  </div>
                )}
                {booking.worker_message && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-blue-500 mb-1">Worker response:</p>
                    <p className="text-sm text-gray-700">{booking.worker_message}</p>
                  </div>
                )}
                {booking.cancellation_reason && (
                  <div className="bg-red-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-red-500 mb-1">Cancellation reason:</p>
                    <p className="text-sm text-gray-700">{booking.cancellation_reason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {isWorker && booking.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleAccept(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Accept
                        </button>
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {isWorker && booking.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleStart(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start Work
                      </button>
                    )}
                    {isWorker && booking.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleComplete(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Mark Complete
                      </button>
                    )}
                    {!isWorker && ['PENDING', 'ACCEPTED'].includes(booking.status) && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Cancel Booking
                      </button>
                    )}
                    {!isWorker && booking.status === 'COMPLETED' && (
                      <button
                        onClick={() => setReviewBooking(booking)}
                        className="px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
                      >
                        <Star className="w-4 h-4" />
                        Leave Review
                      </button>
                    )}
                    {!isWorker && booking.status === 'REVIEWED' && (
                      <span className="px-3 py-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        Review submitted
                      </span>
                    )}
                  </div>
                  {canMessage(booking.status) ? (
                    <Link
                      to="/messages"
                      state={{
                        recipientId: isWorker ? booking.customer_user_id : booking.worker_user_id,
                        bookingId: booking.id,
                      }}
                      className="flex items-center gap-2 text-forge-orange hover:underline text-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">Messaging unavailable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {reviewBooking && (
      <ReviewModal
        bookingId={reviewBooking.id}
        workerUserId={reviewBooking.worker_user_id}
        isOpen={!!reviewBooking}
        onClose={() => setReviewBooking(null)}
        onSuccess={handleReviewSuccess}
      />
    )}
    </>
  );
};

export default Bookings;
