import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation, type Location } from 'react-router-dom';
import { UserRole } from '../../types';
import { signUp, getUserProfile, signInWithGoogle } from '../../services/authService';
import { sendOTP, verifyOTP, formatPhoneNumber } from '../../services/smsService';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import PasswordStrengthMeter from '../../components/PasswordStrengthMeter';
import { Briefcase, User, Phone, ArrowLeft, Eye, EyeOff, Check, Camera, AtSign, Smartphone, Crown, Star, Zap } from 'lucide-react';
import { getSubscriptionPlans, type SubscriptionPlan } from '../../services/subscriptionService';
import PageHelmet from '../../components/PageHelmet';
import { getDefaultDashboardPath, getSafeRedirectPath, resolvePostAuthPath } from '../../utils/authRedirect';

// Google icon component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

type Step = 'role' | 'details' | 'subscription' | 'verify' | 'password' | 'checkEmail';

const SIGNUP_ROLE_KEY = 'forge_signup_role';
const SIGNUP_COUNTRY_KEY = 'forge_signup_country';

function readPersistedRole(): UserRole | null {
  try {
    const saved = localStorage.getItem(SIGNUP_ROLE_KEY);
    if (saved === UserRole.WORKER || saved === UserRole.CUSTOMER) return saved;
  } catch {
    // ignore storage errors
  }
  return null;
}

function readPersistedCountry(): 'GH' | 'NG' {
  try {
    const saved = localStorage.getItem(SIGNUP_COUNTRY_KEY);
    if (saved === 'GH' || saved === 'NG') return saved;
  } catch {
    // ignore storage errors
  }
  return 'GH';
}

function persistSignupIntent(selectedRole: UserRole, selectedCountry: 'GH' | 'NG') {
  try {
    localStorage.setItem(SIGNUP_ROLE_KEY, selectedRole);
    localStorage.setItem(SIGNUP_COUNTRY_KEY, selectedCountry);
  } catch {
    // ignore storage errors
  }
}

