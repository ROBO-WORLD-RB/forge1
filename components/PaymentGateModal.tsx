import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initializePayment, generateReference } from '../services/paystackService';
import { getUserProfile } from '../services/authService';
import Button from './Button';
import { Smartphone, ShieldCheck, Briefcase, CheckCircle, Zap, Loader2 } from 'lucide-react';

/**
 * PaymentGateModal
 * Non-dismissible overlay that blocks dashboard access until the worker
 * completes a GHC 10 mobile money onboarding payment via Paystack.
 */
const PaymentGateModal: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handlePayment = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const country = (user as any).country || 'GH';
      const currency = country === 'GH' ? 'GHS' : 'NGN';
      const amount = country === 'GH' ? 10 : 2000;

      await initializePayment(
        {
          email: user.email || '',
          amount: amount * 100,
          currency,
          reference: generateReference('ONB'),
          metadata: {
            user_id: user.id,
            type: 'onboarding_fee',
          },
        },
        async (_transaction) => {
          try {
            for (let attempt = 0; attempt < 15; attempt++) {
              const profile = await getUserProfile(user!.id);
              if (profile?.worker_status === 'active') {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            setSuccess(true);
            await refreshUser();
          } catch (err: unknown) {
            setError(
              'Payment received. Activation may take a moment — refresh or contact support if access is not granted.'
            );
            console.error('Failed to confirm worker activation:', err);
          }
        },
        () => {
          setLoading(false);
        },
        { channels: ['mobile_money'] }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setLoading(false);
    }
  };

  // Success state — brief celebration before dashboard loads
  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-forge-navy mb-2">
            Payment Successful!
          </h1>
          <p className="text-gray-500 mb-6">
            Welcome to the Forge community. Your account is now active.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-forge-navy to-slate-900 px-8 pt-8 pb-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-forge-orange rounded-full opacity-10 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-forge-orange" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Activate Your Account
            </h1>
            <p className="text-gray-300 text-sm">
              One-time payment to unlock full platform access
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-5">
              {error}
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 bg-white rounded-lg shadow-sm flex items-center justify-center text-forge-navy flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-900">Verified Worker Badge</h3>
                <p className="text-xs text-gray-500">Stand out with a verified checkmark</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 bg-white rounded-lg shadow-sm flex items-center justify-center text-forge-navy flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-900">Receive Job Requests</h3>
                <p className="text-xs text-gray-500">Get matched with customers near you</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 bg-white rounded-lg shadow-sm flex items-center justify-center text-forge-navy flex-shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-900">Instant Messaging</h3>
                <p className="text-xs text-gray-500">Chat directly with customers</p>
              </div>
            </div>
          </div>

          {/* Price card */}
          <div className="bg-forge-navy text-white p-5 rounded-2xl mb-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-sm">Onboarding Fee</span>
              <span className="text-2xl font-bold">
                {(user as any)?.country === 'NG' ? '₦2,000' : 'GH₵ 10'}
              </span>
            </div>
            <p className="text-xs text-gray-400 italic">
              One-time payment · No hidden charges · No subscription
            </p>
          </div>

          {/* Pay button */}
          <Button
            fullWidth
            size="lg"
            onClick={handlePayment}
            loading={loading}
          >
            <Smartphone className="w-5 h-5 mr-2" />
            Pay with Mobile Money
          </Button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Secure payment processed by Paystack. A prompt will be sent to your phone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentGateModal;
