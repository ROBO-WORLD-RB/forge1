import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookingsByCustomer } from '../../services/bookingService';
import { getJobsByPoster } from '../../services/jobService';
import { getNotifications, markNotificationRead } from '../../services/notificationService';
import { getUnreadCount } from '../../services/chatService';
import { getCategories } from '../../services/workerService';
import type { Booking, Job, Notification as DBNotification } from '../../types/database';
import { 
  Clock, CheckCircle, Briefcase, MessageSquare, 
  Bell, Plus, ChevronRight, Loader2, X,
  Calendar, MapPin, DollarSign, Search
} from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';

const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback categories
  const fallbackCategories = [
    { id: 'f1', name: 'Electrical', slug: 'electrical' },
    { id: 'f2', name: 'Plumbing', slug: 'plumbing' },
    { id: 'f3', name: 'Carpentry', slug: 'carpentry' },
    { id: 'f4', name: 'Painting', slug: 'painting' },
  ];

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Add a timeout to the categories fetch specifically
        const categoriesFetch = async () => {
          try {
            const fetchPromise = getCategories();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Categories timeout')), 5000)
            );
            const { data } = await Promise.race([fetchPromise, timeoutPromise]) as any;
            return data || [];
          } catch (e) {
            console.error('Categories fetch failed:', e);
            return fallbackCategories;
          }
        };

        const [bookingsResult, jobsResult, notifResult, unreadResult, categoriesData] = await Promise.all([
          getBookingsByCustomer(user.id),
          getJobsByPoster(user.id),
          getNotifications(user.id),
          getUnreadCount(user.id),
          categoriesFetch()
        ]);
        
        if (bookingsResult.data) setBookings(bookingsResult.data);
        if (jobsResult.data) setJobs(jobsResult.data);
        if (notifResult.data) setNotifications(notifResult.data.slice(0, 5));
        if (unreadResult.data !== null) setUnreadMessages(unreadResult.data);
        setCategories(categoriesData.slice(0, 4));
        
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.id]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    const result = await markNotificationRead(notificationId);
    if (!result.error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeBookings = bookings.filter(b => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status)).length;
  const openJobs = jobs.filter(j => j.status === 'open').length;
  const unreadNotifications = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <>
        <PageHelmet title="Customer Dashboard" path="/dashboard/customer" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHelmet title="Customer Dashboard" path="/dashboard/customer" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-forge-navy">
              Customer Dashboard
            </h1>
            <p className="text-gray-500 mt-1">
              Find the right pro for your project today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link 
              to="/search" 
              className="bg-white text-forge-navy border border-gray-200 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all font-medium"
            >
              <Search className="w-5 h-5" />
              Find Workers
            </Link>
            <Link 
              to="/jobs?create=1" 
              className="bg-forge-orange text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-forge-orange/20 font-bold"
            >
              <Plus className="w-5 h-5" />
              Post a Project
            </Link>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-orange">
            <div className="text-gray-500 text-sm mb-1">Active Projects</div>
            <div className="text-3xl font-bold text-gray-900">{activeBookings}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-forge-green">
            <div className="text-gray-500 text-sm mb-1">Open Projects</div>
            <div className="text-3xl font-bold text-gray-900">{openJobs}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
            <div className="text-gray-500 text-sm mb-1">Unread Messages</div>
            <div className="text-3xl font-bold text-gray-900">{unreadMessages}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
            <div className="text-gray-500 text-sm mb-1">Total Spent</div>
            <div className="text-2xl font-bold text-gray-900">
              {user?.country === 'NG' ? '₦0' : 'GH₵ 0'}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* My Projects */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">My Active Projects</h2>
              <Link to="/bookings" className="text-forge-orange text-sm hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {bookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="mb-4">You haven't booked any pros yet.</p>
                  <Link to="/search" className="bg-gray-100 text-forge-navy px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors inline-block">
                    Browse Pros
                  </Link>
                </div>
              ) : (
                bookings.slice(0, 4).map(booking => (
                  <div key={booking.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {booking.customer_message || 'Project Details'}
                        </p>
                      </div>
                      <Link 
                        to={`/bookings/${booking.id}`}
                        className="text-forge-orange hover:bg-orange-50 p-2 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                Recent Notifications
                {unreadNotifications > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadNotifications}
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No new updates</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`p-4 hover:bg-gray-50 transition-colors ${!notification.read_at ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{notification.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{notification.body}</p>
                      </div>
                      {!notification.read_at && (
                        <button 
                          onClick={() => handleMarkNotificationRead(notification.id)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Explore Categories */}
        <div className="mt-8">
          <h2 className="font-bold text-xl text-forge-navy mb-4">Explore Services</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {categories.map(cat => (
               <Link key={cat.id} to={`/search?cat=${cat.slug}`} className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-center justify-center text-center flex-col gap-2 group">
                 <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-forge-orange/10 transition-colors">
                    <Briefcase className="w-5 h-5 text-gray-400 group-hover:text-forge-orange" />
                 </div>
                 <span className="font-medium text-gray-900">{cat.name}</span>
               </Link>
             ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default CustomerDashboard;
