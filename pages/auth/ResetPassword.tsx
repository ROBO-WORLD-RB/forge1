import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { waitForAuthSession } from '../../services/authService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { Lock, Eye, EyeOff, Check, CheckCircle } from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Wait for Supabase to parse the recovery token from the URL hash
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true);
        setError(null);
        setCheckingSession(false);
      }
    });

    const checkSession = async () => {
      const session = await waitForAuthSession();
      if (cancelled) return;
      if (session) {
        setSessionReady(true);
        setError(null);
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
      setCheckingSession(false);
    };

    checkSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const getPasswordStrength = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const strength = getPasswordStrength(password);
  const isPasswordValid = strength.minLength && strength.hasUpper && strength.hasNumber;
  const doPasswordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady || !isPasswordValid || !doPasswordsMatch) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <>
        <PageHelmet title="Set New Password" path="/auth/reset-password" />
        <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
          <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-orange mx-auto mb-4" />
            <p className="text-gray-500">Verifying reset link...</p>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <PageHelmet title="Set New Password" path="/auth/reset-password" />
        <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
        <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-forge-navy mb-2">Password Reset!</h1>
          <p className="text-gray-500 mb-6">
            Your password has been successfully reset. Redirecting to login...
          </p>
          <Link to="/auth/login" className="text-forge-orange font-medium hover:underline">
            Go to Sign In
          </Link>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Set New Password" path="/auth/reset-password" />
      <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-forge-navy mb-2">Reset Password</h1>
          <p className="text-gray-500">Create a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

          <div className="relative">
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Requirements */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div className={`flex items-center gap-1 ${strength.minLength ? 'text-green-600' : ''}`}>
              {strength.minLength ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-300 rounded-full" />} Min 8 chars
            </div>
            <div className={`flex items-center gap-1 ${strength.hasUpper ? 'text-green-600' : ''}`}>
              {strength.hasUpper ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-300 rounded-full" />} Uppercase
            </div>
            <div className={`flex items-center gap-1 ${strength.hasNumber ? 'text-green-600' : ''}`}>
              {strength.hasNumber ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-300 rounded-full" />} Number
            </div>
            <div className={`flex items-center gap-1 ${doPasswordsMatch ? 'text-green-600' : ''}`}>
              {doPasswordsMatch ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-300 rounded-full" />} Passwords match
            </div>
          </div>

          <Input
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
          />

          <Button
            fullWidth
            size="lg"
            loading={loading}
            type="submit"
            disabled={!sessionReady || !isPasswordValid || !doPasswordsMatch}
          >
            Reset Password
          </Button>
        </form>

        <div className="mt-8 text-center space-y-2">
          {!sessionReady && (
            <Link to="/auth/forgot-password" className="block text-forge-orange font-medium hover:underline">
              Request a new reset link
            </Link>
          )}
          <Link to="/auth/login" className="block text-gray-600 hover:text-gray-900">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
    </>
  );
};

export default ResetPassword;
