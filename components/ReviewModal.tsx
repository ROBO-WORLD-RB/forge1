import React, { useState } from 'react';
import { X, Star, AlertCircle } from 'lucide-react';
import Button from './Button';
import { useAuth } from '../context/AuthContext';
import { createReview } from '../services/reviewService';
import { supabase } from '../services/supabase';

interface ReviewModalProps {
  bookingId: string;
  workerUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  bookingId,
  workerUserId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const MAX_COMMENT_LENGTH = 500;

  if (!isOpen) return null;

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setText('');
    setError(null);
    setRatingError(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (rating < 1) {
      setRatingError(true);
      setError('Please select a star rating before submitting.');
      return;
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      setError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }

    setError(null);
    setRatingError(false);
    setSubmitting(true);

    const { data: workerProfile, error: profileError } = await (supabase
      .from('worker_profiles') as any)
      .select('id')
      .eq('user_id', workerUserId)
      .single();

    if (profileError || !workerProfile) {
      setError('Could not find worker profile');
      setSubmitting(false);
      return;
    }

    const result = await createReview(
      bookingId,
      user.id,
      workerProfile.id,
      rating,
      text.trim() || undefined
    );

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSuccess();
    handleClose();
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-forge-navy">Leave a Review</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Rating <span className="text-red-500">*</span>
            </p>
            <div className={`flex gap-1 p-2 rounded-xl transition-colors ${ratingError ? 'bg-red-50 ring-2 ring-red-200' : ''}`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setRating(star);
                    setRatingError(false);
                    if (error?.includes('star rating')) setError(null);
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= displayRating
                        ? 'text-forge-orange fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {ratingError && (
              <p className="text-xs text-red-500 mt-1.5">Tap a star to rate your experience</p>
            )}
            {rating > 0 && !ratingError && (
              <p className="text-xs text-gray-500 mt-1.5">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="review-text" className="block text-sm font-medium text-gray-700 mb-1.5">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="review-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error?.includes('characters')) setError(null);
              }}
              placeholder="Share your experience..."
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              className={`w-full rounded-xl border-2 bg-white px-4 py-3 focus:outline-none focus:ring-4 focus:ring-forge-orange/5 placeholder:text-gray-400 font-medium resize-none ${
                text.length > MAX_COMMENT_LENGTH
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-gray-100 focus:border-forge-orange'
              }`}
            />
            <p className={`text-xs mt-1 text-right ${text.length > MAX_COMMENT_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
              {text.length}/{MAX_COMMENT_LENGTH}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button fullWidth onClick={handleSubmit} loading={submitting} disabled={rating < 1}>
              Submit Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
