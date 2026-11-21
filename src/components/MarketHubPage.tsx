import { useMemo, useState } from 'react';
import type { FarmerCropLot, UserProfile } from '../types/kisan';

interface MarketHubPageProps {
  crops: FarmerCropLot[];
  profile: UserProfile;
  onCreateCrop: (payload: Partial<FarmerCropLot>) => Promise<void>;
  onOpenFullTraderView: () => void;
}

const formatINR = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

export function MarketHubPage({
  crops,
  profile,
  onCreateCrop,
  onOpenFullTraderView,
}: MarketHubPageProps) {
  const [cropName, setCropName] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('2600');
  const [unitLabel, setUnitLabel] = useState<'Quintal' | 'kg'>('Quintal');
  const [quantity, setQuantity] = useState('20');
  const [village, setVillage] = useState(
    [profile.taluk, profile.district].filter(Boolean).join(', ')
  );
  const [phone, setPhone] = useState(profile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const previewTotal = useMemo(() => {
    const p = Number(pricePerUnit) || 0;
    const q = Number(quantity) || 0;
    return Math.max(0, Math.round(p * q));
  }, [pricePerUnit, quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateCrop({
        farmerName: profile.name,
        cropName: cropName.trim(),
        pricePerUnit: Number(pricePerUnit) || 100,
        unitLabel,
        quantity: Number(quantity) || 1,
        village: village.trim() || [profile.taluk, profile.district].filter(Boolean).join(', '),
        phone: phone.trim() || profile.phone || '+91 98000 00000',
      });
      setCropName('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 pb-8 gap-5 pt-3 overflow-x-clip">
      {/* Header Banner */}
      <section className="bg-primary text-on-primary rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-secondary-fixed uppercase tracking-wider">
            Direct Farmgate Mandi
          </span>
          <h2 className="text-lg font-bold mt-0.5">Sell Harvest Directly to Traders</h2>
          <p className="text-xs text-on-primary-container mt-0.5">
            Listings published here appear immediately on the Supplier / Trader Crop Marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFullTraderView}
          className="h-11 px-4 rounded-xl bg-secondary-container text-on-secondary-fixed text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
          <span>View Trader Marketplace ({crops.length})</span>
        </button>
      </section>

      {/* Post Crop Lot Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-5 rounded-full bg-secondary shrink-0" />
          <h3 className="text-base font-bold text-on-surface">List New Harvest Lot for Sale</h3>
        </div>

        <div className="min-w-0">
          <label htmlFor="market-crop-name" className="text-xs font-semibold text-on-surface block mb-1">
            Crop Name *
          </label>
          <input
            id="market-crop-name"
            type="text"
            required
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
            placeholder="e.g. Paddy – Sona Masoori"
            className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <label htmlFor="market-unit" className="text-xs font-semibold text-on-surface block mb-1">
              Unit
            </label>
            <select
              id="market-unit"
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value === 'kg' ? 'kg' : 'Quintal')}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm outline-none"
            >
              <option value="Quintal">Per Quintal (100 kg)</option>
              <option value="kg">Per kg</option>
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="market-price" className="text-xs font-semibold text-on-surface block mb-1">
              Price (₹ / {unitLabel})
            </label>
            <input
              id="market-price"
              type="number"
              min={1}
              required
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary tabular-nums"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="market-qty" className="text-xs font-semibold text-on-surface block mb-1">
              Quantity ({unitLabel === 'Quintal' ? 'Qtl' : 'kg'})
            </label>
            <input
              id="market-qty"
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm font-semibold outline-none focus:ring-2 focus:ring-secondary tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="market-village" className="text-xs font-semibold text-on-surface block mb-1">
              Village / Location
            </label>
            <input
              id="market-village"
              type="text"
              required
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="Enter village & district"
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="market-phone" className="text-xs font-semibold text-on-surface block mb-1">
              Phone Number
            </label>
            <input
              id="market-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98XXXXXXXX"
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-sm outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
        </div>

        <div className="bg-surface-container-high rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-on-surface-variant block">
              Auto-Calculated Total (Price × Quantity)
            </span>
            <span className="text-xs text-secondary font-mono tabular-nums">
              {formatINR(Number(pricePerUnit) || 0)} × {Number(quantity) || 0}{' '}
              {unitLabel === 'Quintal' ? 'Qtl' : 'kg'}
            </span>
          </div>
          <span className="text-xl font-bold text-primary tabular-nums">
            {formatINR(previewTotal)}
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">publish</span>
          <span>{submitting ? 'Publishing Crop Lot...' : 'Publish Crop Lot to Marketplace'}</span>
        </button>
      </form>
    </div>
  );
}
