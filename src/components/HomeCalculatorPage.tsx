import { useEffect, useMemo, useRef, useState } from 'react';
import homeHeroImg from '../assets/images/kisan_home_hero_1795296050321.jpg';
import {
  getDistrictsForState,
  getTaluksForDistrict,
  INDIAN_STATES,
} from '../data/indiaLocations';
import type {
  AgriExpert,
  AgriculturalJob,
  CalculatorCrop,
  FarmerCropLot,
  MainTab,
  MandiRate,
  Profession,
  UserProfile,
} from '../types/kisan';
import { ResilientImage } from './ResilientImage';

interface HomeCalculatorPageProps {
  profile: UserProfile;
  savedCrops: CalculatorCrop[];
  jobs: AgriculturalJob[];
  crops: FarmerCropLot[];
  experts: AgriExpert[];
  mandiRates: MandiRate[];
  onNavigateTab: (tab: MainTab) => void;
  onSaveProfile: (payload: Partial<UserProfile>) => Promise<void>;
  onDeleteCrop: (id: string) => Promise<void>;
}

const PROFESSION_OPTIONS: Array<{ value: Profession; label: string; icon: string }> = [
  { value: 'farmer', label: 'Farmer', icon: 'agriculture' },
  { value: 'worker', label: 'Farm Worker', icon: 'handyman' },
  { value: 'supplier', label: 'Supplier / Trader', icon: 'storefront' },
  { value: 'expert', label: 'Agricultural Expert', icon: 'support_agent' },
];

const PROFESSION_LABELS: Record<Profession, string> = {
  farmer: 'Farmer',
  worker: 'Farm Worker',
  supplier: 'Supplier / Trader',
  expert: 'Agricultural Expert',
};

