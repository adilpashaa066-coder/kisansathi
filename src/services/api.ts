import type {
  AgriExpert,
  AgriculturalJob,
  AuthStatusResponse,
  CalculatorCrop,
  CropOffer,
  CropPhotoAnalysis,
  CropSuitability,
  FarmerCropLot,
  JobApplication,
  MandiRate,
  Profession,
  UserProfile,
} from '../types/kisan';

const SESSION_TOKEN_KEY = 'kisan_sathi_session_token';
const SAVED_EMAIL_KEY = 'kisan_sathi_saved_email';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getStoredSessionToken(): string | null {
  try {
    return (
      window.localStorage.getItem(SESSION_TOKEN_KEY) ||
      window.sessionStorage.getItem(SESSION_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function persistSessionToken(token: string | undefined, rememberMe = true): void {
  if (!token) return;
  try {
    if (rememberMe) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors in restricted contexts
  }
}

export function clearStoredSessionToken(): void {
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getSavedLoginEmail(): string {
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function setSavedLoginEmail(email: string, remember: boolean): void {
  try {
    if (remember && email.trim()) {
      window.localStorage.setItem(SAVED_EMAIL_KEY, email.trim().toLowerCase());
    } else {
      window.localStorage.removeItem(SAVED_EMAIL_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredSessionToken();
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText);
    let parsedMessage = raw;
    let parsedCode: string | undefined;
    try {
      const json = JSON.parse(raw) as { error?: string; message?: string; code?: string };
      if (json.error) parsedMessage = json.error;
      else if (json.message) parsedMessage = json.message;
      if (json.code) parsedCode = json.code;
    } catch {
      // non-JSON response
    }
    throw new ApiError(parsedMessage || `Request failed (${res.status})`, res.status, parsedCode);
  }
  return (await res.json()) as T;
}

export const kisanApi = {
  getAuthStatus: async (): Promise<AuthStatusResponse> => {
    const status = await request<AuthStatusResponse>('/api/auth/me');
    if (!status.authenticated) {
      clearStoredSessionToken();
    }
    return status;
  },

  signup: async (payload: {
    name: string;
    email: string;
    password: string;
    profession: Profession;
    state: string;
    district: string;
    taluk: string;
    rememberMe?: boolean;
  }): Promise<{ user: UserProfile; token?: string }> => {
    const res = await request<{ user: UserProfile; token?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSessionToken(res.token, payload.rememberMe !== false);
    setSavedLoginEmail(payload.email, payload.rememberMe !== false);
    return res;
  },

  login: async (payload: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<{ user: UserProfile; token?: string }> => {
    const res = await request<{ user: UserProfile; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSessionToken(res.token, payload.rememberMe !== false);
    setSavedLoginEmail(payload.email, payload.rememberMe !== false);
    return res;
  },

  googleSignIn: async (payload: {
    idToken: string;
    profession?: Profession;
    rememberMe?: boolean;
  }): Promise<{ user: UserProfile; token?: string }> => {
    const res = await request<{ user: UserProfile; token?: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    persistSessionToken(res.token, payload.rememberMe !== false);
    if (res.user.email) {
      setSavedLoginEmail(res.user.email, payload.rememberMe !== false);
    }
    return res;
  },

  logout: async (): Promise<{ ok: boolean }> => {
    try {
      return await request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      clearStoredSessionToken();
    }
  },

  getProfile: () => request<UserProfile>('/api/profile'),

  saveProfile: (payload: Partial<UserProfile>) =>
    request<UserProfile>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getJobs: (params?: { q?: string; village?: string; urgent?: boolean; sort?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.village) search.set('village', params.village);
    if (params?.urgent) search.set('urgent', 'true');
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return request<AgriculturalJob[]>(`/api/jobs${qs ? `?${qs}` : ''}`);
  },

  createJob: (payload: Partial<AgriculturalJob>) =>
    request<AgriculturalJob>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateJobWorkers: (jobId: string, action: 'assign' | 'unassign', gender: 'male' | 'female') =>
    request<AgriculturalJob>(`/api/jobs/${jobId}/workers`, {
      method: 'PATCH',
      body: JSON.stringify({ action, gender }),
    }),

  getCrops: (params?: { q?: string; category?: string; village?: string; sort?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.category) search.set('category', params.category);
    if (params?.village) search.set('village', params.village);
    if (params?.sort) search.set('sort', params.sort);
    const qs = search.toString();
    return request<FarmerCropLot[]>(`/api/crops${qs ? `?${qs}` : ''}`);
  },

  createCrop: (payload: Partial<FarmerCropLot>) =>
    request<FarmerCropLot>('/api/crops', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCrop: (id: string, payload: { cropName: string }) =>
    request<FarmerCropLot>(`/api/crops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getApplications: () => request<JobApplication[]>('/api/applications'),

  applyToJob: (payload: {
    jobId: string;
    workName: string;
    farmerName: string;
    village: string;
    wagePerDay: number;
    phone: string;
    applicantName: string;
  }) =>
    request<JobApplication>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteApplication: (id: string) =>
    request<{ ok: boolean }>(`/api/applications/${id}`, {
      method: 'DELETE',
    }),

  getOffers: () => request<CropOffer[]>('/api/offers'),

  createOffer: (payload: {
    cropId: string;
    cropName: string;
    farmerName: string;
    buyerName: string;
    buyerPhone: string;
    offeredPricePerUnit: number;
    quantity: number;
    unitShort: string;
    message?: string;
  }) =>
    request<CropOffer>('/api/offers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getExperts: (params?: { q?: string; specialization?: string }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.specialization && params.specialization !== 'all') {
      search.set('specialization', params.specialization);
    }
    const qs = search.toString();
    return request<AgriExpert[]>(`/api/experts${qs ? `?${qs}` : ''}`);
  },

  getMandiRates: () => request<MandiRate[]>('/api/mandi-rates'),

  checkSuitability: (params: { state: string; district: string; taluk: string; crop: string }) => {
    const search = new URLSearchParams(params);
    return request<CropSuitability>(`/api/suitability?${search.toString()}`);
  },

  analyzeCropPhoto: (payload: { imageBase64: string; mimeType: string; notes?: string }) =>
    request<CropPhotoAnalysis>('/api/crop-analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCalculatorCrops: () => request<CalculatorCrop[]>('/api/calculator-crops'),

  addCalculatorCrop: (payload: Omit<CalculatorCrop, 'id' | 'totalAmount'>) =>
    request<CalculatorCrop>('/api/calculator-crops', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCalculatorCrop: (id: string) =>
    request<{ ok: boolean }>(`/api/calculator-crops/${id}`, {
      method: 'DELETE',
    }),
};
