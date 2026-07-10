import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Shield,
  ShieldCheck,
  Calendar,
  Edit3,
  Camera,
  LogOut,
  ChevronRight,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
import { UserRole, WorkerTier } from '../types';
import PageHelmet from '../components/PageHelmet';

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'settings'>('overview');

  if (isLoading) {
    return (
      <>
        <PageHelmet title="My Profile" path="/my-profile" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-orange" />
        </div>
      </>
    );
  }

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  const username = user.username || `@${user.email?.split('@')[0] || 'user'}`;
  // Use Google avatar, uploaded avatar, or generate one from name
  const avatarUrl = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=150`;
  const memberSince = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';
  const rating = user.rating ?? 0;
  const reviewCount = user.reviewCount ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Mock reviews for display (in production, fetch from database)
  const mockReviews = [
    {
      id: '1',
      author: 'Kofi Asante',
      rating: 5,
      text: 'Very professional and punctual. Highly recommend!',
      date: '2 weeks ago',
    },
    {
      id: '2',
      author: 'Ama Serwaa',
      rating: 4,
      text: 'Good communication and quality work.',
      date: '1 month ago',
    },
  ];

  const professionalism = {
    responseRate: 95,
    completionRate: 98,
    onTimeRate: 92,
    repeatClients: 15,
  };

  return (
    <>
      <PageHelmet title="My Profile" path="/my-profile" />
      <div className="min-h-dynamic bg-gray-50 pb-nav">
      {/* Header Background */}
      <div className="h-32 bg-gradient-to-r from-forge-navy to-forge-navy/80 relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
        >
          &larr; Back
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative -mt-16">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 md:p-8">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* Avatar */}
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-24 h-24 rounded-2xl border-4 border-white shadow-md object-cover bg-gray-200"
                  onError={(e) => {
                    // Fallback to UI Avatars if image fails to load
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=150`;
                  }}
                />
                <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-forge-orange text-white rounded-full flex items-center justify-center shadow-lg hover:bg-forge-orange/90 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
                {user.tier === WorkerTier.PREMIUM && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-forge-cyan rounded-full flex items-center justify-center" title="Premium Member">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      {fullName}
                    </h1>
                    <p className="text-gray-500">{username}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => navigate('/profile/edit')}
                  >
                    Edit Profile
                  </Button>
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                  {rating > 0 && (
                    <div className="flex items-center gap-1 text-forge-orange font-bold bg-orange-50 px-2 py-1 rounded">
                      <Star className="w-4 h-4 fill-current" />
                      {rating.toFixed(1)} ({reviewCount} reviews)
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    Member since {memberSince}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === UserRole.WORKER
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {user.role === UserRole.WORKER ? 'Worker' : 'Customer'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6 border-b border-gray-100">
              {(['overview', 'reviews', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                    activeTab === tab
                      ? 'text-forge-orange'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forge-orange" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Contact Info */}
                  <section>
                    <h3 className="text-lg font-bold text-forge-navy mb-4">Contact Information</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium text-gray-900">{user.email || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Phone className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="font-medium text-gray-900">{user.phone || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="font-medium text-gray-900">
                            {user.location || (user.country === 'GH' ? 'Ghana' : user.country === 'NG' ? 'Nigeria' : 'Not provided')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Account Type</p>
                          <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Bio */}
                  {user.bio && (
                    <section>
                      <h3 className="text-lg font-bold text-forge-navy mb-3">About</h3>
                      <p className="text-gray-600 leading-relaxed">{user.bio}</p>
                    </section>
                  )}

                  {/* Professionalism Stats (for workers) */}
                  {user.role === UserRole.WORKER && (
                    <section>
                      <h3 className="text-lg font-bold text-forge-navy mb-4">Professionalism</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                          <p className="text-2xl font-bold text-forge-navy">{professionalism.responseRate}%</p>
                          <p className="text-xs text-gray-500 mt-1">Response Rate</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                          <p className="text-2xl font-bold text-forge-navy">{professionalism.completionRate}%</p>
                          <p className="text-xs text-gray-500 mt-1">Job Completion</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                          <p className="text-2xl font-bold text-forge-navy">{professionalism.onTimeRate}%</p>
                          <p className="text-xs text-gray-500 mt-1">On-Time Delivery</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                          <p className="text-2xl font-bold text-forge-navy">{professionalism.repeatClients}</p>
                          <p className="text-xs text-gray-500 mt-1">Repeat Clients</p>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Premium Status */}
                  <section>
                    <h3 className="text-lg font-bold text-forge-navy mb-4">Subscription</h3>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          user.tier === WorkerTier.PREMIUM ? 'bg-cyan-100' : 'bg-gray-100'
                        }`}
                      >
                        {user.tier === WorkerTier.PREMIUM ? (
                          <ShieldCheck className="w-6 h-6 text-forge-cyan" />
                        ) : (
                          <Shield className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {user.tier === WorkerTier.PREMIUM ? 'Premium Member' : user.tier === WorkerTier.BASIC ? 'Basic Plan' : 'Free Plan'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {user.tier === WorkerTier.PREMIUM
                            ? 'You have the verified badge and premium features'
                            : 'Upgrade to Premium for verified badge and more features'}
                        </p>
                      </div>
                      {user.tier !== WorkerTier.PREMIUM && (
                        <Button size="sm" variant="primary">
                          Upgrade
                        </Button>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {reviewCount > 0 || mockReviews.length > 0 ? (
                    <>
                      {/* Rating Summary */}
                      <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl mb-6">
                        <div className="text-center">
                          <p className="text-4xl font-bold text-forge-orange">{rating.toFixed(1)}</p>
                          <div className="flex text-forge-orange mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < Math.round(rating) ? 'fill-current' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">
                            Based on {reviewCount || mockReviews.length} reviews
                          </p>
                        </div>
                      </div>

                      {/* Reviews List */}
                      {mockReviews.map((review) => (
                        <div key={review.id} className="p-4 bg-gray-50 rounded-xl">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                              <span className="font-medium text-gray-900">{review.author}</span>
                            </div>
                            <span className="text-xs text-gray-500">{review.date}</span>
                          </div>
                          <div className="flex text-forge-orange mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                          <p className="text-gray-600 text-sm">{review.text}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No reviews yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">Edit Profile</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">Privacy & Security</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">Notifications</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                  <div className="border-t border-gray-100 my-4" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UserProfile;
