import { useState } from 'react';
import type { AgriculturalJob, JobApplication, UserProfile } from '../types/kisan';

interface WorkersHubPageProps {
  jobs: AgriculturalJob[];
  applications: JobApplication[];
  profile: UserProfile;
  onPostJob: (payload: Partial<AgriculturalJob>) => Promise<void>;
  onUpdateWorkerCount: (
    jobId: string,
    action: 'assign' | 'unassign',
    gender: 'male' | 'female'
  ) => Promise<void>;
  onDeleteApplication: (id: string) => Promise<void>;
}

const WORK_TYPES = ['Harvesting', 'Irrigation', 'Weeding', 'Planting', 'Fertilizer Spray'];

export function WorkersHubPage({
  jobs,
  applications,
  profile,
  onPostJob,
  onUpdateWorkerCount,
  onDeleteApplication,
}: WorkersHubPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'farmer' | 'apps'>('farmer');
  const [workType, setWorkType] = useState('Irrigation');
  const [cropName, setCropName] = useState('Wheat (Golden Sharbati)');
  const [village, setVillage] = useState(profile.taluk || profile.district || 'Pimpalgaon Baswant');
  const [fieldLocation, setFieldLocation] = useState('Plot #14, Canal Road');
  const [maleCount, setMaleCount] = useState(4);
  const [femaleCount, setFemaleCount] = useState(6);
  const [dailyWage, setDailyWage] = useState('450');
  const [workingHours, setWorkingHours] = useState('9:00 AM – 5:00 PM');
  const [duration, setDuration] = useState('5 Days Work');
  const [workDetails, setWorkDetails] = useState('2 times meals and 3 times tea or coffee');
  const [phone, setPhone] = useState(profile.phone || '+91 98220 12345');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeMale = Math.max(0, maleCount);
    const safeFemale = Math.max(0, femaleCount);
    if (safeMale + safeFemale <= 0) {
      setFormError('Please select at least 1 male or female worker needed.');
      return;
    }
    setFormError('');
    setPosting(true);
    try {
      await onPostJob({
        workName: workType,
        workType,
        cropName: cropName.trim() || 'Seasonal Crop',
        village: village.trim() || profile.district || 'Local Village',
        fieldLocation: fieldLocation.trim() || 'Main Farm Plot',
        workersNeededMale: safeMale,
        workersNeededFemale: safeFemale,
        wagePerDay: Math.max(100, Number(dailyWage) || 450),
        workingHours: workingHours.trim() || '9:00 AM – 5:00 PM',
        duration: duration.trim() || '5 Days Work',
        perks: workDetails.trim() || 'Meals and tea included',
        phone: phone.trim() || profile.phone || '+91 98220 12345',
        farmerName: profile.name,
        urgent: true,
      });
      setActiveSubTab('apps');
    } finally {
      setPosting(false);
    }
  };

  const handleWorkerAdjust = async (
    jobId: string,
    action: 'assign' | 'unassign',
    gender: 'male' | 'female'
  ) => {
    setBusyJobId(jobId);
    try {
      await onUpdateWorkerCount(jobId, action, gender);
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto overflow-x-clip">
      {/* Top Segmented Switcher: Post Work & Applied */}
      <div className="px-4 pt-3 pb-2 sticky top-16 z-20 bg-surface/90 backdrop-blur-md">
        <div className="flex p-1 bg-surface-container rounded-full shadow-sm">
          <button
            type="button"
            onClick={() => setActiveSubTab('farmer')}
            className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all min-w-0 ${
              activeSubTab === 'farmer'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">person_add</span>
            <span className="truncate">Post Work</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('apps')}
            className={`flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all min-w-0 ${
              activeSubTab === 'apps'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">
              assignment_turned_in
            </span>
            <span className="truncate">Applied ({applications.length})</span>
          </button>
        </div>
      </div>

      {/* SECTION A: Post Farm Work */}
      {activeSubTab === 'farmer' && (
        <div className="px-4 py-2 pb-8">
          <form
            onSubmit={handleSubmitJob}
            className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-5 rounded-full bg-secondary shrink-0" />
                <h2 className="text-lg font-bold text-on-surface truncate">
                  Post Work Requirement
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold shrink-0">
                Active Hiring
              </span>
            </div>

            {/* Type of Work Pills */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-sm font-semibold text-on-surface">
                Type of Agricultural Work
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {WORK_TYPES.map((type) => {
                  const selected = workType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setWorkType(type)}
                      className={`px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition-colors shrink-0 ${
                        selected
                          ? 'bg-primary-container text-on-primary font-semibold shadow-sm'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">
                  Crop Name
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                    psychiatry
                  </span>
                  <input
                    type="text"
                    required
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">Village</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                    location_city
                  </span>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">
                  Field Plot Location
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                    pin_drop
                  </span>
                  <input
                    type="text"
                    required
                    value={fieldLocation}
                    onChange={(e) => setFieldLocation(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
            </div>

            {/* Workers Required Counter */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-on-surface">Workers Needed</span>
                <span className="text-xs font-semibold text-secondary tabular-nums">
                  Total: {Math.max(0, maleCount + femaleCount)} Workers
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-secondary text-[22px]">
                      man
                    </span>
                    <span className="text-sm font-semibold text-on-surface">Male</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Decrease male workers"
                      disabled={maleCount <= 0}
                      onClick={() => setMaleCount((c) => Math.max(0, c - 1))}
                      className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="text-base font-bold text-on-surface w-6 text-center tabular-nums">
                      {Math.max(0, maleCount)}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase male workers"
                      onClick={() => setMaleCount((c) => Math.max(0, c + 1))}
                      className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-secondary text-[22px]">
                      woman
                    </span>
                    <span className="text-sm font-semibold text-on-surface">Female</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Decrease female workers"
                      disabled={femaleCount <= 0}
                      onClick={() => setFemaleCount((c) => Math.max(0, c - 1))}
                      className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="text-base font-bold text-on-surface w-6 text-center tabular-nums">
                      {Math.max(0, femaleCount)}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase female workers"
                      onClick={() => setFemaleCount((c) => Math.max(0, c + 1))}
                      className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Wage, Hours & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">Daily Wage (₹)</label>
                <div className="relative flex items-center">
                  <span className="text-sm font-bold text-on-surface absolute left-3">₹</span>
                  <input
                    type="number"
                    min={100}
                    required
                    value={dailyWage}
                    onChange={(e) => setDailyWage(e.target.value)}
                    className="w-full h-12 pl-7 pr-3 rounded-xl bg-surface-container-low text-on-surface text-base font-bold focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">Working Hours</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                    schedule
                  </span>
                  <input
                    type="text"
                    required
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1 min-w-0">
                <label className="text-sm font-semibold text-on-surface">Duration</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                    event
                  </span>
                  <input
                    type="text"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-semibold text-on-surface">
                Work Details &amp; Perks
              </label>
              <textarea
                rows={2}
                value={workDetails}
                onChange={(e) => setWorkDetails(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary resize-none"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-semibold text-on-surface">Primary Contact Phone</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3">
                  call
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-error bg-error-container px-3 py-2 rounded-xl font-medium">
                {formError}
              </p>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={posting}
                className="w-full h-12 rounded-xl bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">campaign</span>
                <span>{posting ? 'POSTING...' : 'POST WORK REQUIREMENT'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION B: Applied & Posted Worker Records */}
      {activeSubTab === 'apps' && (
        <div className="px-4 py-2 pb-8 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-5 rounded-full bg-secondary shrink-0" />
              <h2 className="text-lg font-bold text-on-surface truncate">
                Applied &amp; Posted Jobs
              </h2>
            </div>
            <span className="text-xs font-semibold text-on-surface-variant shrink-0">
              {applications.length} Active Records
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-sm space-y-3">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                assignment
              </span>
              <p className="text-sm text-on-surface-variant">
                No job posts or worker applications yet. Create a new work requirement to see it here.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('farmer')}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold"
              >
                Post Work Requirement
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {applications.map((app) => {
                const matchedJob = jobs.find((j) => j.id === app.jobId);
                const maleNeeded = Math.max(
                  0,
                  matchedJob?.workersNeededMale ?? app.workersNeededMale ?? 0
                );
                const femaleNeeded = Math.max(
                  0,
                  matchedJob?.workersNeededFemale ?? app.workersNeededFemale ?? 0
                );
                const maleAssigned = Math.max(
                  0,
                  matchedJob?.assignedMale ?? app.assignedMale ?? 0
                );
                const femaleAssigned = Math.max(
                  0,
                  matchedJob?.assignedFemale ?? app.assignedFemale ?? 0
                );
                const totalNeeded = Math.max(0, maleNeeded + femaleNeeded);
                const isBusy = busyJobId === app.jobId;

                return (
                  <div
                    key={app.id}
                    className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3 min-w-0 ${
                      app.status === 'filled' ? 'opacity-90' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              app.status === 'accepted'
                                ? 'bg-secondary-container text-on-secondary-container'
                                : app.status === 'filled'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-tertiary-fixed text-on-tertiary-fixed'
                            }`}
                          >
                            {app.recordType === 'posted'
                              ? totalNeeded === 0
                                ? 'Posted • Positions Filled'
                                : 'Posted Work • Active'
                              : app.status === 'accepted'
                              ? 'Accepted • Ready to Work'
                              : app.status === 'filled'
                              ? 'Positions Filled'
                              : 'Pending Approval'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-on-surface mt-2 break-words">
                          {app.workName}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-0.5 break-words">
                          {app.farmerName} • {app.village}
                        </p>
                        {(matchedJob?.fieldLocation || app.fieldLocation) && (
                          <p className="text-xs text-on-surface-variant mt-0.5 break-words">
                            Field: {matchedJob?.fieldLocation ?? app.fieldLocation}
                          </p>
                        )}
                        {(matchedJob?.workingHours || app.workingHours) && (
                          <p className="text-[11px] text-secondary font-medium mt-0.5">
                            {matchedJob?.workingHours ?? app.workingHours} •{' '}
                            {matchedJob?.duration ?? app.duration}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant shrink-0">
                        {app.appliedAgo}
                      </span>
                    </div>

                    {/* Worker Count Tracking Card */}
                    {matchedJob && (
                      <div className="p-3 rounded-xl bg-surface-container-low space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-secondary">
                              group
                            </span>
                            Worker Headcount
                          </span>
                          <span className="text-xs font-semibold text-primary tabular-nums">
                            {totalNeeded} Remaining • {maleAssigned + femaleAssigned} Assigned
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-surface-container-lowest rounded-lg p-2 space-y-1.5 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-on-surface">Male</span>
                              <span className="font-bold text-primary tabular-nums">
                                {maleNeeded} left
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant tabular-nums">
                              Assigned: {maleAssigned}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy || maleNeeded <= 0}
                                onClick={() => handleWorkerAdjust(app.jobId, 'assign', 'male')}
                                className="flex-1 h-7 rounded-md bg-primary text-on-primary text-[11px] font-semibold disabled:opacity-40"
                              >
                                Assign
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || maleAssigned <= 0}
                                onClick={() => handleWorkerAdjust(app.jobId, 'unassign', 'male')}
                                className="flex-1 h-7 rounded-md bg-surface-container text-on-surface text-[11px] font-semibold disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="bg-surface-container-lowest rounded-lg p-2 space-y-1.5 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-on-surface">Female</span>
                              <span className="font-bold text-primary tabular-nums">
                                {femaleNeeded} left
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant tabular-nums">
                              Assigned: {femaleAssigned}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy || femaleNeeded <= 0}
                                onClick={() => handleWorkerAdjust(app.jobId, 'assign', 'female')}
                                className="flex-1 h-7 rounded-md bg-primary text-on-primary text-[11px] font-semibold disabled:opacity-40"
                              >
                                Assign
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || femaleAssigned <= 0}
                                onClick={() => handleWorkerAdjust(app.jobId, 'unassign', 'female')}
                                className="flex-1 h-7 rounded-md bg-surface-container text-on-surface text-[11px] font-semibold disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] text-on-surface-variant">
                          Offered Daily Wage
                        </span>
                        <span className="text-base font-bold text-secondary tabular-nums">
                          ₹{app.wagePerDay} / day
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`Remove ${app.workName} from Applied`}
                          onClick={() => onDeleteApplication(app.id)}
                          className="h-9 px-2.5 rounded-lg bg-error-container/60 text-error text-xs font-semibold flex items-center gap-1 hover:bg-error-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Remove</span>
                        </button>
                        <a
                          href={`tel:${app.phone.replace(/\s+/g, '')}`}
                          className="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">call</span>
                          <span>Call</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
