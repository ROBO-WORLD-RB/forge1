import React, { useState, useEffect } from 'react';
import { searchWorkersRanked, type RankedWorker, type UserLocation, getCategories } from '../services/workerService';
import { useAuth } from '../context/AuthContext';
import WorkerCard, { WorkerCardSkeleton } from '../components/WorkerCard';
import { Search, Filter, Map, SlidersHorizontal, Briefcase } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { WorkerProfile as DBWorkerProfile, Country } from '../types/database';
import type { WorkerProfile, WorkerTier } from '../types';
import PageHelmet from '../components/PageHelmet';

/**
 * Convert database WorkerProfile to app WorkerProfile type
 */
function mapToAppWorkerProfile(dbProfile: any): WorkerProfile {
  return {
    id: dbProfile.id,
    userId: dbProfile.user_id,
    name: dbProfile.name,
    role: dbProfile.role,
    location: dbProfile.location,
    country: dbProfile.country,
    // Use joined profiles.avatar_url or a generic placeholder
    avatarUrl: dbProfile.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbProfile.name)}&background=random`,
    bio: dbProfile.bio || '',
    hourlyRate: {
      min: dbProfile.hourly_rate_min || 0,
      max: dbProfile.hourly_rate_max || 0,
      currency: dbProfile.currency || (dbProfile.country === 'GH' ? 'GHS' : 'NGN'),
    },
    rating: dbProfile.rating,
    reviewCount: dbProfile.review_count,
    skills: dbProfile.skills || [],
    tier: dbProfile.tier as WorkerTier,
    verified: dbProfile.verified,
    reviews: [], // Reviews would need to be fetched separately
    experienceYears: dbProfile.experience_years || undefined,
  };
}

type SortOption = 'recommended' | 'rating' | 'price_low' | 'price_high' | 'reviews';

const WorkerSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const categoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(categoryParam || 'all');
  // Default to user's country for "For You" experience, or 'all' if not logged in
  const [selectedCountry, setSelectedCountry] = useState<string | 'all'>(user?.country || 'all');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>(undefined);
  const [locationResolved, setLocationResolved] = useState(false);

  // Request browser geolocation for distance-based ranking (optional)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationResolved(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationResolved(true);
      },
      () => {
        setLocationResolved(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await getCategories();
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  // Sync category filter from URL (e.g. linked from job detail)
  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  // Update country filter when user logs in/out
  useEffect(() => {
    if (user?.country && selectedCountry === 'all') {
      setSelectedCountry(user.country);
    }
  }, [user?.country, selectedCountry]);

  // Fetch workers from Supabase using ranked search (considers subscription tiers)
  useEffect(() => {
    if (!locationResolved) return;

    const fetchWorkers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const filters: { country?: Country; skills?: string[] } = {};
        
        // Apply country filter
        if (selectedCountry !== 'all') {
          filters.country = selectedCountry as Country;
        }
        
        // Apply category/skill filter
        if (selectedCategory !== 'all') {
          // Map category slug/name to skill name for filtering
          const category = categories.find(c => c.slug === selectedCategory || c.id === selectedCategory);
          if (category) {
            filters.skills = [category.name];
          }
        }
        
        // Use ranked search which considers subscription tiers for visibility
        const { data, error: searchError } = await searchWorkersRanked(filters, userLocation);
        
        if (searchError) {
          console.error('Search error:', searchError.message);
          setError('Failed to fetch professionals. Please try again later.');
          setWorkers([]);
          return;
        }
        
        // Map database profiles to app profiles (ranked workers already sorted by composite score)
        const mappedWorkers = (data || []).map(mapToAppWorkerProfile);
        setWorkers(mappedWorkers);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, [selectedCategory, selectedCountry, categories, userLocation, locationResolved]);

  // Filter workers by search term and country (client-side filtering)
  const filteredWorkers = workers
    .filter(worker => {
      // Search term filter
      if (!searchTerm) return true;
      
      const term = searchTerm.toLowerCase();
      return (
        worker.name.toLowerCase().includes(term) ||
        worker.role.toLowerCase().includes(term) ||
        worker.skills.some(s => s.toLowerCase().includes(term)) ||
        worker.location.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recommended':
          // Keep the order from ranked search (premium workers first)
          return 0;
        case 'rating':
          return b.rating - a.rating;
        case 'price_low':
          return a.hourlyRate.min - b.hourlyRate.min;
        case 'price_high':
          return b.hourlyRate.max - a.hourlyRate.max;
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        default:
          return 0;
      }
    });

  const activeCategory = selectedCategory !== 'all'
    ? categories.find(c => c.slug === selectedCategory || c.id === selectedCategory)
    : null;

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedCountry !== 'all' ||
    Boolean(searchTerm.trim());

  const emptyState = (() => {
    if (workers.length === 0) {
      if (selectedCategory !== 'all' || selectedCountry !== 'all') {
        return {
          title: 'No professionals match your filters',
          message: `We couldn't find workers${activeCategory ? ` in ${activeCategory.name}` : ''}${selectedCountry !== 'all' ? ` in ${selectedCountry === 'GH' ? 'Ghana' : 'Nigeria'}` : ''}. Try broadening your filters or check back soon.`,
          action: 'Clear filters',
          onAction: () => {
            setSelectedCategory('all');
            setSelectedCountry(user?.country || 'all');
            setSearchTerm('');
          },
        };
      }
      return {
        title: 'No professionals listed yet',
        message: 'Be the first skilled worker in your area — or check back as more pros join Forge.',
        action: null,
        onAction: null,
      };
    }

    if (searchTerm.trim()) {
      return {
        title: `No results for "${searchTerm.trim()}"`,
        message: 'Try a different name, skill, or role — or clear your search to see all available professionals.',
        action: 'Clear search',
        onAction: () => setSearchTerm(''),
      };
    }

    return {
      title: 'No professionals found',
      message: 'Try adjusting your search terms or filters.',
      action: hasActiveFilters ? 'Reset filters' : null,
      onAction: hasActiveFilters
        ? () => {
            setSelectedCategory('all');
            setSelectedCountry(user?.country || 'all');
            setSearchTerm('');
          }
        : null,
    };
  })();

  return (
    <div className="min-h-dynamic bg-gray-50 pt-6 pb-nav px-4 md:px-8">
      <PageHelmet title="Find Workers" path="/search" />
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-3xl font-bold text-forge-navy">
                {selectedCountry !== 'all' && selectedCountry === user?.country 
                  ? 'For You' 
                  : 'Find Professionals'}
              </h1>
              {selectedCountry !== 'all' && (
                <p className="text-gray-500 mt-1">
                  Showing workers in {selectedCountry === 'GH' ? '🇬🇭 Ghana' : '🇳🇬 Nigeria'}
                </p>
              )}
            </div>
            {!loading && (
              <p className="text-sm text-gray-500">
                {filteredWorkers.length} professional{filteredWorkers.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, skill, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-forge-orange/20 focus:border-forge-orange bg-white shadow-sm"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
               <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-forge-orange shadow-sm min-w-[140px]"
               >
                 <option value="all">All Skills</option>
                 {categories.map(cat => (
                   <option key={cat.id} value={cat.slug}>{cat.name}</option>
                 ))}
               </select>

               <select 
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-forge-orange shadow-sm min-w-[140px]"
               >
                 <option value="all">All Locations</option>
                 <option value="GH">Ghana</option>
                 <option value="NG">Nigeria</option>
               </select>

               <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-forge-orange shadow-sm min-w-[140px]"
               >
                 <option value="recommended">Recommended</option>
                 <option value="rating">Top Rated</option>
                 <option value="reviews">Most Reviews</option>
                 <option value="price_low">Price: Low to High</option>
                 <option value="price_high">Price: High to Low</option>
               </select>

               <button className="px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm flex items-center gap-2 text-gray-700">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">More</span>
               </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-busy="true" aria-label="Loading workers">
            {Array.from({ length: 8 }).map((_, i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Results Grid */}
        {!loading && filteredWorkers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredWorkers.map(worker => (
              <WorkerCard 
                key={worker.id} 
                worker={worker} 
                onViewProfile={(id) => navigate(`/profile/${id}`)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredWorkers.length === 0 && !error && (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{emptyState.title}</h3>
            <p className="text-gray-500 mt-2">{emptyState.message}</p>
            {emptyState.action && emptyState.onAction && (
              <button
                onClick={emptyState.onAction}
                className="mt-6 text-forge-orange font-medium hover:underline"
              >
                {emptyState.action}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default WorkerSearch;
