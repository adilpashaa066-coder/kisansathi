export type Profession = 'farmer' | 'worker' | 'supplier' | 'expert';

export type MainTab = 'home' | 'workers' | 'expert-sathi' | 'market' | 'insights';

export interface CropPhotoAnalysis {
  cropIdentified: string;
  healthStatus: string;
  summary: string;
  recommendations: string[];
  cautionNote?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: UserProfile | null;
  googleAuthConfigured: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  profession: Profession;
  state: string;
  district: string;
  taluk: string;
  gramPanchayat?: string;
  advisorLocationSaved?: boolean;
  phone?: string;
  googleConnected?: boolean;
  avatarUrl?: string;
  profileCompleted?: boolean;
  updatedAt: string;
}

export interface AgriculturalJob {
  id: string;
  workName: string;
  workType: string;
  cropName: string;
  wagePerDay: number;
  paymentNote: string;
  workingHours: string;
  duration: string;
  village: string;
  villageKey: string;
  fieldLocation: string;
  farmerName: string;
  farmerRating: number;
  phone: string;
  workersNeededMale: number;
  workersNeededFemale: number;
  assignedMale?: number;
  assignedFemale?: number;
  urgent: boolean;
  badgeText: string;
  perks: string;
  perksIcon: string;
  notes: string[];
  createdAt: string;
}

export interface FarmerCropLot {
  id: string;
  farmerName: string;
  farmerInitials: string;
  farmerRating: number;
  farmerDeals: number;
  village: string;
  cropName: string;
  category: string;
  varietyNotes: string;
  qualityBadge: string;
  gradeLabel: string;
  pricePerUnit: number;
  unitLabel: 'Quintal' | 'kg';
  unitShort: 'Qtl' | 'kg';
  quantity: number;
  totalAmount: number;
  perKgDisplay: string;
  equivalentWeightNote: string;
  packagingNote: string;
  postedAgo: string;
  phone: string;
  imageUrl?: string;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  workName: string;
  farmerName: string;
  village: string;
  fieldLocation?: string;
  workingHours?: string;
  duration?: string;
  wagePerDay: number;
  phone: string;
  applicantName: string;
  recordType?: 'application' | 'posted';
  workersNeededMale?: number;
  workersNeededFemale?: number;
  assignedMale?: number;
  assignedFemale?: number;
  status: 'pending' | 'accepted' | 'filled';
  appliedAgo: string;
  note?: string;
  createdAt: string;
}

export interface CropOffer {
  id: string;
  cropId: string;
  cropName: string;
  farmerName: string;
  buyerName: string;
  buyerPhone: string;
  offeredPricePerUnit: number;
  quantity: number;
  unitShort: string;
  totalOfferAmount: number;
  message?: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface AgriExpert {
  id: string;
  name: string;
  specialization: string;
  title: string;
  experienceYears: number;
  cropsCovered: string;
  location: string;
  phone: string;
  availabilityLabel: string;
  isAvailableNow: boolean;
  imageUrl: string;
}

export interface MandiRate {
  id: string;
  crop: string;
  pricePerKg: number;
  trend: 'up' | 'down';
  badge?: string;
  marginNote?: string;
  imageUrl?: string;
  icon?: string;
}

export interface GovtSchemeContact {
  schemeName: string;
  authority: string;
  benefit: string;
  phone: string;
}

export interface HowToGrowGuide {
  landPrep: string;
  seedSpacing: string;
  irrigationFertilizer: string;
  pestHarvest: string;
}

export interface CropSuitability {
  crop: string;
  title: string;
  subtitle: string;
  suitable: boolean;
  notRecommendedReason?: string;
  recommendedAlternativeCrops?: string[];
  soil: string;
  water: string;
  season: string;
  growingTips: string;
  regionsNote: string;
  howToGrow?: HowToGrowGuide;
  govtSupport?: GovtSchemeContact[];
}

export interface RecommendedCrop {
  crop: string;
  title: string;
  season: string;
  reason: string;
  pricePerKg?: number;
  howToGrow: HowToGrowGuide;
  govtSupport: GovtSchemeContact[];
}

export interface CalculatorCrop {
  id: string;
  label: string;
  cropName: string;
  ratePerKg: number;
  quantityKg: number;
  totalAmount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timeAgo: string;
  read: boolean;
}
