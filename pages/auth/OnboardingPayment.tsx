import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initializePayment, createOnboardingPayment, fromSmallestUnit } from '../../services/paystackService';
import { getUserProfile } from '../../services/authService';
import { logTransaction } from '../../services/paymentWebhookService';
import Button from '../../components/Button';
import { CreditCard, CheckCircle, ShieldCheck, Zap } from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';
import { logger } from '../../utils/logger';

const OnboardingPayment: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If user is already active or not a worker, redirect
    if (user && user.role !== 'worker') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handlePayment = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const country = ((user as { country?: string }).country || 'GH') as 'GH' | 'NG';
      const paymentParams = createOnboardingPayment(user.id, user.email || '', country);

      await initializePayment(
        paymentParams,
        async (txn) => {
          const logResult = await logTransaction(
            user.id,
            'subscription',
            fromSmallestUnit(txn.amount),
            txn.currency,
            'paystack',
            'pending',
            { flow: 'onboarding_fee' },
            txn.reference
          );

          if (logResult.error) {
            logger.warn('Could not log onboarding transaction (RLS or DB)', {
              reference: txn.reference,
              error: logResult.error.message,
            });
          }

          // Webhook sets worker_status to active; poll briefly for confirmation
          try {
            for (let attempt = 0; attempt < 15; attempt++) {
              const profile = await getUserProfile(user.id);
              if (profile?.worker_status === 'active') {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            setSuccess(true);
            await refreshUser();
            setTimeout(() => navigate('/dashboard'), 2000);
          } catch {
            setError(
              'Payment received. Activation may take a moment — refresh or contact support if access is not granted.'
            );
          } finally {
            setLoading(false);
          }
        },
        () => {
          setLoading(false);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <PageHelmet title="Subscription Payment" path="/auth/onboarding/payment" />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-forge-navy mb-2">Payment Successful!</h1>
          <p className="text-gray-500 mb-6">Welcome to the Forge community. Your account is now active.</p>
          <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Subscription Payment" path="/auth/onboarding/payment" />
      <div className="min-h-dynamic bg-gray-50 flex flex-col items-center justify-center px-4 pb-nav">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-forge-orange/10 text-forge-orange rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-forge-navy mb-2">One-Time Onboarding</h1>
          <p className="text-gray-500">Pay a small one-time fee to activate your worker profile and start receiving jobs.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">{error}</div>}

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-forge-navy">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Verified Badge</h3>
              <p className="text-xs text-gray-500">Get a verified checkmark on your profile.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-forge-navy">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Priority Access</h3>
              <p className="text-xs text-gray-500">See high-paying jobs before others.</p>
            </div>
          </div>
        </div>

        <div className="bg-forge-navy text-white p-6 rounded-2xl mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">Onboarding Fee</span>
            <span className="text-2xl font-bold">
              {(user as any)?.country === 'NG' ? '₦2,000' : 'GH₵ 10'}
            </span>
          </div>
          <p className="text-xs text-gray-400 italic">One-time payment. No hidden charges.</p>
        </div>

        <Button 
          fullWidth 
          size="lg" 
          onClick={handlePayment} 
          loading={loading}
        >
          Pay with Paystack
        </Button>
        
        <p className="text-center text-xs text-gray-400 mt-6">
          Secure payment processed by Paystack. Your data is encrypted and safe.
        </p>
      </div>
    </div>
    </>
  );
};

export default OnboardingPayment;
