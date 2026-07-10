import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { approveVerification, rejectVerification } from '../../services/verificationService';
import type { VerificationDocument } from '../../types/database';
import { 
  Users, Briefcase, CreditCard, Shield, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronRight, Search,
  TrendingUp, Clock, FileText, Eye
} from 'lucide-react';
import PageHelmet from '../../components/PageHelmet';

interface Stats {
  totalUsers: number;
  totalWorkers: number;
  totalCustomers: number;
  totalJobs: number;
  openJobs: number;
  totalBookings: number;
  pendingVerifications: number;
  activeSubscriptions: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  government_id: 'Government ID',
  skill_certificate: 'Skill Certificate',
  selfie: 'Selfie Verification',
};

function formatDocType(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType.replace(/_/g, ' ');
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingVerifications, setPendingVerifications] = useState<VerificationDocument[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [verificationsLoading, setVerificationsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'users'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchStats(), fetchPendingVerifications()]);
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const [
        { count: totalUsers },
        { count: totalWorkers },
        { count: totalCustomers },
        { count: totalJobs },
        { count: openJobs },
        { count: totalBookings },
        { count: pendingVerifications },
        { count: activeSubscriptions },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        totalWorkers: totalWorkers || 0,
        totalCustomers: totalCustomers || 0,
        totalJobs: totalJobs || 0,
        openJobs: openJobs || 0,
        totalBookings: totalBookings || 0,
        pendingVerifications: pendingVerifications || 0,
        activeSubscriptions: activeSubscriptions || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPendingVerifications = async () => {
    setVerificationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('verification_documents')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setPendingVerifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch verifications:', err);
    } finally {
      setVerificationsLoading(false);
    }
  };

  const handleVerificationAction = async (doc: VerificationDocument, action: 'approved' | 'rejected', reason?: string) => {
    if (!user?.id) return;

    setActionLoading(doc.id);
    try {
      const result = action === 'approved'
        ? await approveVerification(doc.user_id, user.id)
        : await rejectVerification(doc.user_id, user.id, reason ?? '');

      if (!result.error) {
        setPendingVerifications(prev => prev.filter(v => v.user_id !== doc.user_id));
        await fetchStats();
      } else {
        console.error('Verification action failed:', result.error.message);
      }
    } catch (err) {
      console.error('Verification action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <>
        <PageHelmet title="Admin Dashboard" path="/admin" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
        </div>
      </div>
      </>
    );
  }

  const pendingCount = stats?.pendingVerifications ?? pendingVerifications.length;

  return (
    <>
      <PageHelmet title="Admin Dashboard" path="/admin" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-forge-navy">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage users, verifications, and platform settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {(['overview', 'verifications', 'users'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 font-medium capitalize transition-colors flex items-center gap-2 ${
                activeTab === tab
                  ? 'text-forge-orange border-b-2 border-forge-orange'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'verifications' && pendingCount > 0 && (
                <span className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-6 h-6" />}
                label="Total Users"
                value={stats?.totalUsers}
                color="blue"
                loading={statsLoading}
              />
              <StatCard
                icon={<Briefcase className="w-6 h-6" />}
                label="Workers"
                value={stats?.totalWorkers}
                color="orange"
                loading={statsLoading}
              />
              <StatCard
                icon={<TrendingUp className="w-6 h-6" />}
                label="Open Jobs"
                value={stats?.openJobs}
                color="green"
                loading={statsLoading}
              />
              <StatCard
                icon={<CreditCard className="w-6 h-6" />}
                label="Active Subscriptions"
                value={stats?.activeSubscriptions}
                color="purple"
                loading={statsLoading}
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-6 h-6" />}
                label="Customers"
                value={stats?.totalCustomers}
                color="cyan"
                loading={statsLoading}
              />
              <StatCard
                icon={<FileText className="w-6 h-6" />}
                label="Total Jobs"
                value={stats?.totalJobs}
                color="gray"
                loading={statsLoading}
              />
              <StatCard
                icon={<Clock className="w-6 h-6" />}
                label="Total Bookings"
                value={stats?.totalBookings}
                color="indigo"
                loading={statsLoading}
              />
              <StatCard
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Pending Verifications"
                value={stats?.pendingVerifications}
                color="yellow"
                highlight={!statsLoading && (stats?.pendingVerifications ?? 0) > 0}
                loading={statsLoading}
              />
            </div>

            {/* Quick Actions */}
            {!statsLoading && stats && stats.pendingVerifications > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-yellow-800 font-medium">
                    {stats.pendingVerifications} verification{stats.pendingVerifications !== 1 ? 's' : ''} pending review
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('verifications')}
                  className="text-yellow-700 hover:text-yellow-900 font-medium flex items-center gap-1"
                >
                  Review <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Verifications Tab */}
        {activeTab === 'verifications' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg text-gray-900">Pending Verifications</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review and approve worker identity documents
                </p>
              </div>
              {!verificationsLoading && (
                <span className="text-sm font-medium text-gray-500">
                  {pendingVerifications.length} pending
                </span>
              )}
            </div>
            {verificationsLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
                <p className="text-sm text-gray-500">Loading verifications...</p>
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-900 font-medium">All caught up</p>
                <p className="text-gray-500 text-sm mt-1">No pending verifications to review</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingVerifications.map(doc => (
                  <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {formatDocType(doc.doc_type)}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            User {doc.user_id.slice(0, 8)}…
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Submitted {formatRelativeDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View document"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        <button
                          onClick={() => handleVerificationAction(doc, 'approved')}
                          disabled={actionLoading === doc.id}
                          title="Approve"
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === doc.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason:');
                            if (reason) handleVerificationAction(doc, 'rejected', reason);
                          }}
                          disabled={actionLoading === doc.id}
                          title="Reject"
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">User Management</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-forge-orange"
                />
              </div>
            </div>
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>User management coming soon</p>
              <p className="text-sm mt-1">View and manage all platform users</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: number;
  color: string;
  highlight?: boolean;
  loading?: boolean;
}> = ({ icon, label, value, color, highlight, loading }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    cyan: 'bg-cyan-100 text-cyan-600',
    gray: 'bg-gray-100 text-gray-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 ${highlight ? 'ring-2 ring-yellow-400' : ''}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900">{(value ?? 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
