import { useMemo, useRef, useState } from 'react';
import type { CropOffer, FarmerCropLot, UserProfile } from '../types/kisan';
import { ResilientImage } from './ResilientImage';

interface AvailableCropsPageProps {
  crops: FarmerCropLot[];
  offers: CropOffer[];
  loading: boolean;
  profile: UserProfile;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onCreateOffer: (payload: {
    cropId: string;
    cropName: string;
    farmerName: string;
    buyerName: string;
    buyerPhone: string;
    offeredPricePerUnit: number;
    quantity: number;
    unitShort: string;
    message?: string;
  }) => Promise<void>;
}

const formatINR = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

export function AvailableCropsPage({
  crops,
  offers,
  loading,
  profile,
  onBack,
  onRefresh,
  onCreateOffer,
}: AvailableCropsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Crops');
  const [villageFilter, setVillageFilter] = useState('All Villages');
  const [showFilters, setShowFilters] = useState(false);
  const [sortMode, setSortMode] = useState<'newest' | 'price-asc' | 'price-desc' | 'total-desc'>(
    'newest'
  );
  const [refreshing, setRefreshing] = useState(false);
  const [offerCrop, setOfferCrop] = useState<FarmerCropLot | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    crops.forEach((c) => {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    });
    return [
      { label: 'All Crops', count: crops.length },
      ...Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
    ];
  }, [crops]);

  const villages = useMemo(() => {
    const set = new Set<string>();
    crops.forEach((c) => set.add(c.village));
    return ['All Villages', ...Array.from(set)];
  }, [crops]);

  const uniqueFarmerCount = useMemo(() => {
    return new Set(crops.map((c) => c.farmerName)).size;
  }, [crops]);

  const filteredCrops = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = crops.filter((crop) => {
      const matchesCat =
        activeCategory === 'All Crops' ||
        crop.category.toLowerCase() === activeCategory.toLowerCase();
      const matchesVillage = villageFilter === 'All Villages' || crop.village === villageFilter;
      const matchesSearch =
        !q ||
        `${crop.cropName} ${crop.varietyNotes} ${crop.farmerName} ${crop.village} ${crop.category} ${crop.phone}`
          .toLowerCase()
          .includes(q);
      return matchesCat && matchesVillage && matchesSearch;
    });

    if (sortMode === 'price-asc') {
      return [...list].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    }
    if (sortMode === 'price-desc') {
      return [...list].sort((a, b) => b.pricePerUnit - a.pricePerUnit);
    }
    if (sortMode === 'total-desc') {
      return [...list].sort(
        (a, b) => b.pricePerUnit * b.quantity - a.pricePerUnit * a.quantity
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [crops, searchQuery, activeCategory, villageFilter, sortMode]);

  const cycleSort = () => {
    setSortMode((prev) =>
      prev === 'newest'
        ? 'price-asc'
        : prev === 'price-asc'
        ? 'price-desc'
        : prev === 'price-desc'
        ? 'total-desc'
        : 'newest'
    );
  };

  const sortLabel =
    sortMode === 'newest'
      ? 'Newly Harvested'
      : sortMode === 'price-asc'
      ? 'Price: Low to High'
      : sortMode === 'price-desc'
      ? 'Price: High to Low'
      : 'Highest Lot Value';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const openOfferModal = (crop: FarmerCropLot) => {
    setOfferCrop(crop);
    setOfferPrice(String(crop.pricePerUnit));
    setOfferQty(String(crop.quantity));
    setOfferNote('');
  };

  const liveOfferTotal = useMemo(() => {
    const p = Number(offerPrice) || 0;
    const q = Number(offerQty) || 0;
    return Math.max(0, Math.round(p * q));
  }, [offerPrice, offerQty]);

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerCrop) return;
    setSubmittingOffer(true);
    try {
      await onCreateOffer({
        cropId: offerCrop.id,
        cropName: offerCrop.cropName,
        farmerName: offerCrop.farmerName,
        buyerName: profile.name,
        buyerPhone: profile.phone || '+91 98000 00000',
        offeredPricePerUnit: Math.max(1, Number(offerPrice) || offerCrop.pricePerUnit),
        quantity: Math.max(1, Number(offerQty) || offerCrop.quantity),
        unitShort: offerCrop.unitShort,
        message: offerNote.trim() || undefined,
      });
      setOfferCrop(null);
    } finally {
      setSubmittingOffer(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface antialiased flex flex-col min-h-screen w-full max-w-full overflow-x-clip">
      {/* Fixed Header with Back Navigation */}
      <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-5xl mx-auto h-16 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              aria-label="Go back to sign in"
              onClick={onBack}
              className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-[1.125rem] text-on-surface font-bold truncate tracking-tight">
                Available Farmer Crops
              </h1>
              <p className="text-[11px] font-semibold text-secondary truncate">
                {profile.name} • Supplier / Trader
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Search crops"
              onClick={() => {
                searchInputRef.current?.focus();
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            <button
              type="button"
              aria-label="Filter crops"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                showFilters || villageFilter !== 'All Villages'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </button>
            <button
              type="button"
              aria-label="Switch account or edit profile"
              onClick={onBack}
              className="w-9 h-9 ml-1 rounded-full bg-primary flex items-center justify-center shrink-0 text-on-primary"
              title="Back to Profile Setup"
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-safe bg-surface">
        <div className="max-w-5xl w-full mx-auto flex flex-col pb-10">
          {/* Live Stats & Trust Header Panel */}
          <div className="px-4 pt-4 pb-2">
            <div className="bg-surface-container-low rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
                  {crops.length} Fresh Crop Lots Available
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-highest text-primary text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px] text-secondary material-symbols-filled">
                    verified
                  </span>
                  Verified Direct Farmgate
                </span>
                {offers.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                    {offers.length} Offer{offers.length > 1 ? 's' : ''} Sent
                  </span>
                )}
              </div>

              <p className="text-sm text-on-surface-variant mb-3 leading-snug">
                Connecting verified local farmers directly with bulk buyers &amp; mandi traders with zero middlemen commission.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-secondary mb-1">
                    <span className="material-symbols-outlined text-[18px]">group</span>
                    <span className="text-xs font-semibold text-on-surface-variant">Active Farmers</span>
                  </div>
                  <span className="text-lg text-on-surface font-bold tabular-nums">
                    {uniqueFarmerCount} Verified
                  </span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-secondary mb-1">
                    <span className="material-symbols-outlined text-[18px]">handshake</span>
                    <span className="text-xs font-semibold text-on-surface-variant">Trade Assurance</span>
                  </div>
                  <span className="text-lg text-on-surface font-bold">100% Direct</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="sticky top-16 z-30 bg-surface/95 backdrop-blur-md px-4 py-2.5 space-y-2.5">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search crop, village, or farmer..."
                className="w-full h-12 pl-11 pr-10 bg-surface-container-lowest rounded-xl text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear crop search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>

            {showFilters && (
              <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-on-surface-variant">Village:</label>
                <select
                  value={villageFilter}
                  onChange={(e) => setVillageFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs font-semibold outline-none flex-1 min-w-[180px]"
                >
                  {villages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {(villageFilter !== 'All Villages' || activeCategory !== 'All Crops' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVillageFilter('All Villages');
                      setActiveCategory('All Crops');
                      setSearchQuery('');
                    }}
                    className="h-9 px-3 rounded-lg bg-error-container/50 text-error text-xs font-semibold"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {categories.map((cat) => {
                const isSelected = activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveCategory(cat.label)}
                    className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                        isSelected ? 'bg-white/20 text-on-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort Bar Indicator */}
            <div className="flex items-center justify-between text-on-surface-variant px-1 pt-0.5">
              <div className="flex items-center gap-1 text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-secondary">sort</span>
                <span className="text-xs font-semibold">
                  Showing {filteredCrops.length} •{' '}
                  <strong className="font-bold text-primary">{sortLabel}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={cycleSort}
                className="text-xs font-semibold text-secondary hover:text-primary flex items-center gap-0.5"
              >
                <span>Change Sort</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>

          {/* Crop Cards Stream */}
          <div className="px-4 mt-2">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm h-80 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredCrops.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCrops.map((crop) => {
                  const totalAmount = crop.pricePerUnit * crop.quantity;
                  const existingOffer = offers.find((o) => o.cropId === crop.id);

                  return (
                    <article
                      key={crop.id}
                      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-xs font-semibold">
                            {crop.qualityBadge}
                          </span>
                        </div>

                        {/* Farmer Profile Header */}
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shrink-0">
                            {crop.farmerInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h2 className="text-base text-on-surface font-bold truncate">
                                {crop.farmerName}
                              </h2>
                              <span className="inline-flex items-center text-secondary text-[16px] material-symbols-outlined material-symbols-filled">
                                check_circle
                              </span>
                              <span className="text-xs text-tertiary-container bg-tertiary-fixed px-1.5 py-0.5 rounded font-semibold">
                                ★ {crop.farmerRating.toFixed(1)} ({crop.farmerDeals} Deals)
                              </span>
                            </div>
                            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                              <span className="material-symbols-outlined text-[15px] text-outline shrink-0">
                                location_on
                              </span>
                              {crop.village}
                            </p>
                            <p className="text-xs text-on-surface font-semibold flex items-center gap-1 mt-0.5 tabular-nums">
                              <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">
                                call
                              </span>
                              {crop.phone}
                            </p>
                          </div>
                        </div>

                        {/* Crop Details & Image Preview Box */}
                        <div className="flex gap-3 items-center bg-surface-container-low rounded-xl p-2.5">
                          <ResilientImage
                            src={crop.imageUrl}
                            alt={crop.cropName}
                            className="w-20 h-20 rounded-lg object-cover shrink-0"
                            fallbackIcon="grass"
                            fallbackClassName="bg-primary-fixed text-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base text-primary font-bold leading-tight truncate">
                              {crop.cropName}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                                {crop.postedAgo}
                              </span>
                              <span className="text-[11px] text-outline">•</span>
                              <span className="text-[11px] text-on-surface-variant">
                                {crop.packagingNote}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Calculation Block: Auto-Calculated Price × Quantity */}
                        <div className="bg-surface-container-high rounded-xl p-3 flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2 pb-2 border-b border-outline-variant/30">
                            <div className="text-left">
                              <span className="text-xs font-semibold text-on-surface-variant block">
                                Rate / {crop.unitLabel}
                              </span>
                              <span className="text-base font-bold text-on-surface tabular-nums">
                                {formatINR(crop.pricePerUnit)}
                                {crop.unitLabel === 'kg' ? ' / kg' : ''}
                              </span>
                              <span className="text-[11px] text-outline block">
                                {crop.perKgDisplay}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold text-on-surface-variant block">
                                Lot Quantity
                              </span>
                              <span className="text-base font-bold text-on-surface tabular-nums">
                                {crop.quantity.toLocaleString('en-IN')} {crop.unitShort}
                              </span>
                              <span className="text-[11px] text-outline block">
                                {crop.equivalentWeightNote}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <div>
                              <span className="text-xs font-semibold text-on-surface-variant block">
                                Total Amount (Price × Quantity)
                              </span>
                              <span className="text-[11px] text-secondary font-medium font-mono tabular-nums">
                                {formatINR(crop.pricePerUnit)} ×{' '}
                                {crop.quantity.toLocaleString('en-IN')} {crop.unitShort}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-bold text-primary tabular-nums">
                                {formatINR(totalAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Footer */}
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={`tel:${crop.phone.replace(/\s+/g, '')}`}
                          className="flex-1 h-12 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-all active:scale-[0.98]"
                        >
                          <span className="material-symbols-outlined text-[19px]">call</span>
                          <span>Call Farmer</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => openOfferModal(crop)}
                          className="h-12 px-4 rounded-xl bg-surface-container-low text-primary text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container-highest transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">request_quote</span>
                          <span>{existingOffer ? 'Update Offer' : 'Make Offer'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-6 text-center flex flex-col items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                  inventory_2
                </span>
                <h3 className="text-base font-bold text-on-surface">No crop lots match your filter</h3>
                <p className="text-sm text-on-surface-variant max-w-xs">
                  Try clearing your search or switching back to All Crops.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All Crops');
                    setVillageFilter('All Villages');
                  }}
                  className="mt-1 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold"
                >
                  Show All Crops
                </button>
              </div>
            )}
          </div>

          {/* Trust & Direct Trade Guarantee Card */}
          <div className="px-4 mt-6">
            <div className="bg-primary text-on-primary rounded-2xl p-4 shadow-md relative overflow-hidden">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] material-symbols-filled">
                    shield
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-primary">
                    Direct Farmgate Purchase Assurance
                  </h4>
                  <span className="text-xs font-semibold text-secondary-fixed">
                    Zero Broker Commission Policy
                  </span>
                </div>
              </div>
              <p className="text-sm text-on-primary-container leading-relaxed mt-2">
                No broker fee. Direct farmer bank account or instant UPI transfer upon physical weighing &amp; quality check at farm location.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-secondary-fixed block">
                    Need logistics or weighbridge pass?
                  </span>
                  <span className="text-sm text-on-primary font-semibold">
                    Toll-free Trader Desk: 1800-425-1661
                  </span>
                </div>
                <a
                  href="tel:18004251661"
                  className="h-9 px-3.5 rounded-lg bg-secondary text-on-secondary text-xs flex items-center gap-1 font-semibold hover:bg-secondary-fixed-dim hover:text-on-secondary-fixed transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">support_agent</span>
                  <span>Assistance</span>
                </a>
              </div>
            </div>
          </div>

          {/* Refresh Action Widget */}
          <div className="px-4 mt-5 flex items-center justify-center">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold shadow-sm hover:bg-surface-container-highest transition-colors"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  refreshing ? 'animate-spin' : ''
                }`}
              >
                sync
              </span>
              <span>{refreshing ? 'Refreshing crop lots...' : 'Refresh live crop listings'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Make Offer Modal with Auto-Calculated Total */}
      {offerCrop && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSubmitOffer}
            className="w-full sm:max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-on-surface">Make Purchase Offer</h3>
                <p className="text-xs text-on-surface-variant">
                  {offerCrop.cropName} • Farmer: {offerCrop.farmerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOfferCrop(null)}
                className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">
                  Offer Price (₹/{offerCrop.unitShort})
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">
                  Quantity ({offerCrop.unitShort})
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={offerQty}
                  onChange={(e) => setOfferQty(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary tabular-nums"
                />
              </div>
            </div>

            <div className="bg-primary text-on-primary rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-primary-fixed block">
                  Calculated Offer Total
                </span>
                <span className="text-xs text-on-primary/80 font-mono tabular-nums">
                  {formatINR(Number(offerPrice) || 0)} × {Number(offerQty) || 0} {offerCrop.unitShort}
                </span>
              </div>
              <span className="text-xl font-bold tabular-nums">{formatINR(liveOfferTotal)}</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface block mb-1">
                Pickup / Payment Note (Optional)
              </label>
              <input
                type="text"
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                placeholder="e.g. Immediate UPI payment + own truck pickup"
                className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={submittingOffer}
              className="w-full h-12 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {submittingOffer ? 'Sending Offer...' : 'Send Direct Offer to Farmer'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