const formatINR = (num: number) => `₹${Math.max(0, Math.round(num)).toLocaleString('en-IN')}`;

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const maxSide = 256;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function HomeCalculatorPage({
  profile,
  savedCrops,
  jobs,
  crops,
  experts,
  mandiRates,
  onNavigateTab,
  onSaveProfile,
  onDeleteCrop,
}: HomeCalculatorPageProps) {
  const [isEditing, setIsEditing] = useState(!profile.profileCompleted);
  const [name, setName] = useState(profile.name || '');
  const [profession, setProfession] = useState<Profession>(profile.profession || 'farmer');
  const [state, setState] = useState(profile.state || '');
  const [district, setDistrict] = useState(profile.district || '');
  const [taluk, setTaluk] = useState(profile.taluk || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile.name || '');
    setProfession(profile.profession || 'farmer');
    setState(profile.state || '');
    setDistrict(profile.district || '');
    setTaluk(profile.taluk || '');
    setAvatarUrl(profile.avatarUrl || '');
    if (!profile.profileCompleted) {
      setIsEditing(true);
    }
  }, [profile]);

  const availableDistricts = state ? getDistrictsForState(state) : [];
  const availableTaluks = state && district ? getTaluksForDistrict(state, district) : [];

  const handleStateChange = (nextState: string) => {
    setState(nextState);
    setDistrict('');
    setTaluk('');
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    setTaluk('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a valid image file.');
      return;
    }
    setPhotoError('');
    try {
      const compressed = await compressImageToDataUrl(file);
      setAvatarUrl(compressed);
      if (!isEditing && profile.profileCompleted) {
        setSaving(true);
        try {
          await onSaveProfile({
            ...profile,
            avatarUrl: compressed,
            profileCompleted: true,
          });
        } finally {
          setSaving(false);
        }
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to upload photo.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!state || !district || !taluk) {
      setFormError('Please select your State, District, and Taluk.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await onSaveProfile({
        name: name.trim(),
        profession,
        state,
        district,
        taluk,
        avatarUrl: avatarUrl || profile.avatarUrl,
        profileCompleted: true,
      });
      setIsEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const expertsOnlineCount = useMemo(
    () => experts.filter((exp) => exp.isAvailableNow).length,
    [experts]
  );

  const featuredMandiRate = useMemo(() => {
    if (mandiRates.length === 0) return null;
    return [...mandiRates].sort((a, b) => b.pricePerKg - a.pricePerKg)[0];
  }, [mandiRates]);

  const locationSummary = [profile.taluk, profile.district, profile.state]
    .filter(Boolean)
    .join(', ');

  const quickServices: Array<{
    tab: MainTab;
    title: string;
    subtitle: string;
    metric: string;
    icon: string;
    toneClass: string;
  }> = [
    {
      tab: 'workers',
      title: 'Workers',
      subtitle: 'Post farm tasks & manage workers',
      metric: `${jobs.length} active ${jobs.length === 1 ? 'listing' : 'listings'}`,
      icon: 'group',
      toneClass: 'bg-[#E9F7EE] text-[#003B1B]',
    },
    {
      tab: 'market',
      title: 'Market',
      subtitle: 'List produce lots & trader offers',
      metric: `${crops.length} live ${crops.length === 1 ? 'lot' : 'lots'}`,
      icon: 'storefront',
      toneClass: 'bg-[#EAF3FF] text-[#0F2F6B]',
    },
    {
      tab: 'insights',
      title: 'Crop Advisor',
      subtitle: 'Photo diagnosis & regional crop fit',
      metric: `${mandiRates.length} mandi references`,
      icon: 'psychology_alt',
      toneClass: 'bg-[#FFF8DF] text-[#5A4300]',
    },
    {
      tab: 'expert-sathi',
      title: 'Expert Sathi',
      subtitle: 'Direct specialist call & WhatsApp',
      metric: `${expertsOnlineCount} online now`,
      icon: 'support_agent',
      toneClass: 'bg-[#F3EEFF] text-[#3B1478]',
    },
  ];

  const latestJobs = jobs.slice(0, 2);
  const latestCrops = crops.slice(0, 2);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 pb-8 pt-3 gap-6 overflow-x-clip">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. Balanced Hero Overview Banner */}
      <section className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/25 overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-secondary">
              <span>{profile.name ? `Namaste, ${profile.name}` : 'Welcome to Kisan Sathi'}</span>
              {locationSummary && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-on-surface-variant">{locationSummary}</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-[2rem] leading-tight font-extrabold text-primary tracking-tight text-balance">
              Smart Farm Operations &amp; Direct Crop Market
            </h1>

            <p className="text-sm sm:text-[15px] text-on-surface-variant leading-relaxed max-w-xl">
              Hire local agricultural workers, publish harvest lots for direct trade, consult specialists, and inspect crop health from one workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('workers')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">group_add</span>
              <span>Find or Post Workers</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('market')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-surface-container-low text-primary text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-secondary-container/40 transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              <span>Open Crop Market</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-outline-variant/25">
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-extrabold text-primary tabular-nums block">
                {jobs.length}
              </span>
              <span className="text-[11px] sm:text-xs text-on-surface-variant block truncate">
                Work Listings
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-extrabold text-primary tabular-nums block">
                {crops.length}
              </span>
              <span className="text-[11px] sm:text-xs text-on-surface-variant block truncate">
                Crop Lots
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-extrabold text-secondary tabular-nums block">
                {expertsOnlineCount}
              </span>
              <span className="text-[11px] sm:text-xs text-on-surface-variant block truncate">
                Experts Online
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[210px] sm:min-h-[250px] lg:min-h-full bg-primary-container overflow-hidden">
          {!heroImgFailed ? (
            <img
              src={homeHeroImg}
              alt="Indian farmer inspecting green crops on a sunlit terraced agricultural farm"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary via-primary-container to-secondary flex items-center justify-center p-6">
              <span className="material-symbols-outlined text-white/80 text-[56px]">
                agriculture
              </span>
            </div>
          )}

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
          />

          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white flex items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-tertiary-fixed block">
                {featuredMandiRate ? 'Today’s Top Mandi Reference' : 'Kisan Sathi Network'}
              </span>
              <p className="text-sm sm:text-base font-bold truncate">
                {featuredMandiRate
                  ? `${featuredMandiRate.crop} · ₹${featuredMandiRate.pricePerKg}/kg`
                  : 'Seasonal Crop & Market Desk'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('insights')}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/95 text-primary text-xs font-bold inline-flex items-center gap-1 shrink-0 hover:bg-white transition-colors"
            >
              <span>Crop Advisor</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Quick Access to Core Workspaces */}
      <section aria-labelledby="home-services-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="home-services-heading" className="text-base sm:text-lg font-bold text-on-surface">
            Quick Workspace Access
          </h2>
          <span className="text-xs text-on-surface-variant">Tap any module to open</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickServices.map((svc) => (
            <button
              key={svc.tab}
              type="button"
              onClick={() => onNavigateTab(svc.tab)}
              className="group text-left bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/25 hover:border-secondary/60 hover:shadow-md active:scale-[0.99] transition-all flex flex-col justify-between gap-3 min-w-0"
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div
                  className={`w-10 h-10 rounded-xl ${svc.toneClass} flex items-center justify-center shrink-0`}
                >
                  <span className="material-symbols-outlined text-[22px]">{svc.icon}</span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                  arrow_forward
                </span>
              </div>

              <div className="space-y-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                  {svc.title}
                </h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 leading-snug">
                  {svc.subtitle}
                </p>
              </div>

              <span className="text-[11px] font-semibold text-secondary tabular-nums truncate">
                {svc.metric}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Live Worker & Market Highlights */}
      <section aria-labelledby="home-activity-heading" className="flex flex-col gap-3">
        <h2 id="home-activity-heading" className="text-base sm:text-lg font-bold text-on-surface">
          Recent Activity Across Your Network
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Work Listings */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                  Active Farm Work Listings
                </h3>
                <p className="text-xs text-on-surface-variant">Latest posted field requirements</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('workers')}
                className="min-h-[40px] px-3 rounded-xl text-xs font-bold text-secondary hover:text-primary inline-flex items-center gap-1 shrink-0"
              >
                <span>View All</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            {latestJobs.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">
                No active worker postings at the moment.
              </p>
            ) : (
              <div className="divide-y divide-outline-variant/25">
                {latestJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onNavigateTab('workers')}
                    className="w-full py-3 first:pt-1 last:pb-1 text-left flex items-center justify-between gap-3 hover:opacity-85 transition-opacity min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">{job.workName}</p>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {job.village} · {job.duration} · {job.farmerName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-primary tabular-nums block">
                        {formatINR(job.wagePerDay)}/day
                      </span>
                      <span className="text-[11px] text-secondary font-semibold tabular-nums block">
                        {job.workersNeededMale + job.workersNeededFemale} needed
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Crop Lots */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                  Latest Farmer Crop Lots
                </h3>
                <p className="text-xs text-on-surface-variant">Direct farmgate produce prices</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('market')}
                className="min-h-[40px] px-3 rounded-xl text-xs font-bold text-secondary hover:text-primary inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Market</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            {latestCrops.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">
                No crop lots listed at the moment.
              </p>
            ) : (
              <div className="divide-y divide-outline-variant/25">
                {latestCrops.map((crop) => (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => onNavigateTab('market')}
                    className="w-full py-3 first:pt-1 last:pb-1 text-left flex items-center justify-between gap-3 hover:opacity-85 transition-opacity min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">{crop.cropName}</p>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {crop.farmerName} · {crop.village} · {crop.quantity} {crop.unitShort}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-primary tabular-nums block">
                        {formatINR(crop.pricePerUnit)}/{crop.unitShort}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-semibold tabular-nums block">
                        Total {formatINR(crop.pricePerUnit * crop.quantity)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Profile / Farmer Information Section */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px] material-symbols-filled">
                badge
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-lg font-bold text-on-surface truncate">
                {isEditing ? 'Farmer Profile Details' : 'Farmer Information'}
              </h2>
              <p className="text-xs text-on-surface-variant truncate">
                {isEditing
                  ? 'Enter your name, profession, state, district & taluk'
                  : 'Verified Kisan Sathi farmer profile'}
              </p>
            </div>
          </div>

          {profile.profileCompleted && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="min-h-[40px] px-3.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        {photoError && (
          <p className="text-xs text-error bg-error-container px-3 py-2 rounded-xl font-medium">
            {photoError}
          </p>
        )}

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            {/* Profile Picture Upload */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-container-low flex-wrap">
              <ResilientImage
                src={avatarUrl || profile.avatarUrl}
                alt={name || 'Profile Picture'}
                className="w-16 h-16 rounded-full object-cover shadow-sm shrink-0 border-2 border-primary-fixed"
                fallbackText={(name || 'KS').slice(0, 2).toUpperCase()}
                fallbackClassName="bg-primary text-on-primary text-lg"
              />
              <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-on-surface">Profile Picture</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 px-3.5 rounded-xl bg-secondary text-on-secondary text-xs font-semibold flex items-center gap-1.5 hover:opacity-95 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="h-9 px-3 rounded-xl bg-surface-container text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high"
                    >
                      Use Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-fullname" className="text-sm font-semibold text-on-surface">
                Full Name <span className="text-error">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] absolute left-3.5 pointer-events-none">
                  person
                </span>
                <input
                  id="profile-fullname"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface-container-low text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>

            {/* Profession Selector */}
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-profession" className="text-sm font-semibold text-on-surface">
                Profession <span className="text-error">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px] absolute left-3.5 pointer-events-none">
                  work
                </span>
                <select
                  id="profile-profession"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value as Profession)}
                  className="w-full h-12 pl-11 pr-8 rounded-xl bg-surface-container-low text-on-surface text-base appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                >
                  {PROFESSION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                  expand_more
                </span>
              </div>
            </div>

            {/* State, District & Taluk */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="profile-state" className="text-sm font-semibold text-on-surface">
                  State <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px] absolute left-3.5 pointer-events-none">
                    map
                  </span>
                  <select
                    id="profile-state"
                    required
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full h-12 pl-11 pr-8 rounded-xl bg-surface-container-low text-on-surface text-base appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="profile-district" className="text-sm font-semibold text-on-surface">
                  District <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px] absolute left-3.5 pointer-events-none">
                    location_city
                  </span>
                  <select
                    id="profile-district"
                    required
                    disabled={!state}
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full h-12 pl-11 pr-8 rounded-xl bg-surface-container-low text-on-surface text-base appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">{state ? 'Select District' : 'Select State first'}</option>
                    {availableDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="profile-taluk" className="text-sm font-semibold text-on-surface">
                  Taluk <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px] absolute left-3.5 pointer-events-none">
                    pin_drop
                  </span>
                  <select
                    id="profile-taluk"
                    required
                    disabled={!district}
                    value={taluk}
                    onChange={(e) => setTaluk(e.target.value)}
                    className="w-full h-12 pl-11 pr-8 rounded-xl bg-surface-container-low text-on-surface text-base appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">{district ? 'Select Taluk' : 'Select District first'}</option>
                    {availableTaluks.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-on-surface-variant pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-error bg-error-container px-3 py-2 rounded-xl font-medium">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-w-[160px] h-12 rounded-xl bg-primary text-on-primary text-base font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                <span>{saving ? 'Saving Profile...' : 'Save Profile'}</span>
              </button>
              {profile.profileCompleted && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-12 px-4 rounded-xl bg-surface-container text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Farmer Profile Display Card */}
            <div className="bg-primary text-on-primary rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative shrink-0">
                  <ResilientImage
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-secondary-fixed shadow-sm"
                    fallbackText={profile.name.slice(0, 2).toUpperCase()}
                    fallbackClassName="bg-primary-container text-on-primary text-lg"
                  />
                  <button
                    type="button"
                    aria-label="Change profile picture"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                  </button>
                </div>

                <div className="min-w-0">
                  <span className="text-xs font-semibold text-secondary-fixed block mb-0.5">
                    {PROFESSION_LABELS[profile.profession]}
                  </span>
                  <h3 className="text-xl font-extrabold text-on-primary truncate">
                    {profile.name}
                  </h3>
                  {profile.email && (
                    <p className="text-xs text-primary-fixed/90 truncate">{profile.email}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="h-10 px-3.5 rounded-xl bg-on-primary/15 text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-on-primary/25 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>{saving ? 'Updating...' : 'Change Photo'}</span>
              </button>
            </div>

            {/* Structured Farmer Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-on-surface-variant block">
                    Farmer&apos;s Name
                  </span>
                  <span className="text-sm font-bold text-on-surface truncate block">
                    {profile.name}
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">work</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-on-surface-variant block">
                    Profession
                  </span>
                  <span className="text-sm font-bold text-on-surface truncate block">
                    {PROFESSION_LABELS[profile.profession]}
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-on-surface-variant block">
                    State, District &amp; Taluk
                  </span>
                  <span className="text-sm font-bold text-on-surface truncate block">
                    {locationSummary}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. Saved Crops List Section */}
      {savedCrops.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-on-surface">Saved Crops List</h3>
            <span className="text-xs font-semibold text-on-surface-variant tabular-nums">
              {savedCrops.length} Saved
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedCrops.map((item) => (
              <article
                key={item.id}
                className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 p-4 flex flex-col gap-3 min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-secondary shrink-0">
                      {item.label}
                    </span>
                    <span aria-hidden="true" className="text-outline-variant">
                      ·
                    </span>
                    <h4 className="text-base font-bold text-on-surface truncate">{item.cropName}</h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-bold text-primary tabular-nums">
                      {formatINR(item.ratePerKg * item.quantityKg)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.cropName}`}
                      onClick={() => onDeleteCrop(item.id)}
                      className="w-8 h-8 rounded-full hover:bg-error-container/60 text-on-surface-variant hover:text-error flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-surface-container-low rounded-xl p-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-on-surface-variant">Rate</span>
                    <span className="text-sm font-semibold text-on-surface tabular-nums truncate">
                      ₹{item.ratePerKg}/kg
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-on-surface-variant">Quantity</span>
                    <span className="text-sm font-semibold text-on-surface tabular-nums truncate">
                      {item.quantityKg} kg
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
