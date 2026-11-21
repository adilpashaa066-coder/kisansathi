import { useMemo, useRef, useState } from 'react';
import type { AgriculturalJob, JobApplication, UserProfile } from '../types/kisan';

interface AvailableJobsPageProps {
  jobs: AgriculturalJob[];
  applications: JobApplication[];
  loading: boolean;
  profile: UserProfile;
  onBack: () => void;
  onApplyJob: (job: AgriculturalJob) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function AvailableJobsPage({
  jobs,
  applications,
  loading,
  profile,
  onBack,
  onApplyJob,
  onRefresh,
}: AvailableJobsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVillage, setActiveVillage] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [sortMode, setSortMode] = useState<'wage-desc' | 'wage-asc' | 'urgent'>('wage-desc');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [showAppliedDrawer, setShowAppliedDrawer] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const appliedJobIds = useMemo(
    () => new Set(applications.map((a) => a.jobId)),
    [applications]
  );

  const villageFilters = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    jobs.forEach((job) => {
      const existing = counts.get(job.villageKey);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(job.villageKey, {
          key: job.villageKey,
          label: job.village,
          count: 1,
        });
      }
    });
    return Array.from(counts.values());
  }, [jobs]);

  const workTypes = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => set.add(j.workType));
    return ['all', ...Array.from(set)];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = jobs.filter((job) => {
      const matchesVillage = activeVillage === 'all' || job.villageKey === activeVillage;
      const matchesUrgent = !urgentOnly || job.urgent;
      const matchesType = workTypeFilter === 'all' || job.workType === workTypeFilter;
      const matchesSearch =
        !q ||
        `${job.workName} ${job.cropName} ${job.workType} ${job.village} ${job.fieldLocation} ${job.farmerName} ${job.phone}`
          .toLowerCase()
          .includes(q);
      return matchesVillage && matchesUrgent && matchesType && matchesSearch;
    });

    if (sortMode === 'wage-asc') {
      return [...list].sort((a, b) => a.wagePerDay - b.wagePerDay);
    }
    if (sortMode === 'urgent') {
      return [...list].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.wagePerDay - a.wagePerDay);
    }
    return [...list].sort((a, b) => b.wagePerDay - a.wagePerDay);
  }, [jobs, searchQuery, activeVillage, urgentOnly, workTypeFilter, sortMode]);

  const avgWage = useMemo(() => {
    if (jobs.length === 0) return 0;
    const sum = jobs.reduce((acc, j) => acc + j.wagePerDay, 0);
    return Math.round(sum / jobs.length);
  }, [jobs]);

  const urgentCount = useMemo(() => jobs.filter((j) => j.urgent).length, [jobs]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const cycleSort = () => {
    setSortMode((prev) =>
      prev === 'wage-desc' ? 'wage-asc' : prev === 'wage-asc' ? 'urgent' : 'wage-desc'
    );
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setActiveVillage('all');
    setUrgentOnly(false);
    setWorkTypeFilter('all');
  };

  const handleApply = async (job: AgriculturalJob) => {
    if (appliedJobIds.has(job.id)) return;
    setApplyingId(job.id);
    try {
      await onApplyJob(job);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="bg-surface text-on-surface antialiased flex flex-col min-h-screen w-full max-w-full overflow-x-clip">
      {/* Top App Bar with Back Navigation */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
        <div className="max-w-5xl mx-auto h-16 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Go back to sign in"
              onClick={onBack}
              className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-[1.125rem] font-bold text-on-surface tracking-tight truncate">
                Available Agricultural Jobs
              </h1>
              <p className="text-[11px] font-semibold text-secondary truncate">
                Signed in as {profile.name} • Farm Worker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="My Applications"
              onClick={() => setShowAppliedDrawer(true)}
              className="relative h-10 px-3 rounded-full bg-surface-container-low text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
              <span className="hidden sm:inline">Applied</span>
              <span className="px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[10px]">
                {applications.length}
              </span>
            </button>
            <button
              type="button"
              aria-label="Filter jobs"
              onClick={() => setShowFilterBar((prev) => !prev)}
              className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                showFilterBar || urgentOnly || workTypeFilter !== 'all'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </button>
            <button
              type="button"
              aria-label="Search jobs"
              onClick={() => {
                searchInputRef.current?.focus();
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-1 w-full pt-16 pb-safe bg-surface">
        <div className="max-w-5xl w-full mx-auto px-4 pt-3 pb-10 space-y-4">
          {/* Live Regional Stats Strip */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary" />
                </span>
                <h2 className="text-[1.125rem] font-semibold text-primary tracking-tight">
                  {jobs.length} Active Jobs Nearby
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 bg-surface-container-low text-on-surface-variant text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
                {profile.district}, {profile.state}
              </span>
            </div>

            <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">verified</span>
              Verified Landowners • Direct Phone Contact • Daily Cash / UPI
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-surface-container-low p-2.5 rounded-xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-on-surface-variant leading-none uppercase tracking-wider font-semibold">
                    Avg. Daily Wage
                  </p>
                  <p className="text-lg text-primary font-bold mt-0.5 tabular-nums">
                    ₹{avgWage}
                    <span className="font-normal text-xs text-on-surface-variant"> /day</span>
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-low p-2.5 rounded-xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[18px]">electric_bolt</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-on-surface-variant leading-none uppercase tracking-wider font-semibold">
                    Instant Work
                  </p>
                  <p className="text-lg text-secondary font-bold mt-0.5 tabular-nums">
                    {urgentCount} Urgent
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Quick Filters */}
          <div className="flex flex-col gap-2.5">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined text-[22px]">search</span>
              </div>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search work, crop, village, or farmer..."
                className="w-full h-12 pl-11 pr-11 bg-surface-container-lowest text-on-surface rounded-xl text-sm placeholder:text-on-surface-variant/70 shadow-sm outline-none focus:ring-2 focus:ring-secondary"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>

            {showFilterBar && (
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUrgentOnly((prev) => !prev)}
                  className={`h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${
                    urgentOnly
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  Urgent Only
                </button>
                <select
                  aria-label="Filter by work type"
                  value={workTypeFilter}
                  onChange={(e) => setWorkTypeFilter(e.target.value)}
                  className="h-9 px-3 rounded-full bg-surface-container-low text-on-surface text-xs font-semibold outline-none"
                >
                  {workTypes.map((wt) => (
                    <option key={wt} value={wt}>
                      {wt === 'all' ? 'All Work Types' : wt}
                    </option>
                  ))}
                </select>
                {(urgentOnly || workTypeFilter !== 'all' || activeVillage !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="h-9 px-3 rounded-full text-xs font-semibold text-error bg-error-container/50"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Village Filter Scroll Rack */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveVillage('all')}
                className={`shrink-0 min-h-[38px] px-4 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-sm ${
                  activeVillage === 'all'
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                }`}
              >
                All Villages ({jobs.length})
              </button>
              {villageFilters.map((vf) => (
                <button
                  key={vf.key}
                  type="button"
                  onClick={() => setActiveVillage(vf.key)}
                  className={`shrink-0 min-h-[38px] px-4 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-sm ${
                    activeVillage === vf.key
                      ? 'bg-primary-container text-on-primary'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {vf.label} ({vf.count})
                </button>
              ))}
            </div>

            {/* Active Quick Filter Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-on-surface-variant text-xs font-semibold">
                <span className="material-symbols-outlined text-[16px] text-secondary">sort</span>
                <span>
                  Showing {filteredJobs.length} of {jobs.length} •{' '}
                  <strong className="text-on-surface">
                    {sortMode === 'wage-desc'
                      ? 'Highest Wage'
                      : sortMode === 'wage-asc'
                      ? 'Lowest Wage'
                      : 'Urgent First'}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={cycleSort}
                className="inline-flex items-center gap-1 text-secondary text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-secondary-container/40 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                <span>
                  Sort:{' '}
                  {sortMode === 'wage-desc'
                    ? 'Wage High'
                    : sortMode === 'wage-asc'
                    ? 'Wage Low'
                    : 'Urgent'}
                </span>
              </button>
            </div>
          </div>

          {/* Job Listing Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm h-64 animate-pulse"
                />
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJobs.map((job) => {
                const isExpanded = Boolean(expandedIds[job.id]);
                const isApplied = appliedJobIds.has(job.id);
                const isApplying = applyingId === job.id;

                return (
                  <article
                    key={job.id}
                    className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                job.urgent
                                  ? 'bg-primary-fixed text-on-primary-fixed'
                                  : 'bg-surface-container-high text-on-surface'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {job.urgent ? 'local_fire_department' : 'work'}
                              </span>
                              {job.badgeText}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                              {job.workType}
                            </span>
                          </div>
                          <h2 className="text-[1.0625rem] font-bold text-on-surface leading-snug">
                            {job.workName}
                          </h2>
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          <span className="bg-primary-container text-on-primary text-base font-bold px-3 py-1 rounded-xl shadow-sm whitespace-nowrap tabular-nums">
                            ₹{job.wagePerDay}{' '}
                            <span className="text-xs font-normal text-on-primary-container">/day</span>
                          </span>
                          <span className="text-[11px] text-secondary mt-1 font-semibold uppercase tracking-wider">
                            {job.paymentNote}
                          </span>
                        </div>
                      </div>

                      {/* Complete Required Details */}
                      <div className="grid grid-cols-1 gap-1.5 pt-0.5 text-sm text-on-surface-variant">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            schedule
                          </span>
                          <span>
                            {job.workingHours} •{' '}
                            <strong className="text-on-surface font-semibold">{job.duration}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            location_city
                          </span>
                          <span>
                            Village: <strong className="text-on-surface font-semibold">{job.village}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            location_on
                          </span>
                          <span>Field Location: {job.fieldLocation}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            person_pin
                          </span>
                          <span>
                            Farmer: <strong className="text-on-surface font-semibold">{job.farmerName}</strong>{' '}
                            (Verified ★ {job.farmerRating.toFixed(1)})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                            call
                          </span>
                          <span>
                            Phone: <strong className="text-on-surface font-semibold tabular-nums">{job.phone}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="bg-surface-container-low p-2.5 rounded-xl flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">
                          {job.perksIcon || 'free_breakfast'}
                        </span>
                        <p className="text-xs font-semibold text-on-surface leading-tight">
                          Perks: {job.perks}
                        </p>
                      </div>

                      {isExpanded && (
                        <div className="pt-1 space-y-2">
                          <div className="p-3 bg-surface rounded-xl space-y-1.5">
                            <p className="text-xs text-primary font-bold">
                              Job Responsibilities &amp; Field Notes
                            </p>
                            <ul className="text-on-surface-variant text-xs space-y-1 list-disc list-inside">
                              {job.notes.map((note, idx) => (
                                <li key={idx}>{note}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleDetails(job.id)}
                          className="min-h-[44px] px-2.5 rounded-xl bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
                        >
                          <span>{isExpanded ? 'Hide' : 'Details'}</span>
                          <span
                            className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          >
                            expand_more
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isApplied || isApplying}
                          onClick={() => handleApply(job)}
                          className={`min-h-[44px] px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                            isApplied
                              ? 'bg-secondary-container text-on-secondary-container cursor-default'
                              : 'bg-secondary text-on-secondary hover:opacity-95 active:scale-95'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            {isApplied ? 'check_circle' : 'touch_app'}
                          </span>
                          <span>{isApplied ? 'Applied' : isApplying ? 'Applying...' : 'Apply'}</span>
                        </button>

                        <a
                          href={`tel:${job.phone.replace(/\s+/g, '')}`}
                          className="min-h-[44px] px-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[17px]">call</span>
                          <span>Call Now</span>
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-1">
                <span className="material-symbols-outlined text-[30px]">search_off</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">No jobs found matching filters</h3>
              <p className="text-sm text-on-surface-variant max-w-xs">
                Try selecting &quot;All Villages&quot; or search for other skills like &quot;Harvest&quot; or &quot;Picking&quot;.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold active:scale-95"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Refresh + Helpline & Guarantee */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>Refresh Live Job Listings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-primary-container to-primary text-on-primary rounded-2xl p-4 shadow-md flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[24px]">support_agent</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-primary-fixed uppercase tracking-wider font-semibold">
                  Toll-Free 24/7 Helpline
                </p>
                <h3 className="text-base font-bold text-on-primary leading-tight mt-0.5">
                  Need Help Finding Work?
                </h3>
                <p className="text-xs text-primary-fixed/90 mt-0.5">Call KISAN SATHI Worker Desk</p>
                <a
                  href="tel:18004251661"
                  className="inline-flex items-center gap-1.5 mt-2 bg-on-primary text-primary text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">phone_in_talk</span>
                  <span>1800-425-1661</span>
                </a>
              </div>
            </div>

            <div className="bg-surface-container rounded-2xl p-4 flex items-start gap-3 text-on-surface">
              <span className="material-symbols-outlined text-[20px] text-secondary shrink-0 mt-0.5">
                verified_user
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-on-surface">
                  100% Guaranteed Payment Safety
                </p>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  All landowners registered have pledged on-the-spot cash or instant UPI distribution upon field shift completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* My Applications Modal Drawer */}
      {showAppliedDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-4 max-h-[82vh] flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <div>
                <h3 className="text-base font-bold text-on-surface">My Job Applications</h3>
                <p className="text-xs text-on-surface-variant">{applications.length} Active Records</p>
              </div>
              <button
                type="button"
                aria-label="Close applications"
                onClick={() => setShowAppliedDrawer(false)}
                className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 pr-1">
              {applications.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-6 text-center">
                  You have not applied to any jobs yet.
                </p>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl bg-surface-container-low p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            app.status === 'accepted'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : app.status === 'filled'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-tertiary-fixed text-on-tertiary-fixed'
                          }`}
                        >
                          {app.status === 'accepted'
                            ? 'Accepted • Ready to Work'
                            : app.status === 'filled'
                            ? 'Positions Filled'
                            : 'Pending Approval'}
                        </span>
                        <h4 className="text-sm font-bold text-on-surface mt-1">{app.workName}</h4>
                        <p className="text-xs text-on-surface-variant">
                          {app.farmerName} • {app.village}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary tabular-nums">
                        ₹{app.wagePerDay}/day
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-on-surface-variant">{app.appliedAgo}</span>
                      <a
                        href={`tel:${app.phone.replace(/\s+/g, '')}`}
                        className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">call</span>
                        Call Farmer
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
