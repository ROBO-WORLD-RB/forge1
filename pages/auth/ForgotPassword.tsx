import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <PageHelmet title="Reset Password" path="/auth/forgot-password" />
        <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
        <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-forge-navy mb-2">Check Your Email</h1>
          <p className="text-gray-500 mb-6">
            We've sent a password reset link to <span className="font-medium text-gray-700">{email}</span>
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Didn't receive the email? Check your spam folder or try again.
          </p>
          <div className="space-y-3">
            <Button fullWidth variant="outline" onClick={() => setSuccess(false)}>
              Try Another Email
            </Button>
            <Link to="/auth/login" className="block text-forge-orange font-medium hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Reset Password" path="/auth/forgot-password" />
      <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden relative p-8">
        <Link to="/auth/login" className="absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>

        <div className="mt-12 mb-8">
          <h1 className="text-3xl font-bold text-forge-navy mb-2">Forgot Password?</h1>
          <p className="text-gray-500">Enter your email and we'll send you a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
          />

          <Button fullWidth size="lg" loading={loading} type="submit">
            Send Reset Link
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Remember your password?{' '}
            <Link to="/auth/login" className="text-forge-orange font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default ForgotPassword;