function clearSignupIntent() {
  try {
    localStorage.removeItem(SIGNUP_ROLE_KEY);
    localStorage.removeItem(SIGNUP_COUNTRY_KEY);
  } catch {
    // ignore storage errors
  }
}

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, refreshUser, user, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState<Step>('role');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [role, setRole] = useState<UserRole | null>(() => readPersistedRole());
  const [country, setCountry] = useState<'GH' | 'NG'>(() => readPersistedCountry());
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // OTP verification state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  /** Shown when SMS was not delivered (no provider / send failed) — beta unblock */
  const [fallbackOtpCode, setFallbackOtpCode] = useState<string | null>(null);
  const [otpSmsWarning, setOtpSmsWarning] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Subscription state (for workers)
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);

  // Handle profile picture selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Resend timer countdown
  useEffect(() => {
    if (step === 'verify' && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [step, resendTimer]);

  // Focus first OTP input when entering verify step
  useEffect(() => {
    if (step === 'verify') {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  const fillFallbackOtp = () => {
    if (!fallbackOtpCode) return;
    const digits = fallbackOtpCode.replace(/\D/g, '').slice(0, 6).split('');
    const filled = ['', '', '', '', '', ''];
    digits.forEach((d, i) => { filled[i] = d; });
    setOtpCode(filled);
    otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const copyFallbackOtp = async () => {
    if (!fallbackOtpCode) return;
    try {
      await navigator.clipboard.writeText(fallbackOtpCode);
    } catch {
      // clipboard may be blocked; dev banner still shows the code
    }
  };

  // Google OAuth loading state
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const from = (location.state as { from?: Location })?.from;
    const fallback = getDefaultDashboardPath(user.role);
    const safeFrom = getSafeRedirectPath(from, fallback);
    navigate(resolvePostAuthPath(user, safeFrom), { replace: true });
  }, [isLoading, isAuthenticated, user, location.state, navigate]);

  // --- Step 1: Role Selection ---
  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    persistSignupIntent(selectedRole, country);
    setTimeout(() => setStep('details'), 300);
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async (selectedRole: UserRole) => {
    setGoogleLoading(true);
    setError(null);
    setRole(selectedRole);
    persistSignupIntent(selectedRole, country);
    
    try {
      const from = (location.state as any)?.from;
      const fromPath = from ? `${from.pathname}${from.search || ''}` : (selectedRole === UserRole.WORKER ? '/auth/onboarding' : '/search');
      localStorage.setItem('oauth_redirect_from', fromPath);

      const { error: googleError } = await signInWithGoogle(selectedRole, country);
      if (googleError) {
        setError(googleError.message);
      }
      // If successful, user will be redirected to Google
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // --- Step 2: Details Entry ---
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate names
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }
    
    // Basic email validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate phone
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    // For customers, auto-generate username if not provided
    if (role === UserRole.CUSTOMER && !username) {
      const autoUsername = `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/\s/g, '');
      setUsername(autoUsername);
    }
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(phone, country);
    setPhone(formattedPhone);
    
    // For workers, go to subscription selection first
    if (role === UserRole.WORKER) {
      const plans = getSubscriptionPlans(country);
      setSubscriptionPlans(plans);
      setStep('subscription');
      return;
    }
    
    // For customers, go directly to OTP verification
    await sendOtpAndProceed(formattedPhone);
  };

  // Helper to send OTP and move to verify step
  const sendOtpAndProceed = async (phoneToVerify: string = phone) => {
    setOtpSending(true);
    setError(null);
    try {
      const result = await sendOTP(phoneToVerify, country);
      if (!result.success) {
        setError(result.error || 'Failed to send verification code');
        setFallbackOtpCode(null);
        setOtpSmsWarning(null);
        return;
      }
      const code = result.displayCode || result.devCode || null;
      if (result.smsDelivered) {
        setFallbackOtpCode(null);
        setOtpSmsWarning(null);
      } else if (code) {
        setFallbackOtpCode(code);
        setOtpSmsWarning(
          result.warning || 'SMS not configured — use this code to continue.'
        );
      }
      setResendTimer(60);
      setCanResend(false);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setOtpSending(false);
    }
  };

  // --- Step 2.5: Subscription Selection (Workers only) ---
  const handleSubscriptionContinue = async () => {
    setError(null);
    await sendOtpAndProceed(phone);
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'premium': return <Crown className="w-6 h-6" />;
      case 'basic': return <Star className="w-6 h-6" />;
      default: return <Zap className="w-6 h-6" />;
    }
  };

  const getPlanColor = (tier: string, selected: boolean) => {
    if (!selected) return 'border-gray-200 hover:border-gray-300';
    switch (tier) {
      case 'premium': return 'border-amber-500 bg-amber-50';
      case 'basic': return 'border-blue-500 bg-blue-50';
      default: return 'border-green-500 bg-green-50';
    }
  };

  // --- Step 3: OTP Verification ---
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
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

  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setOtpVerifying(true);
    setError(null);

    try {
      const result = await verifyOTP(phone, country, code);
      if (!result.success) {
        setError(result.error || 'Invalid verification code');
        return;
      }
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    setOtpSending(true);
    setError(null);
    
    try {
      const result = await sendOTP(phone, country);
      if (!result.success) {
        setError(result.error || 'Failed to resend code');
        return;
      }
      const code = result.displayCode || result.devCode || null;
      if (result.smsDelivered) {
        setFallbackOtpCode(null);
        setOtpSmsWarning(null);
      } else if (code) {
        setFallbackOtpCode(code);
        setOtpSmsWarning(
          result.warning ||
            'SMS could not be sent. Use this new code to continue.'
        );
        setError(null);
      }
      setOtpCode(['', '', '', '', '', '']);
      setResendTimer(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setOtpSending(false);
    }
  };

  // --- Step 3: Password & Registration ---
  const getPasswordStrength = (pwd: string) => {
    return {
      minLength: pwd.length >= 8,
      hasUpper: /[A-Z]/.test(pwd),
      hasNumber: /\d/.test(pwd),
      hasSpecial: /[!@#$%^&*]/.test(pwd),
    };
  };

  const strength = getPasswordStrength(password);
  // Require min length, uppercase, and number. Symbol is optional but recommended.
  const isPasswordValid = strength.minLength && strength.hasUpper && strength.hasNumber;
  const doPasswordsMatch = password === confirmPassword && password.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    // Critical: without this the browser reloads /auth/signup and resets to the role picker.
    e.preventDefault();
    setLoading(true);
    setError(null);

    const selectedRole = role ?? readPersistedRole();
    if (!selectedRole) {
      setError('Please select whether you need help or are a skilled worker.');
      setStep('role');
      setLoading(false);
      return;
    }

    try {
      // Use Supabase auth service for registration
      const { user: supabaseUser, session, error: authError } = await signUp(email, password, {
        phone,
        role: selectedRole as 'worker' | 'customer' | 'admin',
        country,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username || `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/\s/g, ''),
      });
      
      if (authError) {
        if (authError.code === 'user_already_exists') {
          setError(authError.message);
          setTimeout(() => {
            navigate('/auth/login', {
              replace: true,
              state: {
                from: (location.state as { from?: Location })?.from,
                oauthError: authError.message,
              },
            });
          }, 2500);
          return;
        }
        let errorMessage = authError.message;
        if (authError.message.toLowerCase().includes('already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (authError.message.includes('Password')) {
          errorMessage = 'Password must be at least 6 characters.';
        }
        setError(errorMessage);
        return;
      }

      if (!supabaseUser) {
        setError('Registration failed. Please try again.');
        return;
      }

      // No session → Supabase "Confirm email" is on. Stay on a clear success screen.
      if (!session) {
        clearSignupIntent();
        setStep('checkEmail');
        return;
      }

      // Get user profile from database
      const profile = await getUserProfile(supabaseUser.id);
      const resolvedRole = (profile?.role || selectedRole) as UserRole;
      
      // Map Supabase user to app User type — prefer selected role so redirect stays correct
      // even if profile lag temporarily omits role.
      const appUser = {
        id: supabaseUser.id,
        phone: profile?.phone || phone,
        email: supabaseUser.email,
        role: resolvedRole,
        firstName: profile?.first_name || firstName.trim() || undefined,
        lastName: profile?.last_name || lastName.trim() || undefined,
        profileCompleted: profile?.profile_completed ?? (resolvedRole === UserRole.CUSTOMER),
        avatarUrl: profile?.avatar_url || undefined,
        workerStatus: profile?.worker_status || (resolvedRole === UserRole.WORKER ? 'pending' : 'active'),
        country,
      };

      login(appUser, session.access_token);
      // Sync profile without blocking redirect; never clear the user we just set.
      void refreshUser().catch(() => undefined);
      clearSignupIntent();

      const from = (location.state as { from?: Location })?.from;
      const fallback = getDefaultDashboardPath(resolvedRole);
      const safeFrom = getSafeRedirectPath(from, fallback);
      navigate(resolvePostAuthPath(appUser, safeFrom), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  // --- Render Helpers ---
  const renderBackBtn = (target: Step | string) => (
    <button 
      onClick={() => typeof target === 'string' && target !== '/' ? setStep(target as Step) : navigate(target)}
      className="absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
    >
      <ArrowLeft className="w-6 h-6" />
    </button>
  );

  return (
    <>
      <PageHelmet title="Create Account" path="/auth/signup" />
      <div className="min-h-dynamic bg-white md:bg-gray-50 flex items-center justify-center p-4 pb-nav">
      <div className="w-full max-w-md bg-white md:rounded-3xl md:shadow-xl overflow-hidden relative min-h-[500px] flex flex-col">
        
        {/* Step 1: Role Selection */}
        {step === 'role' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {renderBackBtn('/')}
            <div className="mt-12 mb-6 text-center">
              <div className="flex justify-center mb-6">
                <img src="/logo.png" alt="Forge Logo" className="w-20 h-20 object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-forge-navy mb-2">Welcome to FORGE</h1>
              <p className="text-gray-500">What brings you here today?</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
            
            <div className="space-y-4 flex-1">
              {/* Worker Option */}
              <div className="border-2 border-gray-100 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => handleRoleSelect(UserRole.WORKER)}
                  className="w-full p-5 flex items-center gap-4 transition-all hover:bg-orange-50 group text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-forge-orange flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">I'm a Skilled Worker</h3>
                    <p className="text-sm text-gray-500">I want to offer my services and earn money.</p>
                  </div>
                </button>
                <div className="px-5 pb-4">
                  <button
                    onClick={() => handleGoogleSignIn(UserRole.WORKER)}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <GoogleIcon />
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </button>
                </div>
              </div>

              {/* Customer Option */}
              <div className="border-2 border-gray-100 rounded-2xl overflow-hidden">
                <button 
                  onClick={() => handleRoleSelect(UserRole.CUSTOMER)}
                  className="w-full p-5 flex items-center gap-4 transition-all hover:bg-slate-50 group text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-forge-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">I Need Help</h3>
                    <p className="text-sm text-gray-500">I'm looking for professionals for my project.</p>
                  </div>
                </button>
                <div className="px-5 pb-4">
                  <button
                    onClick={() => handleGoogleSignIn(UserRole.CUSTOMER)}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <GoogleIcon />
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/auth/login" 
                  state={{ from: location.state?.from }} 
                  className="text-forge-orange font-bold hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Details - Different for Customer vs Worker */}
        {step === 'details' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {renderBackBtn('role')}
            <div className="mt-8 mb-6">
              <h2 className="text-2xl font-bold text-forge-navy mb-2">
                {role === UserRole.CUSTOMER ? 'Create Your Profile' : 'Your Details'}
              </h2>
              <p className="text-gray-500">
                {role === UserRole.CUSTOMER 
                  ? 'Set up your customer profile to get started.' 
                  : 'Enter your contact information.'}
              </p>
            </div>

            <form onSubmit={handleDetailsSubmit} className="space-y-5 flex-1 overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
              
              <div className="space-y-4">
                {/* Profile Picture - Customer only */}
                {role === UserRole.CUSTOMER && (
                  <div className="flex justify-center mb-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-forge-orange cursor-pointer transition-colors relative group overflow-hidden"
                    >
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400 group-hover:text-forge-orange" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-medium">Upload</span>
                      </div>
                    </div>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange}
                      className="hidden" 
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="First Name"
                    placeholder="Kwame"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Input 
                    label="Last Name"
                    placeholder="Mensah"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>

                {/* Username - Customer only */}
                {role === UserRole.CUSTOMER && (
                  <Input 
                    label="Username"
                    placeholder="kwame_mensah"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    icon={<AtSign className="w-4 h-4" />}
                  />
                )}

                <Input 
                  label="Email Address"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<User className="w-4 h-4" />}
                  type="email"
                />

                {/* Country Selection - For both workers and customers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCountry('GH');
                        if (role) persistSignupIntent(role, 'GH');
                      }}
                      className={`p-3 rounded-xl border font-medium transition-all ${country === 'GH' ? 'border-forge-orange bg-orange-50 text-forge-orange' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      🇬🇭 Ghana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCountry('NG');
                        if (role) persistSignupIntent(role, 'NG');
                      }}
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
                  icon={<Phone className="w-4 h-4" />}
                  type="tel"
                />
              </div>

              <div className="pt-4">
                <Button fullWidth size="lg" type="submit" loading={otpSending} disabled={!email || !firstName || !lastName || !phone}>
                  Continue
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2.5: Subscription Selection (Workers only) */}
        {step === 'subscription' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {renderBackBtn('details')}
            <div className="mt-8 mb-6">
              <h2 className="text-2xl font-bold text-forge-navy mb-2">Choose Your Plan</h2>
              <p className="text-gray-500">Select a subscription tier to get started. You can change this later.</p>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
              
              {subscriptionPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.tier)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${getPlanColor(plan.tier, selectedPlan === plan.tier)}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      plan.tier === 'premium' ? 'bg-amber-100 text-amber-600' :
                      plan.tier === 'basic' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {getPlanIcon(plan.tier)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">{plan.name}</h3>
                        <span className="font-bold text-gray-900">
                          {plan.price === 0 ? 'Free' : `${plan.currency} ${plan.price.toLocaleString()}/mo`}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {plan.features.slice(0, 2).join(' • ')}
                      </p>
                    </div>
                    {selectedPlan === plan.tier && (
                      <Check className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                </button>
              ))}

              <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg mt-4">
                💡 You can start with the free plan and upgrade anytime from your dashboard.
              </p>
            </div>

            <div className="pt-4">
              <Button 
                fullWidth 
                size="lg" 
                onClick={handleSubscriptionContinue}
                loading={otpSending}
              >
                Continue to Verification
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Phone Verification */}
        {step === 'verify' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {renderBackBtn(role === UserRole.WORKER ? 'subscription' : 'details')}
            <div className="mt-12 mb-8 text-center">
              <div className="w-16 h-16 bg-forge-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-forge-orange" />
              </div>
              <h2 className="text-2xl font-bold text-forge-navy mb-2">Verify Your Phone</h2>
              <p className="text-gray-500">
                {fallbackOtpCode
                  ? 'Enter the 6-digit code for'
                  : 'We sent a 6-digit code to'}
                <br />
                <span className="font-medium text-gray-700">{phone}</span>
              </p>
            </div>

            <div className="space-y-6 flex-1">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>}

              {fallbackOtpCode && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg text-sm text-center">
                  <p className="font-medium">
                    {otpSmsWarning || 'SMS not configured — use this code'}
                  </p>
                  <p className="text-2xl font-bold tracking-widest mt-1">{fallbackOtpCode}</p>
                  <p className="text-xs mt-1 text-amber-700">
                    Real SMS needs Twilio or Africa&apos;s Talking env vars on the server.
                  </p>
                  <div className="flex gap-2 justify-center mt-3">
                    <button
                      type="button"
                      onClick={fillFallbackOtp}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                    >
                      Fill code
                    </button>
                    <button
                      type="button"
                      onClick={copyFallbackOtp}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              
              {/* OTP Input */}
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

              {/* Resend */}
              <div className="text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpSending}
                    className="text-forge-orange font-medium hover:underline disabled:opacity-50"
                  >
                    {otpSending ? 'Sending...' : 'Resend Code'}
                  </button>
                ) : (
                  <p className="text-gray-500 text-sm">
                    Resend code in <span className="font-medium">{resendTimer}s</span>
                  </p>
                )}
              </div>

              <div className="pt-4">
                <Button 
                  fullWidth 
                  size="lg" 
                  onClick={handleVerifyOtp}
                  loading={otpVerifying}
                  disabled={otpCode.join('').length !== 6}
                >
                  Verify & Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Password */}
        {step === 'password' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
             {renderBackBtn('verify')}
             <div className="mt-8 mb-6">
              <h2 className="text-2xl font-bold text-forge-navy mb-2">Secure your account</h2>
              <p className="text-gray-500">Create a password to login later.</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5 flex-1 overflow-y-auto pb-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

              <div className="relative">
                <Input 
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <PasswordStrengthMeter password={password} />

              <Input 
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
              />

              <div className="pt-4">
                <Button 
                  fullWidth 
                  size="lg" 
                  loading={loading} 
                  type="submit" 
                  disabled={password.length < 8 || password !== confirmPassword}
                >
                  Create Account
                </Button>
                <p className="text-xs text-center text-gray-500 mt-4">
                  By continuing, you agree to Forge's <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy Policy</a>.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Step 5: Email confirmation required (account created, no session yet) */}
        {step === 'checkEmail' && (
          <div className="flex-1 flex flex-col p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mt-12 mb-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-forge-navy mb-2">Check your email</h2>
              <p className="text-gray-500">
                We created your account. Open the confirmation link sent to
                <br />
                <span className="font-medium text-gray-700">{email}</span>
                <br />
                then sign in to continue.
              </p>
            </div>

            <div className="space-y-4 flex-1">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                Your account is ready — confirm your email first. After that, sign in and
                you&apos;ll land on{' '}
                {role === UserRole.WORKER ? 'worker onboarding' : 'your customer dashboard'}.
              </div>

              <Button
                fullWidth
                size="lg"
                onClick={() =>
                  navigate('/auth/login', {
                    replace: true,
                    state: { from: (location.state as { from?: Location })?.from },
                  })
                }
              >
                Go to Sign In
              </Button>

              <p className="text-center text-sm text-gray-500">
                Wrong email?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setError(null);
                  }}
                  className="text-forge-orange font-medium hover:underline"
                >
                  Go back
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Signup;