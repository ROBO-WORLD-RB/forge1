import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/authService';
import { updateProfile, getProfileByUserId } from '../services/workerService';
import Button from '../components/Button';
import Input from '../components/Input';
import LocationCapture from '../components/LocationCapture';
import type { GeoCoordinates } from '../utils/geolocation';
import { 
  ArrowLeft, Camera, User, Mail, Phone, MapPin, 
  Briefcase, Save, Loader2, AlertCircle
} from 'lucide-react';
import { UserRole } from '../types';
import { CATEGORIES } from '../constants';
import PageHelmet from '../components/PageHelmet';
import VerificationUpload from '../components/VerificationUpload';
import { uploadPublicFile } from '../utils/storageUpload';

const ProfileEdit: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    location: user?.location || '',
    avatarUrl: user?.avatarUrl || '',
  });

  // Worker-specific state
  const [workerData, setWorkerData] = useState({
    role: '',
    skills: [] as string[],
    rateMin: '',
    rateMax: '',
    experienceYears: 1,
    acceptingWork: true,
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(formData.avatarUrl || null);
  const [workerProfileId, setWorkerProfileId] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<GeoCoordinates | null>(null);
  const [profileLoading, setProfileLoading] = useState(user?.role === UserRole.WORKER);

  useEffect(() => {
    if (!user || user.role !== UserRole.WORKER) {
      setProfileLoading(false);
      return;
    }

    const loadWorkerProfile = async () => {
      const { data } = await getProfileByUserId(user.id);
      if (data) {
        setWorkerProfileId(data.id);
        setWorkerData({
          role: data.role || '',
          skills: data.skills || [],
          rateMin: data.hourly_rate_min?.toString() || '',
          rateMax: data.hourly_rate_max?.toString() || '',
          experienceYears: data.experience_years ?? 1,
          acceptingWork: data.accepting_work !== false,
        });
        if (data.location_lat != null && data.location_lng != null) {
          setLocationCoords({ lat: data.location_lat, lng: data.location_lng });
        }
      }
      setProfileLoading(false);
    };

    loadWorkerProfile();
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, or WebP).');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller.');
      e.target.value = '';
      return;
    }

    // Preview immediately so the UI feels responsive
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const publicUrl = await uploadPublicFile('avatars', fileName, file, {
        upsert: true,
        label: 'Avatar upload',
        timeoutMs: 45_000,
      });
      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(
        err?.message?.includes('timed out')
          ? 'Image upload timed out. Check your connection and try again.'
          : err?.message || 'Failed to upload image. Please try again.'
      );
      setAvatarPreview(formData.avatarUrl || null);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Update user profile
      const profileUpdate = await updateUserProfile(user.id, {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        phone: formData.phone,
        bio: formData.bio || null,
        location: formData.location || null,
        avatar_url: formData.avatarUrl || null,
      });

      if (!profileUpdate) {
        throw new Error('Failed to update profile');
      }

      // If worker, update worker profile too
      if (user.role === UserRole.WORKER && workerProfileId) {
        await updateProfile(workerProfileId, {
          role: workerData.role || undefined,
          skills: workerData.skills,
          hourlyRate: {
            min: parseFloat(workerData.rateMin) || 0,
            max: parseFloat(workerData.rateMax) || 0,
            currency: user.country === 'GH' ? 'GHS' : 'NGN',
          },
          experienceYears: workerData.experienceYears,
          location: formData.location,
          bio: formData.bio,
          locationLat: locationCoords?.lat ?? null,
          locationLng: locationCoords?.lng ?? null,
          acceptingWork: workerData.acceptingWork,
        });
      }

      await refreshUser();
      setSuccess(true);
      setTimeout(() => navigate('/my-profile'), 1500);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  return (
    <>
      <PageHelmet title="Edit Profile" path="/profile/edit" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-4 md:pt-6 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-forge-navy">Edit Profile</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 p-4 rounded-xl">
              Profile updated successfully! Redirecting...
            </div>
          )}

          {/* Avatar Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Profile Photo</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 p-2 bg-forge-orange text-white rounded-full shadow-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm text-gray-600">Upload a new profile photo</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  icon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>

              <Input
                label="Email"
                value={user.email || ''}
                disabled
                icon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+233 XX XXX XXXX"
                icon={<Phone className="w-4 h-4" />}
              />

              <Input
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Accra, Ghana"
                icon={<MapPin className="w-4 h-4" />}
              />

              {user.role === UserRole.WORKER && (
                <LocationCapture
                  coordinates={locationCoords}
                  onCapture={setLocationCoords}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 p-4 focus:border-forge-orange focus:ring-forge-orange/20 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Worker KYC verification */}
          {user.role === UserRole.WORKER && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-4">Identity Verification</h2>
              <p className="text-sm text-gray-500 mb-4">
                Upload your documents for admin review. Verified workers get more visibility.
              </p>
              <VerificationUpload userId={user.id} />
            </div>
          )}

          {/* Worker-specific fields */}
          {user.role === UserRole.WORKER && (
            <>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-4">Professional Details</h2>
                <div className="space-y-4">
                  <Input
                    label="Primary Role"
                    value={workerData.role}
                    onChange={(e) => setWorkerData(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Electrician"
                    icon={<Briefcase className="w-4 h-4" />}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const current = workerData.skills;
                            const updated = current.includes(cat.title)
                              ? current.filter(s => s !== cat.title)
                              : [...current, cat.title];
                            setWorkerData(prev => ({ ...prev, skills: updated }));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            workerData.skills.includes(cat.title)
                              ? 'bg-forge-navy text-white border-forge-navy'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {cat.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Years of Experience: {workerData.experienceYears}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={workerData.experienceYears}
                      onChange={(e) => setWorkerData(prev => ({ ...prev, experienceYears: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-forge-orange"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-1">Pricing & availability</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Clear rates help customers book you. Toggle availability when you are busy.
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={`Min rate / hr (${user.country === 'GH' ? 'GHS' : 'NGN'})`}
                      type="number"
                      value={workerData.rateMin}
                      onChange={(e) => setWorkerData(prev => ({ ...prev, rateMin: e.target.value }))}
                      placeholder="0"
                    />
                    <Input
                      label={`Max rate / hr (${user.country === 'GH' ? 'GHS' : 'NGN'})`}
                      type="number"
                      value={workerData.rateMax}
                      onChange={(e) => setWorkerData(prev => ({ ...prev, rateMax: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <label className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Accepting new work</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Turn off when you are fully booked
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={workerData.acceptingWork}
                      onChange={(e) =>
                        setWorkerData((prev) => ({ ...prev, acceptingWork: e.target.checked }))
                      }
                      className="w-5 h-5 accent-forge-orange"
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              loading={loading || profileLoading}
              icon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default ProfileEdit;
