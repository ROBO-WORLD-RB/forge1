import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { approveVerification, rejectVerification } from '../../services/verificationService';
import { listDisputesAdmin, resolveDispute, type DisputeWithMeta } from '../../services/disputeService';
import { searchProfilesAdmin, type AdminProfileRow } from '../../services/adminService';
import type { DisputeStatus, VerificationDocument } from '../../types/database';
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
  openDisputes: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  government_id: 'Government ID',
  skill_certificate: 'Skill Certificate',
  selfie: 'Selfie Verification',
};

function formatDocType(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType.replace(/_/g, ' ');
}

/** Open a verification doc — re-sign private storage paths when the stored URL expired. */
async function openVerificationDocument(fileUrl: string): Promise<void> {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  // Stored as storage path: {userId}/{docType}-{ts}.{ext}
  const { data, error } = await supabase.storage
    .from('verification-documents')
    .createSignedUrl(fileUrl, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error('Failed to sign verification document URL', error);
    alert('Could not open document. It may have been removed.');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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
  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'users' | 'disputes'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [disputes, setDisputes] = useState<DisputeWithMeta[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<DisputeStatus | 'all'>('open');

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
        { count: openDisputes },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('verification_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        (supabase.from('disputes') as any).select('*', { count: 'exact', head: true }).eq('status', 'open'),
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
        openDisputes: openDisputes || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = useCallback(async (q?: string) => {
    setUsersLoading(true);
    const result = await searchProfilesAdmin(q, 50);
    if (result.data) setUsers(result.data);
    else setUsers([]);
    setUsersLoading(false);
  }, []);

  const fetchDisputes = useCallback(async (filter: DisputeStatus | 'all') => {
    setDisputesLoading(true);
    const result = await listDisputesAdmin(filter);
    if (result.data) setDisputes(result.data);
    else setDisputes([]);
    setDisputesLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'users') void fetchUsers(userSearch);
  }, [activeTab, fetchUsers]);

  useEffect(() => {
    if (activeTab === 'disputes') void fetchDisputes(disputeFilter);
  }, [activeTab, disputeFilter, fetchDisputes]);

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
  const openDisputeCount = stats?.openDisputes ?? 0;

  const handleResolveDispute = async (dispute: DisputeWithMeta, status: 'resolved' | 'closed') => {
    const notes =
      prompt(status === 'resolved' ? 'Resolution notes (optional):' : 'Close notes (optional):') ?? undefined;
    setActionLoading(dispute.id);
    const result = await resolveDispute(dispute.id, status, notes || undefined);
    if (!result.error) {
      await fetchDisputes(disputeFilter);
      await fetchStats();
    } else {
      alert(result.error.message || 'Failed to update dispute');
    }
    setActionLoading(null);
  };

  return (
    <>
      <PageHelmet title="Admin Dashboard" path="/admin" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-4 md:pt-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-forge-navy">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage users, verifications, disputes, and platform health</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 overflow-x-auto">
          {(['overview', 'verifications', 'users', 'disputes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 font-medium capitalize transition-colors flex items-center gap-2 whitespace-nowrap ${
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
              {tab === 'disputes' && openDisputeCount > 0 && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {openDisputeCount}
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Open Disputes"
                value={stats?.openDisputes}
                color="yellow"
                highlight={!statsLoading && (stats?.openDisputes ?? 0) > 0}
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
            {!statsLoading && stats && (stats.openDisputes ?? 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-800 font-medium">
                    {stats.openDisputes} open dispute{stats.openDisputes !== 1 ? 's' : ''} (escrow paused)
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('disputes')}
                  className="text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
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
                        <button
                          type="button"
                          onClick={() => void openVerificationDocument(doc.file_url)}
                          title="View document"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
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
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-gray-900">Users</h2>
                <p className="text-sm text-gray-500 mt-0.5">Search by name, username, phone, or email</p>
              </div>
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  void fetchUsers(userSearch);
                }}
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-forge-orange w-full sm:w-64"
                />
              </form>
            </div>
            {usersLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
                <p className="text-sm text-gray-500">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium text-gray-900">No users found</p>
                <p className="text-sm mt-1">Try a different search, or clear the query</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map((u) => {
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
                  return (
                    <div key={u.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{name}</p>
                        <p className="text-sm text-gray-500 truncate">{u.email || 'No email'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u.role} · {u.country || '—'} · joined {formatRelativeDate(u.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {u.role}
                        </span>
                        {u.verified && (
                          <span className="text-xs text-green-700">Verified</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-gray-900">Disputes</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Open disputes pause escrow release until resolved
                </p>
              </div>
              <div className="flex gap-2">
                {(['open', 'resolved', 'closed', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDisputeFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                      disputeFilter === f
                        ? 'bg-forge-orange text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {disputesLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-forge-orange animate-spin" />
                <p className="text-sm text-gray-500">Loading disputes...</p>
              </div>
            ) : disputes.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-900 font-medium">No disputes</p>
                <p className="text-gray-500 text-sm mt-1">
                  {disputeFilter === 'open' ? 'No open disputes right now' : 'Nothing matches this filter'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {disputes.map((d) => (
                  <div key={d.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                              d.status === 'open'
                                ? 'bg-amber-100 text-amber-800'
                                : d.status === 'resolved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {d.status}
                          </span>
                          {d.booking_status && (
                            <span className="text-xs text-gray-500">Booking: {d.booking_status}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900">{d.reason}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Opened by {d.opener_name || d.opener_id.slice(0, 8)} ·{' '}
                          {formatRelativeDate(d.created_at)} · Booking #{d.booking_id.slice(0, 8)}
                        </p>
                        {d.notes && (
                          <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">
                            Notes: {d.notes}
                          </p>
                        )}
                      </div>
                      {d.status === 'open' && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            title="Resolve"
                            disabled={actionLoading === d.id}
                            onClick={() => void handleResolveDispute(d, 'resolved')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === d.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Close"
                            disabled={actionLoading === d.id}
                            onClick={() => void handleResolveDispute(d, 'closed')}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
