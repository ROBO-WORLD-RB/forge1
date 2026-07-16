import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { searchJobs, getJobsByPoster, createJob, deleteJob } from '../services/jobService';
import type { Job, Country, Currency } from '../types/database';
import { CATEGORIES } from '../constants';
import { 
  Briefcase, MapPin, DollarSign, Calendar, Plus, Search, 
  Loader2, Trash2, ChevronRight, X, Video, Upload, AlertCircle, RefreshCw
} from 'lucide-react';
import { uploadPublicFile } from '../utils/storageUpload';
import PageHelmet from '../components/PageHelmet';

const Jobs: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWorker = user?.role === 'worker';
  const canPostProject = Boolean(user) && !isWorker;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [myJobsError, setMyJobsError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-jobs'>('browse');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<Country | ''>('');

  // Form state for creating jobs
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    country: (user?.country || 'GH') as Country,
    budget_min: '',
    budget_max: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  
  // Media upload state
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    setFetchError(null);
    const filters: any = { status: 'open' };
    if (categoryFilter) filters.category = categoryFilter;
    if (countryFilter) filters.country = countryFilter;
    
    const result = await searchJobs(filters);
    if (result.error) {
      setFetchError(result.error.message || 'Failed to load projects. Please try again.');
      setJobs([]);
    } else if (result.data) {
      setJobs(result.data);
    } else {
      setJobs([]);
    }
    setLoading(false);
  };

  const fetchMyJobs = async () => {
    if (!user?.id) {
      setMyJobs([]);
      setMyJobsError(null);
      return;
    }
    setMyJobsError(null);
    const result = await getJobsByPoster(user.id);
    if (result.error) {
      setMyJobsError(result.error.message || 'Failed to load your projects.');
      setMyJobs([]);
      return;
    }
    setMyJobs(result.data || []);
  };

  // Wait for auth so we do not fetch "my jobs" before the session user is ready
  useEffect(() => {
    if (authLoading) return;
    fetchJobs();
    if (user?.id && canPostProject) {
      fetchMyJobs();
    } else {
      setMyJobs([]);
      setMyJobsError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: filters + auth identity
  }, [authLoading, user?.id, canPostProject, categoryFilter, countryFilter]);

  // Refetch posted projects when opening the My Projects tab
  useEffect(() => {
    if (authLoading || activeTab !== 'my-jobs' || !user?.id || !canPostProject) return;
    fetchMyJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authLoading, user?.id, canPostProject]);

  // Deep-link: /jobs?create=1 opens the post modal for customers
  useEffect(() => {
    if (authLoading || !canPostProject) return;
    if (searchParams.get('create') === '1') {
      setShowCreateModal(true);
      setActiveTab('my-jobs');
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  }, [authLoading, canPostProject, searchParams, setSearchParams]);

  // Handle media file selection
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for video, 5MB for images
      return (isImage || isVideo) && file.size <= maxSize;
    });

    if (validFiles.length + mediaFiles.length > 5) {
      setCreateError('Maximum 5 files allowed');
      return;
    }

    setMediaFiles(prev => [...prev, ...validFiles]);
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Upload media files to Supabase Storage (with timeout so UI cannot hang forever)
  const uploadMedia = async (): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];
    if (!user?.id) throw new Error('You must be signed in to upload media');
    
    setUploading(true);
    const urls: string[] = [];
    
    try {
      for (const file of mediaFiles) {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const url = await uploadPublicFile('job-media', fileName, file, {
          label: 'Project media upload',
          timeoutMs: 60_000,
        });
        urls.push(url);
      }
    } finally {
      setUploading(false);
    }
    
    return urls;
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setCreateError('You must be logged in to post a project');
      return;
    }
    if (isWorker) {
      setCreateError('Workers browse and apply to projects. Only customers can post projects.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    
    try {
      // Upload media first — surface failures instead of silently dropping media
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        try {
          mediaUrls = await uploadMedia();
        } catch (uploadErr: any) {
          console.error('Media upload error:', uploadErr);
          setCreateError(
            uploadErr?.message ||
              'Media upload failed or timed out. Check your connection and try again, or post without photos.'
          );
          setCreating(false);
          return;
        }
      }

      const currency: Currency = formData.country === 'GH' ? 'GHS' : 'NGN';
      
      const result = await createJob(user.id, {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        location: formData.location,
        country: formData.country,
        budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
        budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
        currency,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      });

      if (result.error) {
        setCreateError(result.error.message || 'Failed to create project. Please try again.');
        setCreating(false);
        return;
      }

      if (!result.data) {
        setCreateError('Project was not saved. Check that you are signed in and your profile exists.');
        setCreating(false);
        return;
      }

      const created = result.data;
      setMyJobs(prev => [created, ...prev.filter(j => j.id !== created.id)]);
      setJobs(prev => [created, ...prev.filter(j => j.id !== created.id)]);
      setShowCreateModal(false);
      setCreateError(null);
      setFormData({
        title: '',
        description: '',
        category: '',
        location: '',
        country: user?.country || 'GH',
        budget_min: '',
        budget_max: '',
      });
      setMediaFiles([]);
      setMediaPreviews([]);
      setActiveTab('my-jobs');
      // Confirm persist from DB (catches silent RLS / filter mismatches)
      void fetchMyJobs();
    } catch (err: any) {
      console.error('Error creating job:', err);
      setCreateError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    setDeletingJobId(jobId);
    setDeleteError(null);
    try {
      const result = await deleteJob(jobId);
      if (!result.error) {
        setMyJobs(prev => prev.filter(j => j.id !== jobId));
        setJobs(prev => prev.filter(j => j.id !== jobId));
      } else {
        setDeleteError(result.error.message || 'Failed to delete project');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setDeleteError('Failed to delete project. Please try again.');
    } finally {
      setDeletingJobId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'filled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'filled': return 'Filled';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  // Browse shows all open jobs (including your own — previously hidden for workers, which looked like "jobs disappearing")
  const filteredJobs = (activeTab === 'browse' ? jobs : myJobs).filter(job => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(term) ||
      job.category.toLowerCase().includes(term) ||
      job.location.toLowerCase().includes(term)
    );
  });

  return (
    <>
      <PageHelmet title={isWorker ? 'Browse Projects' : 'Projects'} path="/jobs" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-safe md:pt-0">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-forge-navy">
              {isWorker ? 'Browse Projects' : 'Projects'}
            </h1>
            <p className="text-gray-500 mt-1">
              {isWorker
                ? 'Find open customer projects and apply'
                : 'Post a project or browse what others need done'}
            </p>
          </div>
          {canPostProject && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-forge-orange text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Post a Project
            </button>
          )}
          {isWorker && (
            <Link
              to="/profile/edit"
              className="bg-white text-forge-navy border border-gray-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Grow your reach
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'browse' 
                ? 'text-forge-orange border-b-2 border-forge-orange' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isWorker ? 'Open Projects' : 'Browse Projects'}
          </button>
          {canPostProject && (
            <button
              onClick={() => setActiveTab('my-jobs')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'my-jobs' 
                  ? 'text-forge-orange border-b-2 border-forge-orange' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Projects ({myJobs.length})
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-forge-orange"
            />
          </div>
          {activeTab === 'browse' && (
            <>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-forge-orange"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.title}>{cat.title}</option>
                ))}
              </select>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value as Country | '')}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-forge-orange"
              >
                <option value="">All Countries</option>
                <option value="GH">Ghana</option>
                <option value="NG">Nigeria</option>
              </select>
            </>
          )}
        </div>

        {deleteError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {deleteError}
            </span>
            <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {myJobsError && activeTab === 'my-jobs' && canPostProject && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {myJobsError}
            </span>
            <button
              onClick={() => fetchMyJobs()}
              className="inline-flex items-center gap-1 text-red-700 font-medium hover:underline"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Projects List */}
        {authLoading || loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl">
            <Loader2 className="w-8 h-8 text-forge-orange animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Loading projects...</p>
          </div>
        ) : fetchError && activeTab === 'browse' ? (
          <div className="text-center py-12 bg-white rounded-xl px-6">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium text-gray-900">Couldn&apos;t load projects</p>
            <p className="text-gray-500 mt-1 text-sm">{fetchError}</p>
            <button
              onClick={fetchJobs}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl px-6">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-forge-navy">No projects found</p>
            <p className="text-gray-500 mt-1 text-sm">
              {activeTab === 'my-jobs'
                ? 'You haven\'t posted any projects yet. Post one to find workers.'
                : searchTerm || categoryFilter || countryFilter
                  ? 'No projects match your search or filters.'
                  : isWorker
                    ? 'No open projects right now. Check back soon, or improve your profile to get discovered.'
                    : 'No open projects right now. Be the first to post one.'}
            </p>
            {activeTab === 'my-jobs' && canPostProject && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Post a Project
              </button>
            )}
            {activeTab === 'browse' && isWorker && (
              <Link
                to="/profile/edit"
                className="mt-4 inline-flex items-center gap-2 text-forge-orange text-sm font-medium hover:underline"
              >
                Update your profile to grow reach
              </Link>
            )}
            {activeTab === 'browse' && (searchTerm || categoryFilter || countryFilter) && (
              <button
                onClick={() => { setSearchTerm(''); setCategoryFilter(''); setCountryFilter(''); }}
                className="mt-4 text-forge-orange text-sm font-medium hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map(job => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                      {job.poster_user_id === user?.id && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          Your project
                        </span>
                      )}
                      {isWorker &&
                        activeTab === 'browse' &&
                        job.status === 'open' &&
                        job.poster_user_id !== user?.id && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-forge-orange">
                          Open to apply
                        </span>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {job.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}, {job.country === 'GH' ? '🇬🇭' : '🇳🇬'}
                      </span>
                      {job.budget_min && job.budget_max && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {job.currency} {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {job.poster_user_id === user?.id && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        disabled={deletingJobId === job.id}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingJobId === job.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    <span className="p-2 text-forge-orange">
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>


      {/* Create Project Modal — customers only */}
      {showCreateModal && canPostProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-forge-navy">Post a Project</h2>
              <button onClick={() => { setShowCreateModal(false); setCreateError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Need a plumber for bathroom repair"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what you need done..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.title}>{cat.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Accra, East Legon"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <select
                    required
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value as Country }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                  >
                    <option value="GH">Ghana</option>
                    <option value="NG">Nigeria</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Budget ({formData.country === 'GH' ? 'GHS' : 'NGN'})
                  </label>
                  <input
                    type="number"
                    value={formData.budget_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget_min: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Budget ({formData.country === 'GH' ? 'GHS' : 'NGN'})
                  </label>
                  <input
                    type="number"
                    value={formData.budget_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget_max: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-forge-orange"
                  />
                </div>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos & Videos (optional)
                </label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                  {mediaPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {mediaPreviews.map((preview, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                          {mediaFiles[idx]?.type.startsWith('video/') ? (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <Video className="w-8 h-8 text-white" />
                            </div>
                          ) : (
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => removeMedia(idx)}
                            className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {mediaFiles.length < 5 && (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-gray-50 rounded-lg transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Click to upload photos or videos</span>
                      <span className="text-xs text-gray-400 mt-1">Max 5 files (5MB images, 50MB videos)</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={handleMediaSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || uploading}
                  className="flex-1 px-4 py-2 bg-forge-orange text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating || uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploading ? 'Uploading media...' : 'Posting...'}
                    </>
                  ) : (
                    'Post Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Jobs;
