import { useMemo, useState } from 'react';
import type { AgriExpert } from '../types/kisan';
import { ResilientImage } from './ResilientImage';

interface ExpertSathiPageProps {
  experts: AgriExpert[];
}

const SPECIALIZATIONS = ['all', 'Crop Disease', 'Soil Health', 'Horticulture', 'Pest Control'];

export function ExpertSathiPage({ experts }: ExpertSathiPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpec, setActiveSpec] = useState('all');

  const filteredExperts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return experts.filter((exp) => {
      const matchesSpec = activeSpec === 'all' || exp.specialization === activeSpec;
      const matchesQuery =
        !q ||
        `${exp.name} ${exp.specialization} ${exp.title} ${exp.location} ${exp.cropsCovered}`
          .toLowerCase()
          .includes(q);
      return matchesSpec && matchesQuery;
    });
  }, [experts, searchQuery, activeSpec]);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 gap-4 pb-8 pt-2 overflow-x-clip">
      {/* Warm Expert Sathi Intro Banner */}
      <section className="relative overflow-hidden bg-primary-container text-on-primary rounded-xl p-4 shadow-md">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
                {experts.filter((e) => e.isAvailableNow).length} Experts Online
              </span>
            </div>
            <h2 className="text-xl font-bold text-on-primary">Krishi Vigyan Kendra</h2>
            <p className="text-sm text-on-primary-container">
              Free 1-on-1 guidance for your crops, soil &amp; harvest.
            </p>
          </div>
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[32px] text-secondary-fixed material-symbols-filled">
              support_agent
            </span>
          </div>
        </div>
      </section>

      {/* Search & Specialization Filters */}
      <section className="flex flex-col gap-2.5">
        <div className="relative flex items-center w-full bg-surface-container-lowest rounded-xl shadow-sm min-h-[48px] px-4 gap-2">
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant flex-shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search agricultural experts"
            placeholder="Search by name, district, or crop..."
            className="w-full bg-transparent text-on-surface placeholder:text-on-surface-variant text-sm focus:outline-none min-h-[48px]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="w-8 h-8 rounded-full bg-surface-container-low text-on-surface-variant flex items-center justify-center flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
          {SPECIALIZATIONS.map((spec) => {
            const active = activeSpec === spec;
            return (
              <button
                key={spec}
                type="button"
                onClick={() => setActiveSpec(spec)}
                className={`min-h-[40px] px-4 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm transition-colors ${
                  active
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {spec === 'all' ? 'All Experts' : spec}
              </button>
            );
          })}
        </div>
      </section>

      {/* Experts Grid */}
      {filteredExperts.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExperts.map((expert) => (
            <article
              key={expert.id}
              className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <ResilientImage
                    src={expert.imageUrl}
                    alt={expert.name}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm"
                    fallbackText={expert.name
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                    fallbackClassName="bg-primary-container text-on-primary text-base"
                  />
                  <div className="flex flex-col flex-1 min-w-0 gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-on-surface truncate">{expert.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                          expert.isAvailableNow
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-tertiary-fixed text-on-tertiary-fixed'
                        }`}
                      >
                        {expert.isAvailableNow && (
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                        )}
                        {expert.availabilityLabel}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-secondary">{expert.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {expert.experienceYears} yrs exp • {expert.cropsCovered}
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      location_on
                    </span>
                    <span className="text-xs truncate">{expert.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface">
                    <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                    <span className="text-xs font-bold tabular-nums">{expert.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${expert.phone.replace(/\s+/g, '')}`}
                  className="flex-1 min-h-[44px] rounded-xl bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <span className="material-symbols-outlined text-[19px]">call</span>
                  <span>Call Now</span>
                </a>
                <a
                  href={`https://wa.me/${expert.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-h-[44px] rounded-xl bg-secondary text-on-secondary text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <span className="material-symbols-outlined text-[19px]">chat</span>
                  <span>WhatsApp</span>
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px]">eco</span>
          </div>
          <h3 className="text-base font-bold text-on-surface">No experts match your search</h3>
          <p className="text-sm text-on-surface-variant">
            Try clearing your search or selecting another specialization.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveSpec('all');
            }}
            className="mt-1 min-h-[44px] px-5 rounded-xl bg-primary-container text-on-primary text-sm font-semibold shadow-sm"
          >
            Show All Experts
          </button>
        </section>
      )}
    </div>
  );
}
