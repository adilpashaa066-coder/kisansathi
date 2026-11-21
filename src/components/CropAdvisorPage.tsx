import { useRef, useState } from 'react';
import { kisanApi } from '../services/api';
import type {
  CropPhotoAnalysis,
  CropSuitability,
  GovtSchemeContact,
  HowToGrowGuide,
  MandiRate,
  UserProfile,
} from '../types/kisan';
import { ResilientImage } from './ResilientImage';

interface CropAdvisorPageProps {
  mandiRates: MandiRate[];
  profile: UserProfile;
}

const CROP_CHIPS = [
  'Black Pepper',
  'Coffee',
  'Cardamom',
  'Tomato',
  'Potato',
  'Onion',
  'Arecanut',
  'Ginger',
  'Wheat',
];

interface ActiveGuideModal {
  crop: string;
  title: string;
  season: string;
  howToGrow: HowToGrowGuide;
  govtSupport: GovtSchemeContact[];
}

interface PreparedPhoto {
  previewDataUrl: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

function prepareCropImageFile(file: File): Promise<PreparedPhoto> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (JPG, PNG, or WebP).'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Unable to process this image on your browser.'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
        URL.revokeObjectURL(objectUrl);

        if (!base64) {
          reject(new Error('Failed to encode the selected photo. Please try another image.'));
          return;
        }

        resolve({
          previewDataUrl: dataUrl,
          base64,
          mimeType: 'image/jpeg',
          fileName: file.name || 'crop-photo.jpg',
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not process this image file. Please try another photo.'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to load the selected photo. Please use JPG, PNG, or WebP.'));
    };

    img.src = objectUrl;
  });
}

