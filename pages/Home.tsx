import React, { useState, useEffect } from 'react';
import { getCategories } from '../services/workerService';
import { isSupabaseConfigured } from '../services/supabase';
import type { ServiceCategory } from '../types/database';
import { Search, Shield, Award, ArrowRight, Zap, Users, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import PageHelmet from '../components/PageHelmet';
import { useAuth } from '../context/AuthContext';

const FALLBACK_CATEGORIES: ServiceCategory[] = [
  { id: 1, name: 'Electrical', slug: 'electrical', icon: null, is_active: true },
  { id: 2, name: 'Plumbing', slug: 'plumbing', icon: null, is_active: true },
  { id: 3, name: 'Carpentry', slug: 'carpentry', icon: null, is_active: true },
  { id: 4, name: 'Painting', slug: 'painting', icon: null, is_active: true },
  { id: 5, name: 'Cleaning', slug: 'cleaning', icon: null, is_active: true },
  { id: 6, name: 'HVAC', slug: 'hvac', icon: null, is_active: true },
];

const CATEGORY_ICONS: Record<string, string> = {
  electrical: '⚡',
  plumbing: '🔧',
  carpentry: '🪚',
  painting: '🎨',
  cleaning: '✨',
  hvac: '❄️',
};

function CategorySkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-xl border border-gray-100 flex flex-col items-center gap-3"
          aria-hidden="true"
        >
          <div className="w-12 h-12 rounded-full shimmer" />
          <div className="h-4 w-20 rounded-lg shimmer" />
        </div>
      ))}
    </>
  );
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isWorker = user?.role === 'worker';
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setUsingFallback(false);

      try {
        if (!isSupabaseConfigured()) {
          setCategories(FALLBACK_CATEGORIES);
          setUsingFallback(true);
          return;
        }

        // Fast fallback — never leave Popular Services on a skeleton for long.
        const timeoutMs = 3000;
        const { data, error } = await Promise.race([
          getCategories(),
          new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error('Fetch timeout') }), timeoutMs)
          ),
        ]);

        if (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to fetch categories:', error.message);
          }
          setCategories(FALLBACK_CATEGORIES);
          setUsingFallback(true);
        } else if (data && data.length > 0) {
          setCategories(data.slice(0, 6));
        } else {
          setCategories(FALLBACK_CATEGORIES);
          setUsingFallback(true);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('Failed to fetch categories:', err);
        }
        setCategories(FALLBACK_CATEGORIES);
        setUsingFallback(true);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/search');
    }
  };

  const displayCategories = loadingCategories ? [] : categories;

  return (
    <>
      <PageHelmet title="Home" path="/" />
      <div className="flex flex-col min-h-dynamic pb-nav overflow-x-hidden">
        {/* Hero Section */}
        <section className="relative bg-forge-navy text-white py-12 sm:py-16 md:py-24 px-4 sm:px-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-forge-orange rounded-full opacity-10 blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-forge-green rounded-full opacity-5 blur-3xl translate-y-1/2 -translate-x-1/3" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden="true"
          />

          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">FORGE</p>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 sm:px-4 py-1.5 rounded-full mb-5 sm:mb-6 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-forge-green animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-gray-200">Live in Ghana & Nigeria</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-5 leading-[1.15]">
                Find Trusted{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-forge-orange to-amber-400">
                  Blue-Collar
                </span>{' '}
                Pros
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-1">
                Verified electricians, plumbers, caterers, and more. Pay on booking with funds held
                until the job is done.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="max-w-2xl mx-auto bg-white p-2 rounded-2xl shadow-2xl shadow-black/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <div className="flex items-center flex-1 gap-2 px-3 min-w-0">
                <Search className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="e.g. Electrician, plumber…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-500 h-12 text-base"
                  aria-label="Search for a service"
                />
              </div>
              <Button type="submit" size="md" className="sm:shrink-0 w-full sm:w-auto min-h-[44px]">
                Search
              </Button>
            </form>

            <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto">
              {[
                { icon: Users, label: '2,000+', sub: 'Verified pros' },
                { icon: CheckCircle2, label: '15k+', sub: 'Jobs done' },
                { icon: Zap, label: '< 2hr', sub: 'Avg. response' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={sub} className="text-center min-w-0">
                  <div className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 mb-1.5 sm:mb-2">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-forge-orange" aria-hidden="true" />
                  </div>
                  <div className="text-base sm:text-xl md:text-2xl font-bold truncate">{label}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 leading-tight">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end mb-6 sm:mb-8">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Popular Services</h2>
              <p className="text-gray-500 mt-1 text-sm sm:text-base">
                {usingFallback && !loadingCategories
                  ? 'Browse top categories — full list available in search'
                  : 'Most requested skills this week'}
              </p>
            </div>
            <Link
              to="/search"
              className="text-forge-orange font-medium inline-flex items-center hover:underline shrink-0 min-h-[44px]"
            >
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
            aria-busy={loadingCategories}
            aria-live="polite"
          >
            {loadingCategories ? (
              <CategorySkeleton />
            ) : (
              displayCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/search?cat=${cat.slug}`}
                  className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-forge-orange/30 hover:-translate-y-0.5 transition-all group text-center flex flex-col items-center gap-2 sm:gap-3 min-h-[44px]"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-forge-orange/10 text-forge-orange rounded-full flex items-center justify-center group-hover:bg-forge-orange group-hover:text-white transition-colors text-xl">
                    {CATEGORY_ICONS[cat.slug] || (
                      <span className="font-bold text-lg">{cat.name[0]}</span>
                    )}
                  </div>
                  <span className="font-medium text-sm sm:text-base text-gray-700 group-hover:text-gray-900 truncate w-full px-1">
                    {cat.name}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Features / Trust Section */}
        <section className="bg-gray-50 py-12 sm:py-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-4 sm:gap-8">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-forge-navy/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-forge-navy" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Verified Workers</h3>
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  Every professional passes a strict background check and skill verification process.
                </p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-forge-orange/10 flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-forge-orange" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Payment hold on booking</h3>
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  When you pay for a booking, FORGE holds the amount and releases it to the worker
                  after the job is marked completed. Bank payouts for workers are coming soon.
                </p>
              </div>
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-forge-green/20 text-forge-green rounded-xl flex items-center justify-center mb-4">
                  <span className="font-bold text-lg">AI</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">AI hire assistant</h3>
                <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                  Ask Forge AI to scope a job, suggest fair GHS/NGN bands, and match you with ranked
                  workers — you confirm every booking and payment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-forge-navy via-slate-900 to-forge-navy rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-forge-orange/20 rounded-full blur-3xl" aria-hidden="true" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Ready to get work done?</h2>
              <p className="text-gray-300 mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
                Join thousands of homeowners and businesses in Ghana and Nigeria who trust Forge for
                their projects.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {isAuthenticated && isWorker ? (
                  <>
                    <Link to="/jobs">
                      <Button size="lg" variant="primary" className="w-full sm:w-auto">
                        Browse Projects
                      </Button>
                    </Link>
                    <Link to="/profile/edit">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-white/30 text-white hover:bg-white hover:text-forge-navy hover:border-white"
                      >
                        Complete Profile
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to={isAuthenticated ? '/jobs?create=1' : '/search'}>
                      <Button size="lg" variant="primary" className="w-full sm:w-auto">
                        {isAuthenticated ? 'Post a Project' : 'Find a Pro'}
                      </Button>
                    </Link>
                    <Link to={isAuthenticated ? '/search' : '/auth/signup'}>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-white/30 text-white hover:bg-white hover:text-forge-navy hover:border-white"
                      >
                        {isAuthenticated ? 'Find Workers' : 'Become a Worker'}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
