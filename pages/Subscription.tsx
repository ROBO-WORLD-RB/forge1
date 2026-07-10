import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getSubscriptionPlans, 
  getActiveSubscription, 
  createSubscription,
  cancelSubscription,
  checkSubscriptionStatus
} from '../services/subscriptionService';
import { initializePayment, createSubscriptionPayment, formatCurrency } from '../services/paystackService';
import { logTransaction } from '../services/paymentWebhookService';
import type { Subscription, Country } from '../types/database';
import type { SubscriptionPlan } from '../services/subscriptionService';
import { logger } from '../utils/logger';
import { 
  Crown, Check, Star, Zap, Shield, Loader2, 
  AlertTriangle, Calendar, CreditCard
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';

const Subscription: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const country: Country = user?.country || 'GH';

  useEffect(() => {
    fetchData();
  }, [user?.id, country]);

  const fetchData = async () => {
    setLoading(true);
    
    // Get plans for user's country
    const plansList = getSubscriptionPlans(country);
    setPlans(plansList);

    // Get current subscription if user is logged in
    if (user?.id) {
      const subResult = await getActiveSubscription(user.id);
      if (subResult.data) {
        setCurrentSubscription(subResult.data);
      }
      const status = await checkSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
    }
    
    setLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    if (!user?.id || !user?.email) {
      alert('Please make sure you are logged in with a valid email address.');
      return;
    }
    
    // Find the plan
    const plan = plans.find(p => p.id === planId);
    if (!plan || plan.tier === 'free') return;
    
    setSubscribing(planId);
    setPaymentError(null);
    
    try {
      const paymentParams = createSubscriptionPayment(user.id, user.email, {
        id: planId,
        tier: plan.tier,
        price: plan.price,
        currency: plan.currency,
      });

      await initializePayment(
        paymentParams,
        async (transaction) => {
          const logResult = await logTransaction(
            user.id,
            'subscription',
            plan.price,
            plan.currency,
            'paystack',
            'pending',
            { plan_id: planId, tier: plan.tier },
            transaction.reference
          );

          if (logResult.error) {
            logger.warn('Could not log subscription transaction (RLS or DB)', {
              reference: transaction.reference,
              error: logResult.error.message,
            });
          }

          const result = await createSubscription(user.id, planId, 'paystack');
          if (result.data) {
            setCurrentSubscription(result.data);
            setSubscriptionStatus('active');
            alert(`Successfully subscribed to ${plan.name} plan!`);
          } else {
            setPaymentError(
              `Payment received (${transaction.reference}) but subscription activation failed. Please contact support — do not pay again.`
            );
          }
          setSubscribing(null);
        },
        () => {
          setSubscribing(null);
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.';
      logger.error('Subscription payment error', { error: message });
      setPaymentError(message);
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!currentSubscription) return;
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) return;
    
    setCancelling(true);
    const result = await cancelSubscription(currentSubscription.id);
    if (result.data) {
      setCurrentSubscription(result.data);
      setSubscriptionStatus('none');
    }
    setCancelling(false);
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'premium': return <Crown className="w-8 h-8" />;
      case 'basic': return <Star className="w-8 h-8" />;
      default: return <Zap className="w-8 h-8" />;
    }
  };

  const getPlanColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'from-amber-500 to-orange-600';
      case 'basic': return 'from-blue-500 to-indigo-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  if (loading) {
    return (
      <>
        <PageHelmet title="Subscription" path="/subscription" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Subscription" path="/subscription" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-forge-navy mb-2">Subscription Plans</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Choose the plan that fits your needs. Upgrade to get more visibility and attract more customers.
          </p>
        </div>

        {paymentError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{paymentError}</span>
          </div>
        )}

        {/* Current Subscription Banner */}
        {currentSubscription && subscriptionStatus !== 'none' && (
          <div className={`mb-8 p-6 rounded-xl ${
            subscriptionStatus === 'expiring' 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  subscriptionStatus === 'expiring' ? 'bg-yellow-100' : 'bg-green-100'
                }`}>
                  {subscriptionStatus === 'expiring' 
                    ? <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    : <Shield className="w-6 h-6 text-green-600" />
                  }
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    Current Plan: <span className="capitalize">{currentSubscription.tier}</span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    {subscriptionStatus === 'expiring' 
                      ? `Expires on ${new Date(currentSubscription.expires_at).toLocaleDateString()} - Renew soon!`
                      : `Active until ${new Date(currentSubscription.expires_at).toLocaleDateString()}`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cancel Plan'}
              </button>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => {
            const isCurrentPlan = currentSubscription?.tier === plan.tier && subscriptionStatus !== 'none';
            const isPremium = plan.tier === 'premium';
            
            return (
              <div 
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-sm overflow-hidden ${
                  isPremium ? 'ring-2 ring-forge-orange' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {isPremium && (
                  <div className="absolute top-0 right-0 bg-forge-orange text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                    CURRENT
                  </div>
                )}
                
                {/* Plan Header */}
                <div className={`p-6 bg-gradient-to-br ${getPlanColor(plan.tier)} text-white`}>
                  <div className="flex items-center gap-3 mb-4">
                    {getPlanIcon(plan.tier)}
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      {plan.currency} {plan.price.toLocaleString()}
                    </span>
                    <span className="text-white/70">/month</span>
                  </div>
                </div>
                
                {/* Features */}
                <div className="p-6">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isCurrentPlan || subscribing === plan.id || plan.tier === 'free'}
                    className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                      isCurrentPlan
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : plan.tier === 'free'
                        ? 'bg-gray-100 text-gray-500 cursor-default'
                        : isPremium
                        ? 'bg-forge-orange text-white hover:bg-orange-600'
                        : 'bg-forge-navy text-white hover:bg-slate-800'
                    } disabled:opacity-50`}
                  >
                    {subscribing === plan.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <Check className="w-5 h-5" />
                        Current Plan
                      </>
                    ) : plan.tier === 'free' ? (
                      'Free Forever'
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Subscribe Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-12 bg-white rounded-xl p-6">
          <h2 className="text-xl font-bold text-forge-navy mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">How does billing work?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Subscriptions are billed monthly. You can cancel anytime and your plan will remain active until the end of the billing period.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Can I upgrade or downgrade?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Yes! You can change your plan at any time. When upgrading, you'll be charged the difference. When downgrading, the change takes effect at the next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">What payment methods are accepted?</h3>
              <p className="text-sm text-gray-600 mt-1">
                We accept mobile money (MTN, Vodafone, AirtelTigo) and card payments through Paystack.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Subscription;
