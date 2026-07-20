import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, Clock, CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import type { WorkerProfile } from '../types';
import type { PaystackTransaction } from '../types/payment';
import type { Booking } from '../types/database';
import {
  initializePayment,
  createBookingPayment,
  calculateBookingTotal,
  formatCurrency,
  fromSmallestUnit,
} from '../services/paystackService';
import { createDirectBooking } from '../services/bookingService';
import { logTransaction } from '../services/paymentWebhookService';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

const BOOKING_RETRY_ATTEMPTS = 3;
const BOOKING_RETRY_BASE_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface BookingSuccessResult {
  transaction: PaystackTransaction;
  booking: Booking;
}

interface BookingModalProps {
  worker: WorkerProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: BookingSuccessResult) => void;
}

type BookingStep = 'details' | 'processing' | 'success' | 'error';

const BookingModal: React.FC<BookingModalProps> = ({ worker, isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<BookingStep>('details');
  const [hours, setHours] = useState(1);
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<PaystackTransaction | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const hourlyRate = worker.hourlyRate.min;
  const total = calculateBookingTotal(hours, hourlyRate);
  const formattedTotal = formatCurrency(total, worker.hourlyRate.currency);

  const finalizeBooking = async (txn: PaystackTransaction) => {
    if (!user?.id) {
      setError('You must be logged in to complete a booking.');
      setStep('error');
      return;
    }

    setTransaction(txn);
    setStep('processing');
    setError(null);

    const payment = {
      reference: txn.reference,
      amount: fromSmallestUnit(txn.amount),
      currency: txn.currency,
      provider: 'paystack',
    };

    const bookingInput = {
      customerId: user.id,
      workerUserId: worker.userId,
      workerName: worker.name,
      workerRole: worker.role,
      location: worker.location,
      country: worker.country,
      hours,
      hourlyRate,
      currency: worker.hourlyRate.currency,
      scheduledDate,
      description: description || undefined,
      payment,
    };

    let lastError: string | null = null;

    for (let attempt = 0; attempt < BOOKING_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(BOOKING_RETRY_BASE_DELAY_MS * attempt);
      }

      try {
        const bookingResult = await createDirectBooking(bookingInput);

        if (bookingResult.data) {
          setCreatedBooking(bookingResult.data.booking);
          setStep('success');
          onSuccess?.({ transaction: txn, booking: bookingResult.data.booking });
          return;
        }

        lastError =
          bookingResult.error?.message ||
          'We could not create your booking. Your card was charged — please do not pay again.';
      } catch (err) {
        lastError =
          err instanceof Error
            ? err.message
            : 'Unexpected error while creating your booking.';
        logger.error('createDirectBooking attempt failed', {
          attempt: attempt + 1,
          reference: txn.reference,
          error: lastError,
        });
      }
    }

    const logResult = await logTransaction(
      user.id,
      'booking',
      payment.amount,
      payment.currency,
      'paystack',
      'success',
      {
        booking_failed: true,
        worker_user_id: worker.userId,
        scheduled_date: scheduledDate,
        hours,
      },
      txn.reference
    );

    if (logResult.error) {
      logger.warn('Could not log orphaned payment transaction', {
        reference: txn.reference,
        error: logResult.error.message,
      });
    }

    setError(lastError);
    setStep('error');
  };

  const handleRetryBooking = async () => {
    if (!transaction) return;
    setIsRetrying(true);
    setError(null);
    setStep('processing');
    try {
      await finalizeBooking(transaction);
    } finally {
      setIsRetrying(false);
    }
  };

  const handlePayment = async () => {
    if (!user?.id) {
      setError('You must be logged in to book a worker');
      return;
    }
    if (!email) {
      setError('Email is required for payment');
      return;
    }
    if (!scheduledDate) {
      setError('Please select a date');
      return;
    }

    setError(null);
    setStep('processing');

    try {
      const paymentParams = createBookingPayment({
        workerId: worker.userId,
        workerName: worker.name,
        customerEmail: email,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
        customerId: user.id,
        hours,
        hourlyRate,
        currency: worker.hourlyRate.currency,
        scheduledDate,
        description,
      });

      await initializePayment(
        paymentParams,
        (txn) => {
          void finalizeBooking(txn);
        },
        () => {
          setStep('details');
        }
      );
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('details');
    setError(null);
    setTransaction(null);
    setCreatedBooking(null);
    setIsRetrying(false);
    onClose();
  };

  // Get minimum date (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'success' ? 'Booking Confirmed!' : `Book ${worker.name}`}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'details' && (
            <div className="space-y-4">
              {/* Worker Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <img
                  src={worker.avatarUrl}
                  alt={worker.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900">{worker.name}</p>
                  <p className="text-sm text-gray-500">{worker.role}</p>
                </div>
              </div>

              {/* Email */}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Scheduled Date
                </label>
                <input
                  type="date"
                  min={minDateStr}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forge-orange focus:border-transparent"
                  required
                />
              </div>

              {/* Hours Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Hours Needed
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setHours(Math.max(1, hours - 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="text-xl font-bold w-12 text-center">{hours}</span>
                  <button
                    onClick={() => setHours(Math.min(12, hours + 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    +
                  </button>
                  <span className="text-gray-500 text-sm">
                    @ {formatCurrency(hourlyRate, worker.hourlyRate.currency)}/hr
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work you need done..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forge-orange focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-forge-navy/5 rounded-xl">
                <span className="font-medium text-gray-700">Total</span>
                <span className="text-2xl font-bold text-forge-navy">{formattedTotal}</span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                <p className="font-semibold">What happens after you pay</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                  <li>Paystack confirms your payment</li>
                  <li>We create a booking request for {worker.name}</li>
                  <li>They accept or decline — you track it in My Bookings</li>
                </ol>
                <p className="text-blue-700/80 pt-1">
                  Escrow wallet release is not live yet; this payment records your booking intent.
                </p>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handlePayment}
                size="lg"
                className="w-full"
                icon={<CreditCard className="w-5 h-5" />}
              >
                Pay with Paystack
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Secure payment powered by Paystack
              </p>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-forge-orange animate-spin mx-auto mb-4" />
              <p className="text-gray-600">
                {isRetrying ? 'Retrying your booking...' : 'Processing your booking...'}
              </p>
            </div>
          )}

          {step === 'success' && transaction && createdBooking && (
            <div className="py-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Booking request sent</h3>
              <p className="text-gray-600 mb-4">
                Payment succeeded. {worker.name} has been notified and needs to accept before work starts.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-yellow-700">Waiting for worker</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Booking ID</span>
                  <span className="font-mono text-xs">{createdBooking.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="font-mono text-xs break-all">{transaction.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">{formattedTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span>{scheduledDate}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-6">
                <Button
                  onClick={() => {
                    handleClose();
                    navigate('/bookings');
                  }}
                  className="w-full"
                >
                  View My Bookings
                </Button>
                <Button onClick={handleClose} variant="secondary" className="w-full">
                  Close
                </Button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {transaction ? 'Booking Could Not Be Completed' : 'Payment Failed'}
              </h3>
              {transaction && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left text-sm space-y-2">
                  <p className="text-amber-900 font-medium">Your payment was successful.</p>
                  <div className="flex justify-between gap-2">
                    <span className="text-amber-800">Payment reference</span>
                    <span className="font-mono text-amber-950 break-all">{transaction.reference}</span>
                  </div>
                  <p className="text-amber-800">
                    Please contact support with this reference. Do not attempt to pay again — we will
                    resolve your booking manually.
                  </p>
                </div>
              )}
              <p className="text-gray-600 mb-4">{error || 'Something went wrong. Please try again.'}</p>
              <div className="flex flex-col gap-2">
                {transaction && (
                  <Button onClick={handleRetryBooking} loading={isRetrying} className="w-full">
                    Retry booking (no extra charge)
                  </Button>
                )}
                <Button
                  onClick={transaction ? handleClose : () => setStep('details')}
                  variant="secondary"
                  className="w-full"
                >
                  {transaction ? 'Close' : 'Try Again'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
