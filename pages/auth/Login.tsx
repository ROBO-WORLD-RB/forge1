import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation, type Location } from 'react-router-dom';
import { signIn, signInWithOtp, verifyOtp, getUserProfile, signInWithGoogle } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { ArrowLeft, User, Lock, Smartphone, MessageSquare } from 'lucide-react';
import { UserRole } from '../../types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatPhoneNumber } from '../../services/smsService';
import PageHelmet from '../../components/PageHelmet';
import { getDefaultDashboardPath, getSafeRedirectPath, resolvePostAuthPath } from '../../utils/authRedirect';

const loginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Google icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, isAuthenticated, isLoading } = useAuth();
  
  // Login Modes
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
  const [otpStep, setOtpStep] = useState<'send' | 'verify'>('send');
  
  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<'GH' | 'NG'>('GH');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    (location.state as { oauthError?: string })?.oauthError ?? null
  );

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const from = (location.state as { from?: Location })?.from;
    const fallback = getDefaultDashboardPath(user.role);
    const safeFrom = getSafeRedirectPath(from, fallback);
    navigate(resolvePostAuthPath(user, safeFrom), { replace: true });
  }, [isLoading, isAuthenticated, user, location.state, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    
    try {
      const from = (location.state as any)?.from;
      const fromPath = from ? `${from.pathname}${from.search || ''}` : '/search';
      localStorage.setItem('oauth_redirect_from', fromPath);

      // For login, we use 'customer' as default role - existing users will have their role from profile
      const { error: googleError } = await signInWithGoogle('customer' as UserRole, 'GH');
      if (googleError) {
        setError(googleError.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onLoginSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      // Use Supabase auth service
      const { user: supabaseUser, session, error: authError } = await signIn(data.identifier, data.password);
      
      if (authError) {
        setError(authError.message);
        return;
      }

      if (!supabaseUser || !session) {
        setError('Login failed. Please try again.');
        return;
      }

      await completeLogin(supabaseUser, session);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formattedPhone = formatPhoneNumber(phone, country);
      const { error: otpError } = await signInWithOtp(formattedPhone);
      
      if (otpError) {
        setError(otpError.message);
        return;
      }
      
      setOtpStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(phone, country);
      const { user: supabaseUser, session, error: verifyError } = await verifyOtp(formattedPhone, code);
      
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      if (!supabaseUser || !session) {
        setError('Verification failed. Please try again.');
        return;
      }

      await completeLogin(supabaseUser, session);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (supabaseUser: any, session: any) => {
    // Get user profile from database
    const profile = await getUserProfile(supabaseUser.id);
    
    // Map Supabase user to app User type
    const appUser = {
      id: supabaseUser.id,
      phone: profile?.phone || supabaseUser.user_metadata?.phone || '',
      email: supabaseUser.email,
      role: (profile?.role || supabaseUser.user_metadata?.role || 'customer') as UserRole,
      firstName: profile?.first_name || supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.firstName,
      lastName: profile?.last_name || supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.lastName,
      profileCompleted: profile?.profile_completed ?? false,
      avatarUrl: profile?.avatar_url || undefined,
      workerStatus: profile?.worker_status || 'pending',
    };

    login(appUser, session.access_token);
    
    const from = (location.state as { from?: Location })?.from;
    const fallback = getDefaultDashboardPath(appUser.role);
    const safeFrom = getSafeRedirectPath(from, fallback);
    navigate(resolvePostAuthPath(appUser, safeFrom));
  };

  // OTP Input Helpers
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtpCode(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otpCode];
      newOtp[index] = value.replace(/\D/g, '');
      setOtpCode(newOtp);
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <>
      <PageHelmet title="Sign In" path="/auth/login" />
      <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden relative min-h-[550px] flex flex-col p-8">
        
        <Link to="/" className="absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>

        <div className="mt-12 mb-8 text-center md:text-left">
          <div className="flex justify-center md:justify-start mb-6">
            <img src="/logo.png" alt="Forge Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-forge-navy mb-2">
            {loginMode === 'password' ? 'Welcome Back' : 'Sign in with OTP'}
          </h1>
          <p className="text-gray-500">
            {loginMode === 'password' 
              ? 'Sign in to continue to Forge.' 
              : otpStep === 'send' 
                ? 'Enter your phone number to receive a code.' 
                : 'Enter the code we sent to your phone.'}
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 whitespace-pre-line">{error}</div>}

        {/* Password Mode */}
        {loginMode === 'password' && (
          <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-6 flex-1">
            <div className="space-y-4">
              <Input 
                label="Email or Phone"
                placeholder="Enter email or phone"
                icon={<User className="w-4 h-4" />}
                {...register('identifier')}
                error={errors.identifier?.message}
              />

              <div>
                <Input 
                  label="Password"
                  type="password"
                  placeholder="Enter password"
                  icon={<Lock className="w-4 h-4" />}
                  {...register('password')}
                  error={errors.password?.message}
                />
                <div className="text-right mt-1">
                  <Link to="/auth/forgot-password" title="Forgot password" className="text-xs text-forge-orange font-medium hover:underline">Forgot password?</Link>
                </div>
              </div>
            </div>

            <Button fullWidth size="lg" loading={loading} type="submit">
              Sign In
            </Button>
            
            <button 
              type="button"
              onClick={() => setLoginMode('otp')}
              className="w-full text-sm text-gray-500 hover:text-forge-orange transition-colors flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Sign in with OTP instead
            </button>
          </form>
        )}

        {/* OTP Mode - Send Step */}
        {loginMode === 'otp' && otpStep === 'send' && (
          <div className="space-y-6 flex-1">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCountry('GH')}
                    className={`p-3 rounded-xl border font-medium transition-all ${country === 'GH' ? 'border-forge-orange bg-orange-50 text-forge-orange' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    🇬🇭 Ghana
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountry('NG')}
                    className={`p-3 rounded-xl border font-medium transition-all ${country === 'NG' ? 'border-forge-orange bg-orange-50 text-forge-orange' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    🇳🇬 Nigeria
                  </button>
                </div>
              </div>

              <Input 
                label="Phone Number"
                placeholder={country === 'GH' ? '050 123 4567' : '0801 234 5678'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                icon={<Smartphone className="w-4 h-4" />}
                type="tel"
              />
            </div>

            <Button fullWidth size="lg" loading={loading} onClick={handleSendOtp}>
              Send Verification Code
            </Button>
            
            <button 
              type="button"
              onClick={() => setLoginMode('password')}
              className="w-full text-sm text-gray-500 hover:text-forge-orange transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Sign in with password instead
            </button>
          </div>
        )}

        {/* OTP Mode - Verify Step */}
        {loginMode === 'otp' && otpStep === 'verify' && (
          <div className="space-y-6 flex-1">
            <div className="flex justify-center gap-2">
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-forge-orange focus:ring-2 focus:ring-forge-orange/20 outline-none transition-all"
                />
              ))}
            </div>

            <Button fullWidth size="lg" loading={loading} onClick={handleVerifyOtp} disabled={otpCode.join('').length !== 6}>
              Verify & Sign In
            </Button>
            
            <button 
              type="button"
              onClick={() => setOtpStep('send')}
              className="w-full text-sm text-gray-500 hover:text-forge-orange transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to phone number
            </button>
          </div>
        )}

        {/* Common Social Login */}
        {otpStep === 'send' && (
          <div className="pt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link 
              to="/auth/signup" 
              state={{ from: location.state?.from }} 
              className="text-forge-orange font-bold hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default Login;
