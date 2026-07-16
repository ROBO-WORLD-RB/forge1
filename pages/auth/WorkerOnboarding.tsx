import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createProfile, getCategories } from '../../services/workerService';
import { completeWorkerOnboardingProfile, updateUserProfile } from '../../services/authService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import LocationCapture from '../../components/LocationCapture';
import type { GeoCoordinates } from '../../utils/geolocation';
import { Camera, Briefcase, MapPin, DollarSign, Loader2 } from 'lucide-react';
import type { Country, Currency } from '../../types/database';
import PageHelmet from '../../components/PageHelmet';
import VerificationUpload from '../../components/VerificationUpload';
import { uploadPublicFile } from '../../utils/storageUpload';
import { withTimeout } from '../../utils/promiseTimeout';

const WorkerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    bio: '',
    role: '',
    experienceYears: 1,
    location: '',
    rateMin: '',
    rateMax: '',
    selectedSkills: [] as string[]
  });
  const [locationCoords, setLocationCoords] = useState<GeoCoordinates | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await getCategories();
      if (data) {
        setCategories(data);
      }
    };
    fetchCategories();
  }, []);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const [error, setError] = useState<string | null>(null);

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

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const publicUrl = await uploadPublicFile('avatars', fileName, file, {
        upsert: true,
        label: 'Profile photo upload',
        timeoutMs: 45_000,
      });
      setAvatarUrl(publicUrl);
      await updateUserProfile(user.id, { avatar_url: publicUrl });
    } catch (err: any) {
      console.error('Onboarding avatar upload error:', err);
      setError(
        err?.message?.includes('timed out')
          ? 'Photo upload timed out. Check your connection and try again.'
          : err?.message || 'Failed to upload photo. You can continue and add one later.'
      );
      setAvatarPreview(avatarUrl);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) return;
      
      // Determine country and currency based on user's country or default
      const country: Country = (user as any).country || 'GH';
      const currency: Currency = country === 'GH' ? 'GHS' : 'NGN';
      
      // Create worker profile using workerService
      const { error: createError } = await withTimeout(
        createProfile(user.id, {
          name: formData.name,
          bio: formData.bio,
          role: formData.role,
          skills: formData.selectedSkills,
          location: formData.location,
          country,
          hourlyRate: {
            min: parseFloat(formData.rateMin) || 0,
            max: parseFloat(formData.rateMax) || 0,
            currency
          },
          experienceYears: formData.experienceYears
        }),
        30_000,
        'Creating worker profile'
      );
      
      if (createError) {
        setError(createError.message);
        return;
      }

      if (avatarUrl) {
        await withTimeout(
          updateUserProfile(user.id, { avatar_url: avatarUrl }),
          15_000,
          'Saving profile photo'
        );
      }

      // Update user profile to mark as completed and set status to pending_payment
      await withTimeout(
        completeWorkerOnboardingProfile(user.id),
        20_000,
        'Completing onboarding'
      );
      
      await refreshUser();
      navigate('/auth/onboarding/payment', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message?.includes('timed out')
          ? 'Profile save timed out. Check your connection and try again.'
          : err.message || 'Failed to create profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-dynamic flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-orange" />
      </div>
    );
  }

  if (user.role !== 'worker') {
    navigate('/dashboard/customer', { replace: true });
    return null;
  }

  return (
    <>
      <PageHelmet title="Complete Your Profile" path="/auth/onboarding" />
      <div className="min-h-dynamic bg-gray-50 flex flex-col items-center pt-10 px-4 pb-nav">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Progress Bar */}
        <div className="bg-gray-100 h-2 w-full">
           <div 
             className="bg-forge-orange h-full transition-all duration-500" 
             style={{ width: `${(step / 3) * 100}%` }}
           />
        </div>

        <div className="p-8">
          <div className="mb-8">
            <span className="text-xs font-bold text-forge-orange uppercase tracking-wider">Step {step} of 3</span>
            <h1 className="text-2xl font-bold text-forge-navy mt-1">
              {step === 1 && "Create your profile"}
              {step === 2 && "Skills & Experience"}
              {step === 3 && "Rates & Availability"}
            </h1>
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              {error && step === 1 && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>
              )}
              <div className="flex flex-col items-center mb-6 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-forge-orange cursor-pointer transition-colors relative group overflow-hidden disabled:opacity-60"
                  aria-label="Upload profile photo"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-gray-400 group-hover:text-forge-orange" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <span className="text-white text-xs font-medium">Upload</span>
                    )}
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <p className="text-xs text-gray-500">
                  {uploadingAvatar ? 'Uploading photo…' : 'Tap to add a profile photo (optional)'}
                </p>
              </div>

              <Input 
                label="Full Name"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Kwame Mensah"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Bio</label>
                <textarea 
                  className="w-full rounded-xl border border-gray-300 p-4 focus:border-forge-orange focus:ring-forge-orange/20 outline-none"
                  rows={4}
                  placeholder="Describe your services and experience..."
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                />
              </div>

              <Input 
                label="City / Location"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                placeholder="e.g. Accra, Greater Accra"
                icon={<MapPin className="w-4 h-4" />}
              />

              <LocationCapture
                coordinates={locationCoords}
                onCapture={setLocationCoords}
              />

              <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={!formData.name || !formData.bio || uploadingAvatar}>
                  {uploadingAvatar ? 'Uploading…' : 'Next Step'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Skills */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <Input 
                label="Primary Role"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                placeholder="e.g. Electrician"
                icon={<Briefcase className="w-4 h-4" />}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Skills</label>
                <div className="flex flex-wrap gap-2">
                   {categories.map(cat => (
                     <button
                       key={cat.id}
                       onClick={() => {
                         const current = formData.selectedSkills;
                         const updated = current.includes(cat.name) 
                            ? current.filter(s => s !== cat.name)
                            : [...current, cat.name];
                         setFormData({...formData, selectedSkills: updated});
                       }}
                       className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                         formData.selectedSkills.includes(cat.name)
                         ? 'bg-forge-navy text-white border-forge-navy'
                         : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                       }`}
                     >
                       {cat.name}
                     </button>
                   ))}
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1.5">Years of Experience: {formData.experienceYears}</label>
                 <input 
                   type="range"
                   min="0"
                   max="30"
                   value={formData.experienceYears}
                   onChange={e => setFormData({...formData, experienceYears: parseInt(e.target.value)})}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-forge-orange"
                 />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={handleBack}>Back</Button>
                <Button onClick={handleNext} disabled={!formData.role}>Next Step</Button>
              </div>
            </div>
          )}

          {/* Step 3: Rates */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Minimum Hourly Rate"
                  type="number"
                  value={formData.rateMin}
                  onChange={e => setFormData({...formData, rateMin: e.target.value})}
                  icon={<DollarSign className="w-4 h-4" />}
                  placeholder="0.00"
                />
                <Input 
                  label="Maximum Hourly Rate"
                  type="number"
                  value={formData.rateMax}
                  onChange={e => setFormData({...formData, rateMax: e.target.value})}
                  icon={<DollarSign className="w-4 h-4" />}
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                Pro tip: Workers with clear pricing get 3x more bookings. You can change this later.
              </p>

              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="font-bold text-gray-900 mb-2">Verification Documents</h3>
                <p className="text-sm text-gray-500 mb-4">Upload ID and certificates for admin review.</p>
                <VerificationUpload userId={user.id} />
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="ghost" onClick={handleBack}>Back</Button>
                <Button 
                   onClick={handleSubmit} 
                   loading={loading}
                   disabled={!formData.rateMin || !formData.rateMax}
                >
                  Complete Profile
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
    </>
  );
};

export default WorkerOnboarding;