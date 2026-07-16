import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, type Location } from 'react-router-dom';
import { signIn, getUserProfile, signInWithGoogle } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { ArrowLeft, User, Lock } from 'lucide-react';
import { UserRole } from '../../types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
      // Prefer role dashboard via resolvePostAuthPath when no deep-link; avoid sending workers to Find Workers
      const fromPath = from ? `${from.pathname}${from.search || ''}` : '';
      if (fromPath) {
        localStorage.setItem('oauth_redirect_from', fromPath);
      } else {
        localStorage.removeItem('oauth_redirect_from');
      }

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

  const completeLogin = async (supabaseUser: any, session: any) => {
    const profile = await getUserProfile(supabaseUser.id);
    
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
          <h1 className="text-3xl font-bold text-forge-navy mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to continue to Forge.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 whitespace-pre-line">{error}</div>}

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
        </form>

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
