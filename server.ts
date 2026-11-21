import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { isValidIndianLocation } from './src/data/indiaLocations.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kisan-sathi-db.json');

interface JobRecord {
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

interface CropRecord {
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

interface ApplicationRecord {
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

interface OfferRecord {
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

interface CalculatorCropRecord {
  id: string;
  label: string;
  cropName: string;
  ratePerKg: number;
  quantityKg: number;
  totalAmount: number;
}

interface ProfileRecord {
  id: string;
  name: string;
  email?: string;
  profession: 'farmer' | 'worker' | 'supplier' | 'expert';
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

interface AuthUserRecord {
  profile: ProfileRecord;
  passwordHash?: string;
  authProvider: 'password' | 'google';
  createdAt: string;
}

interface SessionRecord {
  email: string;
  createdAt: string;
  expiresAt: string;
}

interface DatabaseSchema {
  profile: ProfileRecord;
  accounts?: Record<string, ProfileRecord>;
  users?: Record<string, AuthUserRecord>;
  sessions?: Record<string, SessionRecord>;
  jobs: JobRecord[];
  crops: CropRecord[];
  applications: ApplicationRecord[];
  offers: OfferRecord[];
  calculatorCrops: CalculatorCropRecord[];
}

const SESSION_COOKIE_NAME = 'kisan_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_SIGNUP_PROFESSIONS: Array<'farmer' | 'worker' | 'supplier'> = ['farmer', 'worker', 'supplier'];
const VALID_PROFILE_PROFESSIONS: Array<'farmer' | 'worker' | 'supplier' | 'expert'> = [
  'farmer',
  'worker',
  'supplier',
  'expert',
];

function normalizeProfession(val: unknown): 'farmer' | 'worker' | 'supplier' | 'expert' {
  if (val === 'worker' || val === 'supplier' || val === 'farmer' || val === 'expert') return val;
  return 'farmer';
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const flags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const flags = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

function pruneExpiredSessions(db: DatabaseSchema): void {
  if (!db.sessions) return;
  const now = Date.now();
  for (const [token, sess] of Object.entries(db.sessions)) {
    if (!sess?.expiresAt || Date.parse(sess.expiresAt) <= now) {
      delete db.sessions[token];
    }
  }
}

function createSessionForEmail(db: DatabaseSchema, email: string): string {
  pruneExpiredSessions(db);
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  db.sessions = {
    ...(db.sessions ?? {}),
    [token]: {
      email,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    },
  };
  return token;
}

function getAuthenticatedUser(
  req: express.Request,
  db: DatabaseSchema
): { email: string; token: string; user: AuthUserRecord } | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = db.sessions?.[token];
  if (!session) return null;
  if (!session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
    return null;
  }
  const user = db.users?.[session.email];
  if (!user) return null;
  return {
    email: session.email,
    token,
    user: {
      ...user,
      profile: {
        ...user.profile,
        profession: normalizeProfession(user.profile.profession),
      },
    },
  };
}

const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAi4_kWb8R0AjDfw0WWaZqJqjSKWcBVBmvgB78CSnrpr4qX0O5ZwCZpX1TlMv8-Irh3PpNuuZbm9MN_0JHnBjdVezWaHefppjDv_glLbfpkvld3zadRWeUp2MEKIIAW98_C9M2lBN2OK2_5u-yxncTobi0fhztLZRNly4TEhbbUQNA7lVJqXvVNgh4qB8SMic4NfyVyUWrdStHoAxYPtrSnCB0Glw-V__hncrbrOWB4';

function createInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    profile: {
      id: 'user-1',
      name: 'Ramesh Patel',
      email: '',
      profession: 'farmer',
      state: 'Maharashtra',
      district: 'Nashik',
      taluk: 'Niphad',
      gramPanchayat: '',
      advisorLocationSaved: false,
      phone: '+91 98220 12345',
      googleConnected: false,
      avatarUrl: DEFAULT_AVATAR,
      profileCompleted: false,
      updatedAt: now,
    },
    accounts: {},
    jobs: [
      {
        id: 'job-1',
        workName: 'Coffee Bean Picking & Sorting',
        workType: 'Plantation Work',
        cropName: 'Arabica & Robusta Coffee',
        wagePerDay: 550,
        paymentNote: 'Daily Cash / UPI',
        workingHours: '8:00 AM – 4:30 PM (8 hrs)',
        duration: '5 Days Work',
        village: 'Suntikoppa',
        villageKey: 'suntikoppa',
        fieldLocation: 'East Estate Field #4, Near Water Tank',
        farmerName: 'Ramesh Gowda',
        farmerRating: 4.9,
        phone: '+91 98450 12345',
        workersNeededMale: 3,
        workersNeededFemale: 3,
        urgent: true,
        badgeText: 'Urgent • 6 Needed',
        perks: '2 Times Fresh Estate Tea & Morning Breakfast included daily',
        perksIcon: 'free_breakfast',
        notes: [
          'Selective picking of red-ripe Arabica & Robusta berries only.',
          'Basket scales available at every section checkpoint.',
          'Tools: Collecting baskets provided by farm owner.',
          'Payment cleared at 5:00 PM every evening via Cash or Google Pay.',
        ],
        createdAt: '2026-11-20T06:00:00.000Z',
      },
      {
        id: 'job-2',
        workName: 'Paddy Harvesting & Bundling',
        workType: 'Wet Field',
        cropName: 'Sona Masoori Paddy',
        wagePerDay: 600,
        paymentNote: 'Immediate Cash',
        workingHours: '7:30 AM – 3:30 PM (8 hrs)',
        duration: '3 Days Duration',
        village: 'Napoklu',
        villageKey: 'napoklu',
        fieldLocation: 'Riverbank Valley Plot B',
        farmerName: 'H. M. Bopanna',
        farmerRating: 4.8,
        phone: '+91 94812 78901',
        workersNeededMale: 2,
        workersNeededFemale: 2,
        urgent: true,
        badgeText: 'Immediate Start • 4 Workers',
        perks: 'Wholesome Country Lunch & Fresh Coconut Water at 11 AM',
        perksIcon: 'restaurant',
        notes: [
          'Cutting mature paddy stalks, tying into sheaves, moving to drying threshing floor.',
          'Please bring personal harvesting sickles. Sharpening stones available on plot.',
          'Dry weather guaranteed for next 3 days. Clean drinking water tanker on site.',
        ],
        createdAt: '2026-11-20T08:00:00.000Z',
      },
      {
        id: 'job-3',
        workName: 'Arecanut Peeling & De-husking',
        workType: 'Indoor Work',
        cropName: 'Arecanut',
        wagePerDay: 500,
        paymentNote: '+₹5/kg above 50kg',
        workingHours: '9:00 AM – 5:00 PM (8 hrs)',
        duration: '7 Days Duration',
        village: 'Madikeri Rural',
        villageKey: 'madikeri',
        fieldLocation: 'Murnad Road, Opp. Primary School',
        farmerName: 'Suresh Somanna',
        farmerRating: 5.0,
        phone: '+91 97401 45678',
        workersNeededMale: 2,
        workersNeededFemale: 4,
        urgent: false,
        badgeText: 'Indoor Work • Flexible Hours',
        perks: 'Shaded spacious drying yard, warm tea & steamed evening snacks',
        perksIcon: 'wb_shade',
        notes: [
          'Manual and mechanical peeler machines available. Beginner workers welcome.',
          'Clean, covered yard protects from rain or direct hot sun.',
          'Women and elder friendly setup with ergonomic seating stools provided.',
        ],
        createdAt: '2026-11-19T10:00:00.000Z',
      },
      {
        id: 'job-4',
        workName: 'Pepper Trellis & Organic Spray',
        workType: 'Top Wage',
        cropName: 'Black Pepper',
        wagePerDay: 650,
        paymentNote: 'Quick 6hr Shift',
        workingHours: '8:00 AM – 2:00 PM (6 hrs)',
        duration: '2 Days Shift',
        village: 'Kushalnagar',
        villageKey: 'kushalnagar',
        fieldLocation: 'Kaveri Plantation, Outskirts',
        farmerName: 'C. P. Muthappa',
        farmerRating: 4.9,
        phone: '+91 99002 67890',
        workersNeededMale: 2,
        workersNeededFemale: 0,
        urgent: true,
        badgeText: 'Experience Required • 2 Workers',
        perks: 'Certified safety masks, eye gear provided • Full midday meal',
        perksIcon: 'medical_services',
        notes: [
          'Applying organic neem oil bio-formulation using battery power knapsack sprayer.',
          'Light bamboo ladders available for pepper vine tying up silver oak trees.',
          'Transport pickup available from Kushalnagar bus stand at 7:30 AM.',
        ],
        createdAt: '2026-11-21T04:00:00.000Z',
      },
      {
        id: 'job-5',
        workName: 'Cardamom Shade Pruning & Mulching',
        workType: 'Plantation Work',
        cropName: 'Green Cardamom',
        wagePerDay: 560,
        paymentNote: 'Daily UPI / Cash',
        workingHours: '8:00 AM – 4:00 PM (8 hrs)',
        duration: '4 Days Work',
        village: 'Somwarpet',
        villageKey: 'somwarpet',
        fieldLocation: 'Belur Estate Block 2, Hill Slope',
        farmerName: 'K. A. Thimmaiah',
        farmerRating: 4.8,
        phone: '+91 94481 33490',
        workersNeededMale: 3,
        workersNeededFemale: 2,
        urgent: false,
        badgeText: '5 Workers Needed',
        perks: 'Morning coffee, midday rice meal & rainwear provided',
        perksIcon: 'eco',
        notes: [
          'Clearing dry leaves around cardamom clumps and applying organic compost mulch.',
          'Light hand sickles and protective gloves provided on site.',
        ],
        createdAt: '2026-11-18T12:00:00.000Z',
      },
      {
        id: 'job-6',
        workName: 'Wheat Harvesting & Threshing',
        workType: 'Harvesting',
        cropName: 'Wheat (Golden Sharbati)',
        wagePerDay: 450,
        paymentNote: 'Daily Cash',
        workingHours: '7:00 AM – 3:00 PM (8 hrs)',
        duration: '6 Days Work',
        village: 'Pimpalgaon Baswant',
        villageKey: 'pimpalgaon',
        fieldLocation: 'Plot #14, Niphad Canal Road',
        farmerName: 'Ramesh Patel',
        farmerRating: 4.9,
        phone: '+91 98220 12345',
        workersNeededMale: 4,
        workersNeededFemale: 6,
        urgent: true,
        badgeText: 'Urgent • 10 Workers',
        perks: '2 times meals and 3 times tea or coffee included',
        perksIcon: 'restaurant',
        notes: [
          'Manual harvesting and feeding stalks to tractor-mounted thresher.',
          'Drinking water and shade tent arranged near canal boundary.',
        ],
        createdAt: '2026-11-21T05:30:00.000Z',
      },
    ],
    crops: [
      {
        id: 'crop-1',
        farmerName: 'Basavaraj Gowda',
        farmerInitials: 'BG',
        farmerRating: 4.9,
        farmerDeals: 18,
        village: 'Suntikoppa Village, Somwarpet, Coorg',
        cropName: 'Paddy – Sona Masoori',
        category: 'Paddy & Rice',
        varietyNotes: 'Raw Polished • Moisture < 12%',
        qualityBadge: 'Grade-A Fresh Harvest',
        gradeLabel: 'Paddy & Cereals',
        pricePerUnit: 2600,
        unitLabel: 'Quintal',
        unitShort: 'Qtl',
        quantity: 50,
        totalAmount: 130000,
        perKgDisplay: '(₹26.0 / kg)',
        equivalentWeightNote: '5,000 kg total',
        packagingNote: 'Gunny bags ready',
        postedAgo: '3 days ago',
        phone: '+91 98452 31890',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDLLi9SWk4IQStCmTLIJu2_Ras9EJ1fJlVRt6V6596QU-SISkwgMLhPVr2Wy0ex9I5gbRQ5jD1knIrkM8nrE5f4zCIt_e_0pbY5W-_ZnlT7-ymCmIb-uUU6smRZRHlmnVdBDMQPqUHawf2FmPnmwMGkoY-l7zzI4bGljX2tPDG8mrgn0sjRBmPG3dDGw2ffCaVSvP3FdN9cvkWq1n13Eyo7T30cEq5WyVwvFXQBItxH',
        createdAt: '2026-11-18T09:00:00.000Z',
      },
      {
        id: 'crop-2',
        farmerName: 'H. M. Muthappa',
        farmerInitials: 'HM',
        farmerRating: 5.0,
        farmerDeals: 31,
        village: 'Napoklu, Madikeri Taluk, Coorg',
        cropName: 'Robusta Cherry Coffee',
        category: 'Coffee',
        varietyNotes: 'Graded 16-Mesh Screen • 11.5% Moisture',
        qualityBadge: 'Estate Sun-Dried',
        gradeLabel: 'Commercial Coffee',
        pricePerUnit: 185,
        unitLabel: 'kg',
        unitShort: 'kg',
        quantity: 1200,
        totalAmount: 222000,
        perKgDisplay: '(₹18,500 / Qtl)',
        equivalentWeightNote: '12 Quintals',
        packagingNote: 'Direct estate dispatch',
        postedAgo: '1 day ago',
        phone: '+91 94482 76102',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuB05wXs7g2Z9U7rPx2eChQijtPzgq9X2U_JLnz6I8AjfLpZmSCqYmvN1EC8ZLQrmtbpOdCqUc9vPitiyUD8U_bkfQFQTUjrbYXYKjH-kKeZ-Y8eckagN3_oXI7yVLY4CEreS5SvHA-xKZgij9q3-B0bDNDDHAH9zLEwg7xcl3RSXwTaejSe-fQyvj_4xcKzK5kLD6n_l-_4VbPvDAX_UC7zb7qZovzi0c7OQm6JjCHy',
        createdAt: '2026-11-20T09:00:00.000Z',
      },
      {
        id: 'crop-3',
        farmerName: 'Suresh Somanna',
        farmerInitials: 'SS',
        farmerRating: 4.8,
        farmerDeals: 9,
        village: 'Kushalnagar Outskirts, Coorg',
        cropName: 'Tellicherry Black Pepper',
        category: 'Black Pepper',
        varietyNotes: 'Garbled Bold • Zero Chemical Sprays',
        qualityBadge: 'Organic Certified (TGSEB)',
        gradeLabel: 'Spices',
        pricePerUnit: 640,
        unitLabel: 'kg',
        unitShort: 'kg',
        quantity: 350,
        totalAmount: 224000,
        perKgDisplay: '(₹64,000 / Qtl)',
        equivalentWeightNote: '3.5 Quintals',
        packagingNote: 'Density 570+ g/L',
        postedAgo: '4 days ago',
        phone: '+91 97410 44921',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuC2psBC_wYUeDRk1m7S0GGg4L6WAem6ouxib7rqa4Am-VhhQkSLk_02222BodgjbFGTeZE-DLQiA_iisybiWEj5WgltbvT4D2gyBi539c-p2ZNx50CMPrF6gNQauuxG3JKrJ7E6sUUSha2trVq7xs3BtLaGexB98YaQBwaNCf9XkiKS4PvmTdPckZt7bdTVEiIDDCUlRLJ-flc34hPZbuxMnh4ClJvYuZntY7xiem-6',
        createdAt: '2026-11-17T09:00:00.000Z',
      },
      {
        id: 'crop-4',
        farmerName: 'Devendrappa Hegde',
        farmerInitials: 'DH',
        farmerRating: 4.9,
        farmerDeals: 42,
        village: 'Virajpet Belt, South Kodagu',
        cropName: 'Arecanut (Red / Mora)',
        category: 'Arecanut',
        varietyNotes: 'Naturally Cured • Solid Kernel Quality',
        qualityBadge: 'Ready For Dispatch',
        gradeLabel: 'Commercial Nut',
        pricePerUnit: 44000,
        unitLabel: 'Quintal',
        unitShort: 'Qtl',
        quantity: 8,
        totalAmount: 352000,
        perKgDisplay: '(₹440 / kg)',
        equivalentWeightNote: '800 kg total',
        packagingNote: 'Packed in 50kg bags',
        postedAgo: '2 days ago',
        phone: '+91 96112 55304',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAbF0taBJcQ6sWB8VKAURaSoBhZYJiYI0eLr45ZaGMUcq5hnOw5_-IKLsoyw4KYxhKBDZ81B8shSMTljE7m1YQ3TKPcoPUIkdEvnXPcEmuRRqJ0PFrGBKDv_XfGJr5wmCES81ZSmNcIwBzjh4P9HsmYdUIbBlpklwKrYN2QhYq9u5D1mnYogNtjdrhaeH9sqqJE93Vkxsdqjsvtj-u-104tq5SnSTgLEK60QlzmJmuM',
        createdAt: '2026-11-19T09:00:00.000Z',
      },
      {
        id: 'crop-5',
        farmerName: 'Prakash Deshmukh',
        farmerInitials: 'PD',
        farmerRating: 4.7,
        farmerDeals: 14,
        village: 'Pimpalgaon Baswant, Niphad, Nashik',
        cropName: 'Green Cardamom & Dry Ginger Mix',
        category: 'Spices',
        varietyNotes: 'Bold 8mm Pods • Sun Cured',
        qualityBadge: 'Export Grade',
        gradeLabel: 'Spices',
        pricePerUnit: 1420,
        unitLabel: 'kg',
        unitShort: 'kg',
        quantity: 120,
        totalAmount: 170400,
        perKgDisplay: '(₹1,42,000 / Qtl)',
        equivalentWeightNote: '1.2 Quintals',
        packagingNote: 'Moisture-sealed sacks',
        postedAgo: 'Today',
        phone: '+91 98231 44510',
        createdAt: '2026-11-21T03:00:00.000Z',
      },
    ],
    applications: [
      {
        id: 'app-1',
        jobId: 'job-6',
        workName: 'Wheat Harvesting & Bundling',
        farmerName: 'Ramesh Patel',
        village: 'Pimpalgaon Baswant',
        wagePerDay: 450,
        phone: '+91 98220 12345',
        applicantName: 'Ramesh Patel',
        status: 'pending',
        appliedAgo: '2h ago',
        createdAt: '2026-11-21T04:00:00.000Z',
      },
      {
        id: 'app-2',
        jobId: 'job-2',
        workName: 'Drip Irrigation Pipe Laying',
        farmerName: 'Vitthalrao More',
        village: 'Ozar Road Plot #4',
        wagePerDay: 480,
        phone: '+91 98220 11111',
        applicantName: 'Ramesh Patel',
        status: 'accepted',
        appliedAgo: 'Yesterday',
        note: 'Report tomorrow 7:00 AM. Meet supervisor at Village Panchayat Hall for plot conveyance.',
        createdAt: '2026-11-20T09:00:00.000Z',
      },
      {
        id: 'app-3',
        jobId: 'job-3',
        workName: 'Vineyard Pruning & Weeding',
        farmerName: 'Dnyaneshwar Shinde',
        village: 'Vinchur',
        wagePerDay: 500,
        phone: '+91 98220 77777',
        applicantName: 'Ramesh Patel',
        status: 'filled',
        appliedAgo: '3 days ago',
        note: 'Required headcount was completed.',
        createdAt: '2026-11-18T09:00:00.000Z',
      },
    ],
    offers: [],
    calculatorCrops: [
      { id: 'calc-1', label: 'Crop 1', cropName: 'Potato', ratePerKg: 40, quantityKg: 100, totalAmount: 4000 },
      { id: 'calc-2', label: 'Crop 2', cropName: 'Tomato (Hybrid)', ratePerKg: 32, quantityKg: 100, totalAmount: 3200 },
      { id: 'calc-3', label: 'Crop 3', cropName: 'Onion (Red Nasik)', ratePerKg: 45, quantityKg: 100, totalAmount: 4500 },
      { id: 'calc-4', label: 'Crop 4', cropName: 'Wheat (Lokwan)', ratePerKg: 28, quantityKg: 100, totalAmount: 2800 },
    ],
  };
}

function readDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    const initial = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

const EXPERTS = [
  {
    id: 'exp-1',
    name: 'Dr. Rajeshwar Kulkarni',
    specialization: 'Crop Disease',
    title: 'Crop Disease Specialist',
    experienceYears: 14,
    cropsCovered: 'Wheat, Paddy & Sugarcane',
    location: 'Pune District, MH',
    phone: '+91 98230 45120',
    availabilityLabel: 'Available Now',
    isAvailableNow: true,
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD_uKTiunp2N1BKvsUYWsozOfzxUdBWpKoc6FU9t3TrmZG3YsAV8ejCI9-CI4XRUm14ksehzPutbi5diKkvxsBxRoQt4tYcAw2EcteQZFZ-7BZBLe_8tzd_G6albO5XLXjNE82BQAUFSnLpFLc7M07CiGvp6eaT-8pMriNoAaN7KvpSoZejgH_qKZN7vdWdyhaU5qZoQjkXNz8RTAGvMhSkImI6QUQXbHVJeIG2TPmN',
  },
  {
    id: 'exp-2',
    name: 'Dr. Meenakshi Deshmukh',
    specialization: 'Soil Health',
    title: 'Soil Health & Nutrition',
    experienceYears: 11,
    cropsCovered: 'Soil Testing & Organic',
    location: 'Nashik District, MH',
    phone: '+91 97654 11209',
    availabilityLabel: 'Available Now',
    isAvailableNow: true,
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBLCnpAawlrUMFUQHm0qRbnzFObBQIx7jVY4beV5QgSqPLEYr0OXJ1VOsLGsJXnzuBZuc9HT1cDslCxyOF-n-FrPibLxYtgXa-WB_EOb_aXVZeRTepqbNRmQI-ze3iDH19AmReeDuE9mSQS9VxvgFrvzI1BSqp42hPTl4A4Xp9AY-Q3k6sXvgDvUfLm278e65eO5K_2veFtxBKcUVarKsNoBuKOG7mXWh6sRt53uBhN',
  },
  {
    id: 'exp-3',
    name: 'Shri Vikramjit Singh',
    specialization: 'Horticulture',
    title: 'Horticulture & Orchards',
    experienceYears: 18,
    cropsCovered: 'Mango, Citrus & Polyhouse',
    location: 'Ludhiana District, PB',
    phone: '+91 98140 77832',
    availabilityLabel: 'In Field • 4 PM',
    isAvailableNow: false,
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDrNxFq1q-y8vCxjgHNhGqb_FLCi92fcMxeTTi_WXTe0am-G40F8YDBqaCs7nTHcsnSzDnBdC1-UXkqkZiYdrkrH9Tz7MLY6oiQ0ziqDCo77E605CZjJplPZvCFH-yW5ziXeSPRjSM2PFa4hOyQ3sG4hE0iZ15Q2LgT1YAw380cL5YPpN-asRsXCzMkzsq2vc6t2KPAb1QstOAa4XG9JhlRw1mNRds80hfRfN_wKhGT',
  },
  {
    id: 'exp-4',
    name: 'Dr. Ananya Nair',
    specialization: 'Pest Control',
    title: 'Integrated Pest Control',
    experienceYears: 9,
    cropsCovered: 'Bio-pesticides & Cotton',
    location: 'Coimbatore, TN',
    phone: '+91 94430 65418',
    availabilityLabel: 'Available Now',
    isAvailableNow: true,
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDamNHV3TOSBs2wI4ooybNdJYiHCH0-if7WGpPrO6CyGm-PvDeSIIdkCREyA8ya7BaM1trWhjE3QlFvYTxHaPS4OWixWXHzQ_li7YvdZgpqd_OUcxnJlxbYN-TBgb6mdNA_Zkehu6VDneY77vtLwljI10VLkx7klDbIfdNL3H-MDs3Xd2RjS512RdQJIvfhfZmxx_dgsrnwO12ytXNmnKQL2-tl5fUz3t5FU20lCggR',
  },
];

const MANDI_RATES = [
  { id: 'mr-1', crop: 'Tomato', pricePerKg: 24, trend: 'up', badge: 'Daily Staple', marginNote: '₹24/kg • Quick Cycle', icon: 'nutrition' },
  { id: 'mr-2', crop: 'Potato', pricePerKg: 40, trend: 'up', badge: 'Steady', marginNote: '₹40/kg • High Volume', icon: 'eco' },
  {
    id: 'mr-3',
    crop: 'Black Pepper',
    pricePerKg: 640,
    trend: 'up',
    badge: 'High Demand',
    marginNote: '₹640/kg • High Margin',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAgXTXSbOztpjkMFmAr4aXKiBE6h2tOz5OQ5J2JsCy8WlmpF8-yq2K3W7Wn3JzJaDyyUTcOGWfR2qK3m78BEtXwLbNM5K2UJVDqXNIPO10_o6JtaBXXOGMVP_1S2jOt9q21HKHQwrqPSnfHxRI1s0RLES9qPtfklhLHVRlD1Q3xoTjGKgjHz94pkp9ZW9SXOVQys7omFyIp9Bo4ZM1q_vNMauK92GEOhuEOEH9c_3fl',
  },
  { id: 'mr-4', crop: 'Ginger', pricePerKg: 85, trend: 'up', badge: 'High Demand', marginNote: '₹85/kg • Top Demand', icon: 'psychology_alt' },
  { id: 'mr-5', crop: 'Cardamom', pricePerKg: 1450, trend: 'up', badge: 'Premium', marginNote: '₹1,450/kg • Export', icon: 'eco' },
  { id: 'mr-6', crop: 'Arecanut', pricePerKg: 440, trend: 'up', badge: 'Steady', marginNote: '₹440/kg • High Vol', icon: 'nature' },
  { id: 'mr-7', crop: 'Coffee', pricePerKg: 185, trend: 'up', badge: 'Export', marginNote: '₹185/kg • Estate Demand', icon: 'coffee' },
  { id: 'mr-8', crop: 'Onion', pricePerKg: 38, trend: 'up', badge: 'High Volume', marginNote: '₹38/kg • Storage Crop', icon: 'spa' },
  { id: 'mr-9', crop: 'Wheat', pricePerKg: 28, trend: 'up', badge: 'MSP Assured', marginNote: '₹28/kg • Staple Grain', icon: 'grass' },
];

interface GovtSupportItem {
  schemeName: string;
  authority: string;
  benefit: string;
  phone: string;
}

interface HowToGrowItem {
  landPrep: string;
  seedSpacing: string;
  irrigationFertilizer: string;
  pestHarvest: string;
}

const COMMON_FARMER_SCHEMES: GovtSupportItem[] = [
  {
    schemeName: 'Kisan Call Centre (KCC) Advisory',
    authority: 'Dept. of Agriculture & Farmers Welfare, Govt. of India',
    benefit: 'Free 24×7 crop, soil, pest & local weather advice in regional languages',
    phone: '1800-180-1551',
  },
  {
    schemeName: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    authority: 'Ministry of Agriculture Crop Insurance Desk',
    benefit: 'Low-premium crop loss insurance against drought, flood & unseasonal rain',
    phone: '14447',
  },
];

const CROP_SUITABILITY_DB: Record<
  string,
  {
    title: string;
    subtitle: string;
    soil: string;
    water: string;
    season: string;
    growingTips: string;
    regionsNote: string;
    bestStates: string[];
    bestDistricts: string[];
    unsuitableNote: string;
    pricePerKg: number;
    howToGrow: HowToGrowItem;
    govtSupport: GovtSupportItem[];
  }
> = {
  'Black Pepper': {
    title: 'Black Pepper (Piper nigrum)',
    subtitle: 'Best suited for humid, shaded Western Ghats plantations with silver oak or arecanut standards.',
    soil: 'Humus-rich red laterite or forest loamy soil, pH 5.5–6.5',
    water: 'Regular misting/irrigation in dry summer months; needs 1,250–2,000 mm annual rainfall',
    season: 'Monsoon planting (Jun–Aug)',
    growingTips: 'Grow with live standards (arecanut/silver oak) for filtered shade',
    regionsNote: 'Kodagu, Chikkamagaluru, Wayanad, Idukki & Nilgiris hills.',
    bestStates: ['Karnataka', 'Kerala', 'Tamil Nadu'],
    bestDistricts: ['Kodagu', 'Chikkamagaluru', 'Hassan', 'Shivamogga', 'Wayanad', 'Idukki', 'Nilgiris', 'Coimbatore'],
    unsuitableNote: 'Black Pepper needs high humidity (65–95%), heavy monsoon rainfall, and shaded hill-slope laterite soil; dry plains or hot semi-arid regions cause vine wilting and poor berry set.',
    pricePerKg: 640,
    howToGrow: {
      landPrep: 'Select well-drained sloppy or raised plantation beds with 50% shade. Dig 50×50×50 cm pits at the base of live support trees (Silver Oak or Arecanut) and fill with topsoil + 10 kg compost.',
      seedSpacing: 'Plant 2–3 rooted cuttings (Panniyur-1 or Karimunda) per standard at 2.5 m × 2.5 m spacing during May–June onset of monsoon.',
      irrigationFertilizer: 'Apply 10 kg FYM + 500 g neem cake per vine twice a year (May & Sep). Mulch root basins with dry leaves and drip-irrigate weekly from Jan to Apr.',
      pestHarvest: 'Spray 1% Bordeaux mixture before monsoon to prevent quick wilt. Harvest spikes 7–8 months after flowering when 1–2 berries turn bright red, then sun-dry 4–6 days.',
    },
    govtSupport: [
      {
        schemeName: 'MIDH & Spices Development Scheme',
        authority: 'Spices Board India (Ministry of Commerce)',
        benefit: 'Subsidy for certified pepper planting material, replanting & drying yards',
        phone: '0484-2333610',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Coffee: {
    title: 'Arabica & Robusta Coffee',
    subtitle: 'Thrives in cool highland shade estates with well-distributed monsoon rainfall.',
    soil: 'Deep, friable forest loam rich in organic matter, pH 6.0–6.5',
    water: 'Blossom & backing showers (Feb–Apr) critical for berry set',
    season: 'Planting Jun–Sep; Harvest Nov–Feb',
    growingTips: 'Maintain two-tier canopy shade and prune suckers after harvest',
    regionsNote: 'Kodagu, Chikkamagaluru, Wayanad & Nilgiris • Coffee Board advisory centers nearby.',
    bestStates: ['Karnataka', 'Kerala', 'Tamil Nadu'],
    bestDistricts: ['Kodagu', 'Chikkamagaluru', 'Hassan', 'Wayanad', 'Idukki', 'Nilgiris'],
    unsuitableNote: 'Coffee requires cool elevation (600–1,600 m), filtered forest shade, and timely Feb–Apr blossom showers. Lowland plains with extreme summer heat are unsuitable.',
    pricePerKg: 185,
    howToGrow: {
      landPrep: 'Establish two-tier permanent shade trees (Silver Oak & Dadap) one year ahead. Prepare 45×45×45 cm pits along contours to prevent soil erosion.',
      seedSpacing: 'Plant healthy nursery seedlings (Chandragiri / S.795 Arabica or CxR Robusta) at 2 m × 2 m (Arabica) or 3 m × 3 m (Robusta) in Jun–Aug.',
      irrigationFertilizer: 'Apply agricultural lime if soil pH < 5.8, plus 3 rounds of NPK + compost. Provide blossom sprinkler irrigation in late Feb–Mar if natural rain delays.',
      pestHarvest: 'Monitor White Stem Borer and Berry Borer; install pheromone traps. Pick only deep-red ripe cherries in 3–4 rounds and dry cleanly on raised tables.',
    },
    govtSupport: [
      {
        schemeName: 'Integrated Coffee Development Project (ICDP)',
        authority: 'Coffee Board of India',
        benefit: 'Subsidy for replanting, water harvesting tanks, pulpers & solar dryers',
        phone: '080-22266991',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Cardamom: {
    title: 'Small Green Cardamom (Elettaria cardamomum)',
    subtitle: 'High-value spice ideal for cool, moist evergreen forest canopies.',
    soil: 'Rich forest loam with thick leaf mulch, pH 5.0–6.5',
    water: 'Frequent light sprinkler irrigation during dry spells',
    season: 'Transplant Jun–Jul; Harvest Aug–Jan',
    growingTips: 'Keep 50–60% shade and apply organic neem cake at root zone',
    regionsNote: 'Kodagu, Chikkamagaluru, Idukki & Wayanad evergreen valleys.',
    bestStates: ['Karnataka', 'Kerala', 'Tamil Nadu'],
    bestDistricts: ['Kodagu', 'Chikkamagaluru', 'Hassan', 'Wayanad', 'Idukki', 'Nilgiris'],
    unsuitableNote: 'Small Cardamom cannot tolerate hot dry winds or temperatures above 32°C; it needs cool (15–28°C), humid, forest-shaded hill valleys.',
    pricePerKg: 1450,
    howToGrow: {
      landPrep: 'Clear undergrowth under evergreen canopy keeping 50–60% filtered shade. Prepare 60×60×45 cm pits filled with rich leaf mould and compost.',
      seedSpacing: 'Transplant disease-free suckers or tissue-culture plants (IISR Avinash / Njallani) at 2 m × 2 m or 3 m × 3 m during June–July rains.',
      irrigationFertilizer: 'Apply 5 kg compost + 250 g neem cake twice yearly. Run overhead micro-sprinklers every 10–12 days during Jan–May dry weather.',
      pestHarvest: 'Remove thrips-affected panicles and apply neem oil spray. Harvest plump dark-green capsules every 25–30 days from Aug to Jan and cure in drying chambers.',
    },
    govtSupport: [
      {
        schemeName: 'Cardamom Replanting & Irrigation Subsidy',
        authority: 'Spices Board India',
        benefit: 'Financial aid for nursery, shade regulation, sprinklers & curing kilns',
        phone: '0484-2333610',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Arecanut: {
    title: 'Arecanut (Areca catechu)',
    subtitle: 'Long-term perennial plantation palm well suited to humid tropical valleys.',
    soil: 'Deep laterite or clay loam with good drainage',
    water: 'Basin or drip irrigation in winter and summer',
    season: 'May–Jun or Sep–Oct planting',
    growingTips: 'Intercrop with black pepper or banana for extra annual income',
    regionsNote: 'Kodagu, Dakshina Kannada, Shivamogga, Chikkamagaluru & Kerala valleys.',
    bestStates: ['Karnataka', 'Kerala', 'Tamil Nadu'],
    bestDistricts: ['Kodagu', 'Chikkamagaluru', 'Dakshina Kannada', 'Shivamogga', 'Hassan', 'Wayanad', 'Idukki', 'Coimbatore'],
    unsuitableNote: 'Arecanut palms require warm humid tropics, deep moisture-retentive valleys, and frost-free winters; arid plains or cold northern states are unsuitable.',
    pricePerKg: 440,
    howToGrow: {
      landPrep: 'Ensure deep drainage channels to prevent waterlogging. Dig 90×90×90 cm pits in square layout and enrich with compost and red earth.',
      seedSpacing: 'Plant 12–18 month healthy seedlings (Mangala / Sumangala / Mohitnagar) at 2.7 m × 2.7 m spacing. Grow banana as temporary nurse shade for first 3 years.',
      irrigationFertilizer: 'Apply 12 kg green leaf / FYM per palm annually + split NPK. Drip-irrigate 15–20 litres/palm/day during dry summer months.',
      pestHarvest: 'Protect bunches with 1% Bordeaux spray before monsoon to stop Koleroga (mahali). Harvest ripe orange-yellow nuts 8–9 months after flowering.',
    },
    govtSupport: [
      {
        schemeName: 'PMKSY Micro-Irrigation & MIDH Plantation Support',
        authority: 'State Horticulture Dept. & ICAR-CPCRI',
        benefit: 'Up to 55%–80% drip irrigation subsidy for small & marginal farmers',
        phone: '1800-180-1551',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Tomato: {
    title: 'Tomato (Solanum lycopersicum)',
    subtitle: 'High-yield hybrid varieties thrive in well-drained black, red & loamy soils.',
    soil: 'Well-drained sandy or black loam, pH 6.0–7.0',
    water: 'Drip irrigation every 3–4 days',
    season: 'Kharif (Jun–Jul), Rabi (Oct–Nov) & Summer',
    growingTips: 'Stake plants at 30 days; mulch to retain moisture & prevent blight',
    regionsNote: 'Nashik, Pune, Mysuru, Belagavi, Coimbatore, Indore & Anand.',
    bestStates: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Madhya Pradesh', 'Uttar Pradesh', 'Punjab'],
    bestDistricts: [
      'Nashik', 'Pune', 'Nagpur', 'Satara', 'Kolhapur',
      'Mysuru', 'Belagavi', 'Hassan', 'Coimbatore',
      'Anand', 'Rajkot', 'Indore', 'Sehore', 'Agra', 'Meerut', 'Ludhiana',
    ],
    unsuitableNote: 'Continuous heavy rain and dense shaded forest estates (e.g., high-rainfall hill valleys) increase late blight and fruit rot in open-field Tomatoes.',
    pricePerKg: 24,
    howToGrow: {
      landPrep: 'Plough field 2–3 times to fine tilth and mix 8–10 tonnes/acre well-rotted FYM. Form raised beds (90 cm wide) with silver-black plastic mulch and drip lines.',
      seedSpacing: 'Transplant 25-day-old nursery seedlings (Arka Rakshak / hybrid varieties) at 60 cm × 45 cm spacing in the evening.',
      irrigationFertilizer: 'Give light drip irrigation every 2–3 days. Fertigate with balanced NPK + Calcium-Boron at flowering and fruiting stages to prevent blossom end rot.',
      pestHarvest: 'Tie plants to bamboo/wire stakes at 25–30 days. Install yellow sticky traps for whiteflies. Harvest begins 60–70 days after transplanting.',
    },
    govtSupport: [
      {
        schemeName: 'Mission for Integrated Development of Horticulture (MIDH)',
        authority: 'National Horticulture Board (NHB)',
        benefit: 'Subsidy for plastic mulching, staking, drip lines & protected polyhouses',
        phone: '1800-180-1551',
      },
      {
        schemeName: 'e-NAM Direct Mandi Price Discovery',
        authority: 'Small Farmers Agribusiness Consortium (SFAC)',
        benefit: 'Sell directly to pan-India buyers with transparent auction rates',
        phone: '1800-270-0224',
      },
    ],
  },
  Potato: {
    title: 'Potato (Solanum tuberosum)',
    subtitle: 'Cool-season tuber crop giving strong returns in fertile loamy soils.',
    soil: 'Loose, well-drained sandy loam, pH 5.5–6.5',
    water: 'Light furrow or drip irrigation every 6–8 days',
    season: 'Rabi (Oct–Nov) & moderate hill Kharif',
    growingTips: 'Earth up ridges 25 days after planting; use certified disease-free seed tubers',
    regionsNote: 'Pune, Agra, Meerut, Ludhiana, Hassan, Belagavi & Indore.',
    bestStates: ['Maharashtra', 'Karnataka', 'Punjab', 'Uttar Pradesh', 'Gujarat', 'Madhya Pradesh'],
    bestDistricts: [
      'Pune', 'Nashik', 'Satara', 'Hassan', 'Belagavi', 'Mysuru',
      'Ludhiana', 'Amritsar', 'Agra', 'Meerut', 'Anand', 'Indore', 'Sehore',
    ],
    unsuitableNote: 'Potato needs cool nights (15–20°C) for tuber bulking; tropical high-rainfall perennial forest zones or overly hot humid lowlands lead to poor tuberization.',
    pricePerKg: 40,
    howToGrow: {
      landPrep: 'Deep plough and harrow soil into loose, clod-free ridges 60 cm apart. Mix 8 tonnes compost/acre before ridging.',
      seedSpacing: 'Plant certified 30–40 g sprouted seed tubers (Kufri Jyoti / Kufri Pukhraj) at 20 cm spacing inside 60 cm ridges.',
      irrigationFertilizer: 'Keep soil evenly moist without flooding. Apply basal NPK at planting and top-dress Nitrogen during earthing-up at 25–30 days.',
      pestHarvest: 'Earth up ridges well so tubers stay covered and do not turn green. Stop irrigation 10 days before harvest at 90–100 days when haulms turn yellow.',
    },
    govtSupport: [
      {
        schemeName: 'MIDH Cold Storage & Seed Tuber Subsidy',
        authority: 'Dept. of Agriculture & Horticulture',
        benefit: 'Capital subsidy for cold storage units and certified seed tubers',
        phone: '1800-180-1551',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Onion: {
    title: 'Red Onion (Allium cepa)',
    subtitle: 'Ideal for dry sunny climates and fertile alluvial/medium-black plains with strong storage demand.',
    soil: 'Deep friable loam or medium black soil, pH 6.0–7.5',
    water: 'Light irrigation every 7–10 days; stop before harvest',
    season: 'Rabi (Nov–Dec) & Late Kharif',
    growingTips: 'Stop irrigation 15 days before harvest for better curing & storage',
    regionsNote: 'Nashik (Niphad/Lasalgaon), Pune, Rajkot, Indore, Belagavi & Agra.',
    bestStates: ['Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Karnataka', 'Uttar Pradesh'],
    bestDistricts: [
      'Nashik', 'Pune', 'Nagpur', 'Satara', 'Belagavi', 'Mysuru',
      'Anand', 'Rajkot', 'Indore', 'Sehore', 'Agra', 'Meerut',
    ],
    unsuitableNote: 'High-rainfall evergreen/hill districts (like Kodagu, Wayanad, Idukki, Nilgiris) cause fungal neck rot and prevent proper sun-curing of Onion bulbs.',
    pricePerKg: 38,
    howToGrow: {
      landPrep: 'Prepare raised flat beds or broad bed furrows (BBF) with good drainage and apply 8 tonnes/acre well-decomposed FYM + Sulphur.',
      seedSpacing: 'Transplant 6–8 week healthy seedlings (N-53 / Bhima Shakti / Bhima Kiran) at 15 cm × 10 cm spacing.',
      irrigationFertilizer: 'Use micro-sprinklers or drip every 6–8 days. Avoid excess nitrogen after 45 days to prevent thick necks and poor storage life.',
      pestHarvest: 'Control thrips early with neem-based sprays. Harvest when 50% of tops fall over; shade-cure bulbs for 10–15 days with necks trimmed to 2.5 cm.',
    },
    govtSupport: [
      {
        schemeName: 'Onion Storage Structure Subsidy (MIDH / NHRDF)',
        authority: 'National Horticultural Research & Development Foundation',
        benefit: 'Up to 50% subsidy for ventilated low-cost onion storage structures',
        phone: '1800-180-1551',
      },
      {
        schemeName: 'PM-KISAN Direct Income Support',
        authority: 'Ministry of Agriculture & Farmers Welfare',
        benefit: '₹6,000/year direct benefit transfer to eligible farmer bank accounts',
        phone: '155261',
      },
    ],
  },
  Ginger: {
    title: 'Ginger (Zingiber officinale)',
    subtitle: 'High-margin rhizome crop thriving on raised humus-rich beds with organic mulch.',
    soil: 'Well-drained sandy/red loam rich in humus, pH 6.0–6.5',
    water: 'Consistent moisture without waterlogging',
    season: 'Apr–May pre-monsoon planting',
    growingTips: 'Treat seed rhizomes before sowing and mulch beds with green leaves',
    regionsNote: 'Kodagu, Hassan, Mysuru, Wayanad, Satara & Pune.',
    bestStates: ['Karnataka', 'Kerala', 'Maharashtra', 'Tamil Nadu'],
    bestDistricts: [
      'Kodagu', 'Chikkamagaluru', 'Hassan', 'Mysuru', 'Belagavi',
      'Wayanad', 'Idukki', 'Pune', 'Satara', 'Kolhapur', 'Coimbatore',
    ],
    unsuitableNote: 'Ginger requires well-drained humus-rich loam and moderate warm humidity; heavy alkaline clay soils or extreme frost plains cause rhizome rot.',
    pricePerKg: 85,
    howToGrow: {
      landPrep: 'Prepare 1 m wide, 25 cm high raised beds with 40 cm drainage channels. Incorporate 10–12 tonnes FYM + 1 tonne neem cake per acre.',
      seedSpacing: 'Treat 25–30 g plump rhizome bits (Rio-de-Janeiro / IISR Varada) with Trichoderma solution and plant at 25 cm × 25 cm spacing, 4–5 cm deep.',
      irrigationFertilizer: 'Immediately mulch beds thickly with green leaves (3–4 tonnes/acre) and repeat after weeding at 45 and 90 days.',
      pestHarvest: 'Maintain strict drainage to prevent soft rot. Harvest fresh green ginger at 6 months or full mature spicy rhizomes at 8–9 months when leaves dry.',
    },
    govtSupport: [
      {
        schemeName: 'Spices Board & MIDH Rhizome Nursery Assistance',
        authority: 'Spices Board India / State Horticulture Mission',
        benefit: 'Support for disease-free ginger seed rhizomes, mulching & drip systems',
        phone: '0484-2333610',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
  Wheat: {
    title: 'Wheat (Triticum aestivum)',
    subtitle: 'Reliable Rabi cereal grain suited to cool winter plains with assured MSP market.',
    soil: 'Fertile clay loam to alluvial loam, pH 6.5–7.5',
    water: '4–6 irrigations at crown root, tillering, flowering & grain-filling stages',
    season: 'Rabi sowing (Nov 1 – Nov 25); Harvest Mar–Apr',
    growingTips: 'Sow on time in November using zero-till or seed-drill for uniform stand',
    regionsNote: 'Ludhiana, Amritsar, Agra, Meerut, Indore, Sehore, Nashik & Pune.',
    bestStates: ['Punjab', 'Uttar Pradesh', 'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Karnataka'],
    bestDistricts: [
      'Ludhiana', 'Amritsar', 'Agra', 'Meerut', 'Indore', 'Sehore',
      'Nashik', 'Pune', 'Nagpur', 'Anand', 'Rajkot', 'Belagavi',
    ],
    unsuitableNote: 'Wheat needs cool, dry winter weather (10–22°C) during tillering and grain filling. Warm humid coastal/hill districts like Kodagu, Wayanad, or Idukki are unsuitable.',
    pricePerKg: 28,
    howToGrow: {
      landPrep: 'Use laser land levelling and prepare fine seedbed (or sow directly with Happy Seeder / Zero-Till drill after paddy harvest).',
      seedSpacing: 'Sow 40 kg/acre certified seed (HD-2967 / Lokwan / Sharbati) in rows 20–22 cm apart at 4–5 cm depth.',
      irrigationFertilizer: 'First irrigation at 21 days (Crown Root Initiation) is critical. Apply split Urea + basal DAP/Potash as per Soil Health Card.',
      pestHarvest: 'Watch for yellow rust in Jan–Feb and aphids at ear emergence. Harvest when grains harden (moisture ~14%) and golden straw dries.',
    },
    govtSupport: [
      {
        schemeName: 'National Food Security Mission (NFSM) & MSP Procurement',
        authority: 'Food Corporation of India / State Mandi Board',
        benefit: 'Certified seed mini-kits, subsidized seed drills & guaranteed MSP procurement',
        phone: '1800-180-1551',
      },
      ...COMMON_FARMER_SCHEMES,
    ],
  },
};

function isCropSuitableForLocation(
  entry: (typeof CROP_SUITABILITY_DB)[string],
  state: string,
  district: string
): boolean {
  const normState = state.trim().toLowerCase();
  const normDist = district.trim().toLowerCase();
  const districtKnown = entry.bestDistricts.some((d) => d.toLowerCase() === normDist);
  if (districtKnown) return true;

  // Check if the district belongs to another incompatible agro-zone in our database
  const allKnownDistricts = new Set<string>();
  Object.values(CROP_SUITABILITY_DB).forEach((c) => {
    c.bestDistricts.forEach((d) => allKnownDistricts.add(d.toLowerCase()));
  });

  if (normDist && allKnownDistricts.has(normDist)) {
    // District is explicitly known in our agro-map, and this crop is NOT listed for it
    return false;
  }

  return entry.bestStates.some((s) => s.toLowerCase() === normState);
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'kisan-sathi-api', timestamp: new Date().toISOString() });
  });

  app.get('/api/auth/me', (req, res) => {
    const db = readDb();
    const auth = getAuthenticatedUser(req, db);
    const googleAuthConfigured = Boolean(
      (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
    );
    if (!auth) {
      res.json({ authenticated: false, user: null, googleAuthConfigured });
      return;
    }
    res.json({ authenticated: true, user: auth.user.profile, googleAuthConfigured });
  });

  app.post('/api/auth/signup', (req, res) => {
    const db = readDb();
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const profession = body.profession;
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    const district = typeof body.district === 'string' ? body.district.trim() : '';
    const taluk = typeof body.taluk === 'string' ? body.taluk.trim() : '';

    if (name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (minimum 2 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }
    if (!VALID_SIGNUP_PROFESSIONS.includes(profession)) {
      res.status(400).json({ error: 'Please select a valid category (Farmer, Farm Worker, or Supplier / Trader).' });
      return;
    }
    if (!isValidIndianLocation(state, district, taluk)) {
      res.status(400).json({ error: 'Please select a valid State, District, and Taluk.' });
      return;
    }
    if (db.users?.[rawEmail]) {
      res.status(409).json({ error: 'An account with this email already exists. Please Sign In instead.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const profile: ProfileRecord = {
      id: `user-${Date.now()}`,
      name,
      email: rawEmail,
      profession,
      state,
      district,
      taluk,
      phone: '',
      googleConnected: false,
      avatarUrl: DEFAULT_AVATAR,
      profileCompleted: true,
      updatedAt: nowIso,
    };

    db.users = {
      ...(db.users ?? {}),
      [rawEmail]: {
        profile,
        passwordHash: hashPassword(password),
        authProvider: 'password',
        createdAt: nowIso,
      },
    };

    const token = createSessionForEmail(db, rawEmail);
    writeDb(db);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: profile });
  });

  app.post('/api/auth/login', (req, res) => {
    const db = readDb();
    const body = req.body ?? {};
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawEmail || !password) {
      res.status(400).json({ error: 'Please enter both email and password.' });
      return;
    }

    const existing = db.users?.[rawEmail];
    if (!existing) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (!existing.passwordHash) {
      res.status(401).json({
        error:
          existing.authProvider === 'google'
            ? 'This account is linked with Google Sign-In. Please continue with Google.'
            : 'Invalid email or password.',
      });
      return;
    }
    if (!verifyPassword(password, existing.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const safeProfile: ProfileRecord = {
      ...existing.profile,
      profession: normalizeProfession(existing.profile.profession),
    };
    const token = createSessionForEmail(db, rawEmail);
    writeDb(db);
    setSessionCookie(req, res, token);
    res.json({ user: safeProfile });
  });

  app.post('/api/auth/google', async (req, res) => {
    const googleClientId = (
      process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      ''
    ).trim();
    if (!googleClientId) {
      res.status(503).json({
        error:
          'Google Sign-In is not configured on this server. Please use Email Sign Up or Sign In.',
      });
      return;
    }

    const { idToken, profession } = req.body ?? {};
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ error: 'Missing Google ID token credential.' });
      return;
    }

    try {
      const verifyResp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`
      );
      if (!verifyResp.ok) {
        res.status(401).json({ error: 'Google token verification failed.' });
        return;
      }
      const tokenInfo = (await verifyResp.json()) as {
        aud?: string;
        email?: string;
        email_verified?: string | boolean;
        name?: string;
        picture?: string;
      };
      const verified =
        tokenInfo.email_verified === true || tokenInfo.email_verified === 'true';
      if (tokenInfo.aud !== googleClientId || !verified || !tokenInfo.email) {
        res.status(401).json({ error: 'Invalid or unverified Google account credential.' });
        return;
      }

      const cleanEmail = tokenInfo.email.trim().toLowerCase();
      const db = readDb();
      const existing = db.users?.[cleanEmail];
      const nowIso = new Date().toISOString();

      const nextProfile: ProfileRecord = existing
        ? {
            ...existing.profile,
            email: cleanEmail,
            googleConnected: true,
            profession: VALID_SIGNUP_PROFESSIONS.includes(profession)
              ? profession
              : normalizeProfession(existing.profile.profession),
            avatarUrl: existing.profile.avatarUrl || tokenInfo.picture || DEFAULT_AVATAR,
            updatedAt: nowIso,
          }
        : {
            id: `user-${Date.now()}`,
            name: tokenInfo.name?.trim() || cleanEmail.split('@')[0],
            email: cleanEmail,
            profession: VALID_SIGNUP_PROFESSIONS.includes(profession) ? profession : 'farmer',
            state: '',
            district: '',
            taluk: '',
            phone: '',
            googleConnected: true,
            avatarUrl: tokenInfo.picture || DEFAULT_AVATAR,
            profileCompleted: false,
            updatedAt: nowIso,
          };

      db.users = {
        ...(db.users ?? {}),
        [cleanEmail]: {
          profile: nextProfile,
          passwordHash: existing?.passwordHash,
          authProvider: existing?.authProvider ?? 'google',
          createdAt: existing?.createdAt ?? nowIso,
        },
      };

      const token = createSessionForEmail(db, cleanEmail);
      writeDb(db);
      setSessionCookie(req, res, token);
      res.json({ user: nextProfile });
    } catch {
      res.status(502).json({ error: 'Unable to verify Google Sign-In at the moment.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const db = readDb();
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token && db.sessions?.[token]) {
      delete db.sessions[token];
      writeDb(db);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/profile', (req, res) => {
    const db = readDb();
    const auth = getAuthenticatedUser(req, db);
    if (!auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    res.json(auth.user.profile);
  });

  app.post('/api/profile', (req, res) => {
    const db = readDb();
    const auth = getAuthenticatedUser(req, db);
    if (!auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const {
      name,
      profession,
      state,
      district,
      taluk,
      phone,
      avatarUrl,
      profileCompleted,
    } = req.body ?? {};

    const current = auth.user.profile;
    const nextState = typeof state === 'string' && state.trim() ? state.trim() : current.state;
    const nextDistrict =
      typeof district === 'string' && district.trim() ? district.trim() : current.district;
    const nextTaluk = typeof taluk === 'string' && taluk.trim() ? taluk.trim() : current.taluk;

    if (
      (typeof state === 'string' || typeof district === 'string' || typeof taluk === 'string') &&
      !isValidIndianLocation(nextState, nextDistrict, nextTaluk)
    ) {
      res.status(400).json({ error: 'Please select a valid State, District, and Taluk.' });
      return;
    }

    if (profession !== undefined && !VALID_PROFILE_PROFESSIONS.includes(profession)) {
      res.status(400).json({ error: 'Invalid category selected.' });
      return;
    }

    const nextProfile: ProfileRecord = {
      ...current,
      name: typeof name === 'string' && name.trim() ? name.trim() : current.name,
      email: auth.email,
      profession: VALID_PROFILE_PROFESSIONS.includes(profession)
        ? profession
        : normalizeProfession(current.profession),
      state: nextState,
      district: nextDistrict,
      taluk: nextTaluk,
      phone: typeof phone === 'string' ? phone.trim() : current.phone,
      avatarUrl:
        typeof avatarUrl === 'string'
          ? avatarUrl.trim() || DEFAULT_AVATAR
          : current.avatarUrl,
      profileCompleted:
        typeof profileCompleted === 'boolean'
          ? profileCompleted
          : Boolean(nextState && nextDistrict && nextTaluk),
      updatedAt: new Date().toISOString(),
    };

    db.users = {
      ...(db.users ?? {}),
      [auth.email]: {
        ...auth.user,
        profile: nextProfile,
      },
    };
    writeDb(db);
    res.json(nextProfile);
  });

  app.post('/api/crop-analyze', async (req, res) => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        configured: false,
        error:
          'Crop photo analysis service is not configured yet (GEMINI_API_KEY is not set on the server).',
      });
      return;
    }

    const body = req.body ?? {};
    const rawBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'image/jpeg';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
    if (!allowedMimeTypes.has(normalizedMime)) {
      res.status(400).json({ error: 'Unsupported image format. Please upload a JPG, PNG, or WebP photo.' });
      return;
    }

    const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    if (!cleanBase64) {
      res.status(400).json({ error: 'Please select or capture a crop photo to analyze.' });
      return;
    }
    if (cleanBase64.length > 8 * 1024 * 1024) {
      res.status(400).json({ error: 'Uploaded photo is too large. Please upload an image under 5 MB.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = [
        'Examine this crop or plant photo carefully for a farmer.',
        notes ? `Farmer notes: ${notes}` : '',
        'Identify the crop if visible, describe observable plant health or pest/disease/nutrient symptoms accurately without guessing beyond what is visible, and provide practical next-step agricultural recommendations.',
      ]
        .filter(Boolean)
        .join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction:
            'You are an agricultural crop photo advisor. Be clear, practical, and honest about visual uncertainty. If the image is unclear or not a crop/plant, say so honestly.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cropIdentified: {
                type: Type.STRING,
                description: 'Identified crop/plant name or unclear if not identifiable.',
              },
              healthStatus: {
                type: Type.STRING,
                description: 'Brief status such as Healthy, Possible Fungal Spot, Nutrient Stress, Pest Damage, or Unclear Image.',
              },
              summary: {
                type: Type.STRING,
                description: 'Concise summary of visible crop and leaf/fruit condition.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 practical next steps for the farmer.',
              },
              cautionNote: {
                type: Type.STRING,
                description: 'When to verify with local KVK / Krishi Vigyan Kendra or helpline 1800-180-1551.',
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Crop analysis returned an empty response. Please try another clear photo.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        cropIdentified?: string;
        healthStatus?: string;
        summary?: string;
        recommendations?: string[];
        cautionNote?: string;
      };

      res.json({
        cropIdentified: parsed.cropIdentified || 'Unconfirmed Plant / Crop',
        healthStatus: parsed.healthStatus || 'Needs Review',
        summary: parsed.summary || 'Visual review completed.',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        cautionNote: parsed.cautionNote,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze crop photo right now.';
      const status = msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') ? 502 : 500;
      res.status(status).json({ error: `Crop photo analysis failed: ${msg}` });
    }
  });

  app.get('/api/jobs', (req, res) => {
    const db = readDb();
    const q = String(req.query.q ?? '').toLowerCase().trim();
    const village = String(req.query.village ?? 'all').toLowerCase().trim();
    const urgentOnly = req.query.urgent === 'true';
    const sort = String(req.query.sort ?? 'wage-desc');

    let items = [...db.jobs];
    if (village && village !== 'all') {
      items = items.filter((job) => job.villageKey === village || job.village.toLowerCase().includes(village));
    }
    if (urgentOnly) {
      items = items.filter((job) => job.urgent);
    }
    if (q) {
      items = items.filter((job) =>
        `${job.workName} ${job.workType} ${job.cropName} ${job.village} ${job.fieldLocation} ${job.farmerName}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (sort === 'wage-asc') {
      items.sort((a, b) => a.wagePerDay - b.wagePerDay);
    } else if (sort === 'urgent') {
      items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.wagePerDay - a.wagePerDay);
    } else {
      items.sort((a, b) => b.wagePerDay - a.wagePerDay);
    }

    res.json(items);
  });

  app.post('/api/jobs', (req, res) => {
    const db = readDb();
    const authProfile = getAuthenticatedUser(req, db)?.user.profile;
    const body = req.body ?? {};
    const workName = String(body.workName ?? body.workType ?? 'Agricultural Work').trim();
    const cropName = String(body.cropName ?? 'Seasonal Crop').trim();
    const fieldLocation = String(body.fieldLocation ?? 'Main Farm Plot').trim();
    const village = String(body.village ?? authProfile?.taluk ?? 'Local Village').trim();
    const villageKey = village.toLowerCase().split(/[\s,]+/)[0] || 'local';
    const wagePerDay = Math.max(100, Number(body.wagePerDay) || 450);
    const workingHours = String(body.workingHours ?? '8:00 AM – 4:30 PM (8 hrs)').trim();
    const duration = String(body.duration ?? '5 Days Work').trim();
    const farmerName = String(body.farmerName ?? authProfile?.name ?? 'Farmer').trim();
    const phone = String(body.phone ?? authProfile?.phone ?? '+91 98000 00000').trim();
    const workersNeededMale = Math.max(0, Math.floor(Number(body.workersNeededMale) || 0));
    const workersNeededFemale = Math.max(0, Math.floor(Number(body.workersNeededFemale) || 0));
    const totalNeeded = Math.max(1, workersNeededMale + workersNeededFemale);
    const perks = String(body.perks ?? 'Meals and tea included').trim();
    const nowIso = new Date().toISOString();

    const newJob: JobRecord = {
      id: `job-${Date.now()}`,
      workName: `${workName} (${cropName})`,
      workType: String(body.workType ?? 'Field Work').trim(),
      cropName,
      wagePerDay,
      paymentNote: 'Daily Cash / UPI',
      workingHours,
      duration,
      village,
      villageKey,
      fieldLocation,
      farmerName,
      farmerRating: 4.9,
      phone,
      workersNeededMale,
      workersNeededFemale,
      assignedMale: 0,
      assignedFemale: 0,
      urgent: Boolean(body.urgent ?? true),
      badgeText: `Urgent • ${totalNeeded} Needed`,
      perks,
      perksIcon: 'restaurant',
      notes: [
        `Crop: ${cropName}.`,
        `Workers needed: ${workersNeededMale} Male, ${workersNeededFemale} Female.`,
        perks,
      ],
      createdAt: nowIso,
    };

    const linkedApplication: ApplicationRecord = {
      id: `app-post-${Date.now()}`,
      jobId: newJob.id,
      workName: newJob.workName,
      farmerName: newJob.farmerName,
      village: newJob.village,
      fieldLocation: newJob.fieldLocation,
      workingHours: newJob.workingHours,
      duration: newJob.duration,
      wagePerDay: newJob.wagePerDay,
      phone: newJob.phone,
      applicantName: farmerName,
      recordType: 'posted',
      workersNeededMale: newJob.workersNeededMale,
      workersNeededFemale: newJob.workersNeededFemale,
      assignedMale: 0,
      assignedFemale: 0,
      status: 'accepted',
      appliedAgo: 'Just now',
      note: perks,
      createdAt: nowIso,
    };

    db.jobs.unshift(newJob);
    db.applications.unshift(linkedApplication);
    writeDb(db);
    res.status(201).json(newJob);
  });

  app.patch('/api/jobs/:id/workers', (req, res) => {
    const db = readDb();
    const job = db.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const action = req.body?.action === 'unassign' ? 'unassign' : 'assign';
    const gender = req.body?.gender === 'female' ? 'female' : 'male';
    const currentMaleNeeded = Math.max(0, job.workersNeededMale ?? 0);
    const currentFemaleNeeded = Math.max(0, job.workersNeededFemale ?? 0);
    const currentMaleAssigned = Math.max(0, job.assignedMale ?? 0);
    const currentFemaleAssigned = Math.max(0, job.assignedFemale ?? 0);

    if (action === 'assign') {
      if (gender === 'male') {
        if (currentMaleNeeded <= 0) {
          res.status(400).json({ error: 'No male worker positions remaining to assign.' });
          return;
        }
        job.workersNeededMale = currentMaleNeeded - 1;
        job.assignedMale = currentMaleAssigned + 1;
      } else {
        if (currentFemaleNeeded <= 0) {
          res.status(400).json({ error: 'No female worker positions remaining to assign.' });
          return;
        }
        job.workersNeededFemale = currentFemaleNeeded - 1;
        job.assignedFemale = currentFemaleAssigned + 1;
      }
    } else {
      if (gender === 'male') {
        if (currentMaleAssigned <= 0) {
          res.status(400).json({ error: 'No assigned male workers to remove.' });
          return;
        }
        job.assignedMale = currentMaleAssigned - 1;
        job.workersNeededMale = currentMaleNeeded + 1;
      } else {
        if (currentFemaleAssigned <= 0) {
          res.status(400).json({ error: 'No assigned female workers to remove.' });
          return;
        }
        job.assignedFemale = currentFemaleAssigned - 1;
        job.workersNeededFemale = currentFemaleNeeded + 1;
      }
    }

    const totalRemaining = Math.max(0, job.workersNeededMale) + Math.max(0, job.workersNeededFemale);
    job.badgeText = totalRemaining === 0 ? 'Positions Filled' : `Urgent • ${totalRemaining} Needed`;

    db.applications = db.applications.map((appItem) => {
      if (appItem.jobId !== job.id) return appItem;
      return {
        ...appItem,
        workersNeededMale: job.workersNeededMale,
        workersNeededFemale: job.workersNeededFemale,
        assignedMale: job.assignedMale ?? 0,
        assignedFemale: job.assignedFemale ?? 0,
        status:
          totalRemaining === 0
            ? 'filled'
            : appItem.recordType === 'posted'
            ? 'accepted'
            : appItem.status === 'filled'
            ? 'pending'
            : appItem.status,
      };
    });

    writeDb(db);
    res.json(job);
  });

  app.get('/api/crops', (req, res) => {
    const db = readDb();
    const q = String(req.query.q ?? '').toLowerCase().trim();
    const category = String(req.query.category ?? 'All Crops').trim();
    const village = String(req.query.village ?? 'All Villages').trim();
    const sort = String(req.query.sort ?? 'newest');

    let items = db.crops.map((c) => ({
      ...c,
      totalAmount: Math.round(c.pricePerUnit * c.quantity),
    }));

    if (category && category !== 'All Crops') {
      items = items.filter((crop) => crop.category.toLowerCase() === category.toLowerCase());
    }
    if (village && village !== 'All Villages') {
      items = items.filter((crop) => crop.village.toLowerCase().includes(village.toLowerCase()));
    }
    if (q) {
      items = items.filter((crop) =>
        `${crop.cropName} ${crop.varietyNotes} ${crop.farmerName} ${crop.village} ${crop.category}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (sort === 'price-asc') {
      items.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    } else if (sort === 'price-desc') {
      items.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
    } else if (sort === 'total-desc') {
      items.sort((a, b) => b.totalAmount - a.totalAmount);
    } else {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(items);
  });

  app.post('/api/crops', (req, res) => {
    const db = readDb();
    const authProfile = getAuthenticatedUser(req, db)?.user.profile;
    const body = req.body ?? {};
    const farmerName = String(body.farmerName ?? authProfile?.name ?? 'Farmer').trim();
    const initials = farmerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'KS';
    const pricePerUnit = Math.max(1, Number(body.pricePerUnit) || 0);
    const quantity = Math.max(1, Number(body.quantity) || 0);
    const unitLabel: 'Quintal' | 'kg' = body.unitLabel === 'Quintal' ? 'Quintal' : 'kg';
    const unitShort: 'Qtl' | 'kg' = unitLabel === 'Quintal' ? 'Qtl' : 'kg';
    const totalAmount = Math.round(pricePerUnit * quantity);

    const perKg = unitLabel === 'Quintal' ? (pricePerUnit / 100).toFixed(1) : pricePerUnit.toString();
    const equivalentWeight =
      unitLabel === 'Quintal'
        ? `${(quantity * 100).toLocaleString('en-IN')} kg total`
        : `${(quantity / 100).toFixed(1)} Quintals`;

    const newCrop: CropRecord = {
      id: `crop-${Date.now()}`,
      farmerName,
      farmerInitials: initials,
      farmerRating: 4.9,
      farmerDeals: 1,
      village: String(
        body.village ??
          (authProfile?.taluk && authProfile?.district
            ? `${authProfile.taluk}, ${authProfile.district}`
            : 'Local Farmgate')
      ).trim(),
      cropName: String(body.cropName ?? 'Fresh Farm Produce').trim(),
      category: String(body.category ?? 'Produce').trim(),
      varietyNotes: '',
      qualityBadge: 'Newly Listed Harvest',
      gradeLabel: '',
      pricePerUnit,
      unitLabel,
      unitShort,
      quantity,
      totalAmount,
      perKgDisplay: unitLabel === 'Quintal' ? `(₹${perKg} / kg)` : `(₹${(pricePerUnit * 100).toLocaleString('en-IN')} / Qtl)`,
      equivalentWeightNote: equivalentWeight,
      packagingNote: String(body.packagingNote ?? 'Ready for pickup').trim(),
      postedAgo: 'Just now',
      phone: String(body.phone ?? authProfile?.phone ?? '+91 98000 00000').trim(),
      createdAt: new Date().toISOString(),
    };

    db.crops.unshift(newCrop);
    writeDb(db);
    res.status(201).json(newCrop);
  });

  app.patch('/api/crops/:id', (req, res) => {
    const db = readDb();
    const crop = db.crops.find((c) => c.id === req.params.id);
    if (!crop) {
      res.status(404).json({ error: 'Crop lot not found' });
      return;
    }

    const body = req.body ?? {};
    if (typeof body.cropName === 'string' && body.cropName.trim()) {
      crop.cropName = body.cropName.trim();
    }
    if (typeof body.varietyNotes === 'string') {
      crop.varietyNotes = body.varietyNotes.trim() || crop.varietyNotes;
    }
    writeDb(db);
    res.json({
      ...crop,
      totalAmount: Math.round(crop.pricePerUnit * crop.quantity),
    });
  });

  app.get('/api/applications', (_req, res) => {
    const db = readDb();
    const enriched = db.applications.map((appItem) => {
      const job = db.jobs.find((j) => j.id === appItem.jobId);
      if (!job) return appItem;
      return {
        ...appItem,
        fieldLocation: appItem.fieldLocation ?? job.fieldLocation,
        workingHours: appItem.workingHours ?? job.workingHours,
        duration: appItem.duration ?? job.duration,
        workersNeededMale: Math.max(0, job.workersNeededMale ?? 0),
        workersNeededFemale: Math.max(0, job.workersNeededFemale ?? 0),
        assignedMale: Math.max(0, job.assignedMale ?? 0),
        assignedFemale: Math.max(0, job.assignedFemale ?? 0),
      };
    });
    res.json(enriched);
  });

  app.post('/api/applications', (req, res) => {
    const db = readDb();
    const authProfile = getAuthenticatedUser(req, db)?.user.profile;
    const body = req.body ?? {};
    const jobId = String(body.jobId ?? '');
    const existing = db.applications.find((a) => a.jobId === jobId && a.recordType !== 'posted');
    if (existing) {
      res.json(existing);
      return;
    }

    const job = db.jobs.find((j) => j.id === jobId);
    const newApp: ApplicationRecord = {
      id: `app-${Date.now()}`,
      jobId: job?.id ?? jobId,
      workName: job?.workName ?? String(body.workName ?? 'Agricultural Work'),
      farmerName: job?.farmerName ?? String(body.farmerName ?? 'Farmer'),
      village: job?.village ?? String(body.village ?? 'Local Village'),
      fieldLocation: job?.fieldLocation,
      workingHours: job?.workingHours,
      duration: job?.duration,
      wagePerDay: job?.wagePerDay ?? Number(body.wagePerDay ?? 500),
      phone: job?.phone ?? String(body.phone ?? '+91 98450 12345'),
      applicantName: String(body.applicantName ?? authProfile?.name ?? 'Farm Worker'),
      recordType: 'application',
      workersNeededMale: Math.max(0, job?.workersNeededMale ?? 0),
      workersNeededFemale: Math.max(0, job?.workersNeededFemale ?? 0),
      assignedMale: Math.max(0, job?.assignedMale ?? 0),
      assignedFemale: Math.max(0, job?.assignedFemale ?? 0),
      status: 'pending',
      appliedAgo: 'Just now',
      note: 'Waiting for farmer confirmation.',
      createdAt: new Date().toISOString(),
    };
    db.applications.unshift(newApp);
    writeDb(db);
    res.status(201).json(newApp);
  });

  app.delete('/api/applications/:id', (req, res) => {
    const db = readDb();
    const target = db.applications.find((a) => a.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    db.applications = db.applications.filter((a) => a.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  app.get('/api/offers', (_req, res) => {
    const db = readDb();
    res.json(db.offers);
  });

  app.post('/api/offers', (req, res) => {
    const db = readDb();
    const authProfile = getAuthenticatedUser(req, db)?.user.profile;
    const body = req.body ?? {};
    const crop = db.crops.find((c) => c.id === body.cropId);
    const offeredPricePerUnit = Math.max(1, Number(body.offeredPricePerUnit) || crop?.pricePerUnit || 0);
    const quantity = Math.max(1, Number(body.quantity) || crop?.quantity || 1);
    const totalOfferAmount = Math.round(offeredPricePerUnit * quantity);

    const newOffer: OfferRecord = {
      id: `offer-${Date.now()}`,
      cropId: String(body.cropId ?? crop?.id ?? ''),
      cropName: crop?.cropName ?? String(body.cropName ?? 'Crop Lot'),
      farmerName: crop?.farmerName ?? String(body.farmerName ?? 'Farmer'),
      buyerName: String(body.buyerName ?? authProfile?.name ?? 'Supplier / Trader'),
      buyerPhone: String(body.buyerPhone ?? authProfile?.phone ?? '+91 98000 00000'),
      offeredPricePerUnit,
      quantity,
      unitShort: crop?.unitShort ?? String(body.unitShort ?? 'kg'),
      totalOfferAmount,
      message: typeof body.message === 'string' ? body.message.trim() : undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.offers.unshift(newOffer);
    writeDb(db);
    res.status(201).json(newOffer);
  });

  app.get('/api/experts', (req, res) => {
    const q = String(req.query.q ?? '').toLowerCase().trim();
    const spec = String(req.query.specialization ?? 'all').trim();
    let list = [...EXPERTS];
    if (spec && spec !== 'all') {
      list = list.filter((e) => e.specialization.toLowerCase() === spec.toLowerCase());
    }
    if (q) {
      list = list.filter((e) =>
        `${e.name} ${e.specialization} ${e.title} ${e.location} ${e.cropsCovered}`.toLowerCase().includes(q)
      );
    }
    res.json(list);
  });

  app.get('/api/mandi-rates', (_req, res) => {
    res.json(MANDI_RATES);
  });

  app.get('/api/recommendations', (req, res) => {
    const state = String(req.query.state ?? 'Karnataka').trim();
    const district = String(req.query.district ?? 'Kodagu').trim();

    const recommended = Object.entries(CROP_SUITABILITY_DB)
      .filter(([, entry]) => isCropSuitableForLocation(entry, state, district))
      .map(([crop, entry]) => ({
        crop,
        title: entry.title,
        season: entry.season,
        reason: entry.subtitle,
        pricePerKg: entry.pricePerKg,
        howToGrow: entry.howToGrow,
        govtSupport: entry.govtSupport,
      }));

    res.json(recommended);
  });

  app.get('/api/suitability', (req, res) => {
    const crop = String(req.query.crop ?? 'Black Pepper').trim();
    const state = String(req.query.state ?? 'Karnataka').trim();
    const district = String(req.query.district ?? 'Kodagu').trim();
    const taluk = String(req.query.taluk ?? 'Madikeri').trim();

    const matchedKey = Object.keys(CROP_SUITABILITY_DB).find(
      (k) => k.toLowerCase() === crop.toLowerCase() || crop.toLowerCase().includes(k.toLowerCase())
    );
    const entry = matchedKey ? CROP_SUITABILITY_DB[matchedKey] : null;
    const localAlternatives = Object.entries(CROP_SUITABILITY_DB)
      .filter(([, item]) => isCropSuitableForLocation(item, state, district))
      .map(([name]) => name);

    if (entry) {
      const suitable = isCropSuitableForLocation(entry, state, district);
      res.json({
        crop: matchedKey ?? crop,
        title: entry.title,
        subtitle: entry.subtitle,
        suitable,
        notRecommendedReason: suitable
          ? undefined
          : `${entry.title} is not recommended for ${taluk}, ${district} (${state}). ${entry.unsuitableNote}`,
        recommendedAlternativeCrops: localAlternatives,
        soil: entry.soil,
        water: entry.water,
        season: entry.season,
        growingTips: entry.growingTips,
        regionsNote: `${taluk}, ${district} (${state}) • ${entry.regionsNote}`,
        howToGrow: entry.howToGrow,
        govtSupport: entry.govtSupport,
      });
      return;
    }

    res.json({
      crop,
      title: crop,
      subtitle: `Local agro-climatic check for ${crop} in ${taluk}, ${district}, ${state}.`,
      suitable: false,
      notRecommendedReason: `Verified regional cultivation records for "${crop}" in ${taluk}, ${district} (${state}) are not confirmed under local growing conditions. Please consider crops verified for your district or consult your local Krishi Vigyan Kendra (1800-180-1551) before sowing.`,
      recommendedAlternativeCrops: localAlternatives,
      soil: 'Verify soil pH & organic carbon via local Soil Health Card lab',
      water: 'Match crop water demand to local taluk irrigation availability',
      season: 'Confirm Kharif / Rabi sowing window with district KVK',
      growingTips: 'Always perform a small trial plot and verify certified local seed availability first.',
      regionsNote: `${taluk}, ${district} (${state}) • Recommended local crops: ${localAlternatives.join(', ') || 'Consult local KVK'}.`,
      howToGrow: {
        landPrep: 'Get a Soil Health Card test before land preparation and apply recommended compost.',
        seedSpacing: 'Use only state agriculture university certified seeds suitable for your district.',
        irrigationFertilizer: 'Adopt drip irrigation and apply balanced nutrients based on soil test.',
        pestHarvest: 'Contact Kisan Call Centre (1800-180-1551) for local pest management & harvest timing.',
      },
      govtSupport: COMMON_FARMER_SCHEMES,
    });
  });

  app.get('/api/calculator-crops', (_req, res) => {
    const db = readDb();
    res.json(db.calculatorCrops);
  });

  app.post('/api/calculator-crops', (req, res) => {
    const db = readDb();
    const body = req.body ?? {};
    const cropName = String(body.cropName ?? 'Potato').trim();
    const ratePerKg = Math.max(0, Number(body.ratePerKg) || 0);
    const quantityKg = Math.max(0, Number(body.quantityKg) || 0);
    const totalAmount = Math.round(ratePerKg * quantityKg);
    const nextIndex = db.calculatorCrops.length + 1;

    const item: CalculatorCropRecord = {
      id: `calc-${Date.now()}`,
      label: String(body.label ?? `Crop ${nextIndex}`),
      cropName,
      ratePerKg,
      quantityKg,
      totalAmount,
    };
    db.calculatorCrops.push(item);
    writeDb(db);
    res.status(201).json(item);
  });

  app.delete('/api/calculator-crops/:id', (req, res) => {
    const db = readDb();
    const id = req.params.id;
    db.calculatorCrops = db.calculatorCrops.filter((c) => c.id !== id);
    writeDb(db);
    res.json({ ok: true });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Kisan Sathi server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