export function CropAdvisorPage({ mandiRates, profile }: CropAdvisorPageProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoNotes, setPhotoNotes] = useState('');
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoResult, setPhotoResult] = useState<CropPhotoAnalysis | null>(null);

  const [cropQuery, setCropQuery] = useState('');
  const [suitability, setSuitability] = useState<CropSuitability | null>(null);
  const [checking, setChecking] = useState(false);
  const [suitabilityError, setSuitabilityError] = useState('');
  const [guideModal, setGuideModal] = useState<ActiveGuideModal | null>(null);

  const userState = profile.state.trim() || 'Karnataka';
  const userDistrict = profile.district.trim() || 'Kodagu';
  const userTaluk = profile.taluk.trim() || 'Madikeri';
  const hasRegisteredLocation = Boolean(
    profile.state.trim() && profile.district.trim() && profile.taluk.trim()
  );

  const handlePhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    setPhotoResult(null);
    setPreparingPhoto(true);
    try {
      const prepared = await prepareCropImageFile(file);
      setPhoto(prepared);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to read photo.');
    } finally {
      setPreparingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoResult(null);
    setPhotoError('');
    setPhotoNotes('');
  };

  const handleAnalyzePhoto = async () => {
    if (!photo) return;
    setPhotoError('');
    setAnalyzingPhoto(true);
    try {
      const result = await kisanApi.analyzeCropPhoto({
        imageBase64: photo.base64,
        mimeType: photo.mimeType,
        notes: photoNotes.trim() || undefined,
      });
      setPhotoResult(result);
    } catch (err) {
      setPhotoResult(null);
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'Crop photo analysis could not be completed. Please try again.'
      );
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const runCheck = async (targetCrop?: string) => {
    const query = (targetCrop ?? cropQuery).trim();
    if (!query) return;
    setSuitabilityError('');
    setChecking(true);
    try {
      const res = await kisanApi.checkSuitability({
        state: userState,
        district: userDistrict,
        taluk: userTaluk,
        crop: query,
      });
      setSuitability(res);
    } catch (err) {
      setSuitabilityError(
        err instanceof Error ? err.message : 'Unable to check crop suitability right now.'
      );
    } finally {
      setChecking(false);
    }
  };

  const tickerRates = mandiRates.slice(0, 3);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 pb-8 gap-5 pt-2 overflow-x-clip">
      {/* 1. Live Mandi Rates */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-secondary text-[20px] material-symbols-filled">
              trending_up
            </span>
            <h2 className="text-base font-bold text-on-surface truncate">Live Mandi Rates</h2>
          </div>
          <span className="text-xs font-semibold text-on-secondary-container bg-secondary-container px-2.5 py-1 rounded-full shrink-0">
            Updated Today
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {tickerRates.map((item) => (
            <div
              key={item.id}
              className="bg-surface-container-lowest rounded-xl p-2.5 sm:p-3 shadow-sm flex flex-col justify-between gap-1 min-w-0"
            >
              <div className="flex items-center justify-between gap-1 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-on-surface truncate">
                  {item.crop}
                </span>
                <span
                  className={`material-symbols-outlined text-[16px] shrink-0 ${
                    item.trend === 'down' ? 'text-error' : 'text-secondary'
                  }`}
                >
                  {item.trend === 'down' ? 'arrow_downward' : 'arrow_upward'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-base sm:text-xl font-bold text-primary tabular-nums truncate">
                  ₹{item.pricePerKg}
                </span>
                <span className="text-[11px] sm:text-xs text-on-surface-variant shrink-0">/kg</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Upload Crop Photo for Inspection */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm border border-secondary-container/50 flex flex-col gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">photo_camera</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-primary">Upload Crop Photo</h2>
            <p className="text-xs text-on-surface-variant">
              Upload from gallery or capture a photo of leaves, stems, or produce for crop health guidance
            </p>
          </div>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChosen}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChosen}
          className="hidden"
        />

        {!photo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={preparingPhoto}
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
              <span>{preparingPhoto ? 'Loading Photo...' : 'Choose from Gallery'}</span>
            </button>
            <button
              type="button"
              disabled={preparingPhoto}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>Take Crop Photo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative w-full rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/40">
              <img
                src={photo.previewDataUrl}
                alt="Selected crop preview"
                className="w-full max-h-72 object-contain mx-auto bg-black/5"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-on-surface-variant truncate max-w-[220px]">
                {photo.fileName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={analyzingPhoto}
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-9 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1 hover:bg-surface-container-high disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  disabled={analyzingPhoto}
                  onClick={handleRemovePhoto}
                  className="h-9 px-3 rounded-lg bg-error-container text-on-error-container text-xs font-semibold flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Remove</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="crop-photo-notes" className="text-xs font-semibold text-on-surface block mb-1">
                Describe Symptoms or Question (Optional)
              </label>
              <input
                id="crop-photo-notes"
                type="text"
                value={photoNotes}
                onChange={(e) => setPhotoNotes(e.target.value)}
                placeholder="e.g. Yellow spots on lower leaves since 3 days"
                className="w-full h-11 bg-surface-container-low text-on-surface text-sm rounded-xl px-3.5 focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-outline"
              />
            </div>

            <button
              type="button"
              disabled={analyzingPhoto}
              onClick={() => void handleAnalyzePhoto()}
              className="w-full min-h-[48px] bg-primary text-on-primary text-sm sm:text-base font-semibold rounded-xl px-4 flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">
                {analyzingPhoto ? 'hourglass_top' : 'biotech'}
              </span>
              <span>{analyzingPhoto ? 'Analyzing Crop Photo...' : 'Analyze Crop Photo'}</span>
            </button>
          </div>
        )}

        {photoError && (
          <div
            role="alert"
            className="rounded-xl bg-error-container text-on-error-container px-3.5 py-2.5 text-xs sm:text-sm font-medium flex items-start gap-2"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <span>{photoError}</span>
          </div>
        )}

        {photoResult && (
          <div className="rounded-xl bg-surface-container-low border border-secondary-container/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary block">
                  Crop Photo Analysis
                </span>
                <h3 className="text-base font-bold text-primary break-words">
                  {photoResult.cropIdentified}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold shrink-0">
                {photoResult.healthStatus}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {photoResult.summary}
            </p>

            {photoResult.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-primary block">
                  Recommended Next Steps
                </span>
                <ul className="space-y-1.5">
                  {photoResult.recommendations.map((step, idx) => (
                    <li key={idx} className="text-xs text-on-surface flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {photoResult.cautionNote && (
              <p className="text-[11px] text-on-surface-variant bg-surface-container-lowest rounded-lg p-2.5 border border-outline-variant/30">
                {photoResult.cautionNote}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3. All High-Demand Crops */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-primary text-[20px] material-symbols-filled">
              local_fire_department
            </span>
            <h2 className="text-base font-bold text-on-surface truncate">
              All High-Demand Crops ({mandiRates.length})
            </h2>
          </div>
          <span className="text-[11px] text-secondary font-semibold">
            Tap any crop to check fit
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {mandiRates.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCropQuery(item.crop);
                void runCheck(item.crop);
              }}
              className="text-left bg-surface-container-lowest rounded-xl p-2.5 shadow-sm border border-outline-variant/30 flex flex-col justify-between gap-2 hover:border-secondary transition-colors min-w-0"
            >
              <div className="relative w-full h-20 rounded-lg overflow-hidden bg-surface-container-low flex items-center justify-center">
                {item.imageUrl ? (
                  <ResilientImage
                    src={item.imageUrl}
                    alt={item.crop}
                    className="w-full h-full object-cover"
                    fallbackIcon={item.icon || 'eco'}
                  />
                ) : (
                  <span className="material-symbols-outlined text-secondary text-[34px]">
                    {item.icon || 'eco'}
                  </span>
                )}
                {item.badge && (
                  <span className="absolute top-1 right-1 bg-secondary-container text-on-secondary-container text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm max-w-[90%] truncate">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-on-surface font-bold truncate">{item.crop}</span>
                <span className="text-[11px] text-secondary font-semibold truncate">
                  {item.marginNote}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Enter or Select Any Crop to Verify Regional Suitability */}
      <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-on-primary-fixed text-[22px] material-symbols-filled">
              psychology_alt
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-base font-bold text-on-surface">
              Enter or Select a Crop (फसल उपयुक्तता जाँच)
            </h2>
            <p className="text-xs text-on-surface-variant">
              {hasRegisteredLocation
                ? `Check if any specific crop is suitable for ${userTaluk}, ${userDistrict}`
                : 'Check crop cultivation suitability, soil, water & government support'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              id="crop-input"
              type="text"
              value={cropQuery}
              onChange={(e) => setCropQuery(e.target.value)}
              placeholder="Enter or select a crop (e.g. Onion, Coffee, Wheat)"
              className="w-full h-12 bg-surface-container-low text-on-surface text-base rounded-xl pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-outline"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {CROP_CHIPS.map((crop) => {
              const selected = cropQuery.toLowerCase() === crop.toLowerCase();
              return (
                <button
                  key={crop}
                  type="button"
                  onClick={() => {
                    setCropQuery(crop);
                    void runCheck(crop);
                  }}
                  className={`h-8 px-3 rounded-full text-xs font-semibold transition-transform active:scale-95 flex items-center gap-1 ${
                    selected
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  {selected && <span className="material-symbols-outlined text-[15px]">check</span>}
                  <span>{crop}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={checking || !cropQuery.trim()}
          onClick={() => void runCheck()}
          className="w-full min-h-[48px] bg-primary text-on-primary text-sm sm:text-base font-semibold rounded-xl px-4 flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px] material-symbols-filled">
            check_circle
          </span>
          <span>
            {checking ? 'Checking Local Suitability...' : 'Check If I Can Grow'}
          </span>
        </button>

        {suitabilityError && (
          <p role="alert" className="text-xs text-error bg-error-container px-3 py-2 rounded-xl font-medium">
            {suitabilityError}
          </p>
        )}
      </section>

      {/* Suitability Check Result */}
      {suitability && (
        <section
          className={`rounded-2xl p-4 shadow-sm space-y-3 border ${
            suitability.suitable
              ? 'bg-surface-container-lowest border-secondary-container/70'
              : 'bg-error-container/30 border-error/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            {suitability.suitable ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
                <span className="material-symbols-outlined text-[16px] material-symbols-filled">
                  verified
                </span>
                Suitable to Grow in {userTaluk}, {userDistrict}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container text-xs font-bold">
                <span className="material-symbols-outlined text-[16px] material-symbols-filled">
                  warning
                </span>
                Not Recommended for {userTaluk}, {userDistrict}
              </span>
            )}
            <span className="text-xs text-on-surface-variant font-semibold">{userState}</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-on-surface">{suitability.title}</h3>
            {!suitability.suitable && suitability.notRecommendedReason ? (
              <p className="text-sm text-on-error-container font-medium mt-1 leading-relaxed">
                {suitability.notRecommendedReason}
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant mt-0.5">{suitability.subtitle}</p>
            )}
          </div>

          {!suitability.suitable &&
            suitability.recommendedAlternativeCrops &&
            suitability.recommendedAlternativeCrops.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-3 space-y-2">
                <span className="text-xs font-bold text-primary block">
                  Suitable Crops for {userDistrict} Instead:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suitability.recommendedAlternativeCrops.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      onClick={() => {
                        setCropQuery(alt);
                        void runCheck(alt);
                      }}
                      className="h-8 px-3 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold hover:opacity-90"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="bg-surface-container-low rounded-xl p-3">
              <span className="text-xs font-bold text-primary block">Soil Requirement</span>
              <p className="text-xs text-on-surface-variant mt-0.5">{suitability.soil}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3">
              <span className="text-xs font-bold text-primary block">Water &amp; Irrigation</span>
              <p className="text-xs text-on-surface-variant mt-0.5">{suitability.water}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3">
              <span className="text-xs font-bold text-primary block">Best Sowing Season</span>
              <p className="text-xs text-on-surface-variant mt-0.5">{suitability.season}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-3">
              <span className="text-xs font-bold text-primary block">Cultivation Tip</span>
              <p className="text-xs text-on-surface-variant mt-0.5">{suitability.growingTips}</p>
            </div>
          </div>

          <div className="bg-primary-fixed/40 rounded-xl p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">
              location_on
            </span>
            <p className="text-xs font-medium text-on-primary-fixed">
              {suitability.regionsNote}
            </p>
          </div>

          {suitability.howToGrow && suitability.govtSupport && (
            <button
              type="button"
              onClick={() =>
                setGuideModal({
                  crop: suitability.crop,
                  title: suitability.title,
                  season: suitability.season,
                  howToGrow: suitability.howToGrow!,
                  govtSupport: suitability.govtSupport!,
                })
              }
              className="w-full h-11 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[19px]">menu_book</span>
              <span>How to Grow &amp; Govt. Support</span>
            </button>
          )}
        </section>
      )}

      {/* How to Grow & Government Support Modal */}
      {guideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col gap-4 shadow-xl">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-outline-variant/30">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[15px]">menu_book</span>
                  How to Grow &amp; Farmer Support
                </span>
                <h3 className="text-base font-bold text-primary mt-0.5 truncate">
                  {guideModal.title}
                </h3>
                <p className="text-xs text-on-surface-variant">{guideModal.season}</p>
              </div>
              <button
                type="button"
                aria-label="Close How to Grow guide"
                onClick={() => setGuideModal(null)}
                className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Step-by-Step Cultivation Guidance
                </h4>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
                  <span className="text-xs font-bold text-primary block">
                    1. Land &amp; Soil Preparation
                  </span>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {guideModal.howToGrow.landPrep}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
                  <span className="text-xs font-bold text-primary block">
                    2. Seed Selection &amp; Spacing
                  </span>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {guideModal.howToGrow.seedSpacing}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
                  <span className="text-xs font-bold text-primary block">
                    3. Watering &amp; Fertilizer Schedule
                  </span>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {guideModal.howToGrow.irrigationFertilizer}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
                  <span className="text-xs font-bold text-primary block">
                    4. Crop Protection &amp; Harvesting
                  </span>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {guideModal.howToGrow.pestHarvest}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  Government Support, Schemes &amp; Helplines
                </h4>
                {guideModal.govtSupport.map((scheme) => (
                  <div
                    key={scheme.schemeName}
                    className="rounded-xl border border-secondary-container/60 bg-secondary-container/15 p-3 flex flex-col gap-2"
                  >
                    <div>
                      <h5 className="text-sm font-bold text-primary">{scheme.schemeName}</h5>
                      <p className="text-[11px] font-semibold text-on-surface-variant">
                        {scheme.authority}
                      </p>
                      <p className="text-xs text-on-surface mt-1 leading-snug">{scheme.benefit}</p>
                    </div>
                    <a
                      href={`tel:${scheme.phone.replace(/[^0-9+]/g, '')}`}
                      className="self-start h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">call</span>
                      <span>Official Helpline: {scheme.phone}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
