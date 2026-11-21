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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText);
    let parsedMessage = raw;
    try {
      const json = JSON.parse(raw) as { error?: string; message?: string };
      if (json.error) parsedMessage = json.error;
      else if (json.message) parsedMessage = json.message;
    } catch {
      // non-JSON response
    }
    throw new Error(parsedMessage || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const kisanApi = {
  getAuthStatus: () => request<AuthStatusResponse>('/api/auth/me'),

  signup: (payload: {
    name: string;
    email: string;
    password: string;
    profession: Profession;
    state: string;
    district: string;
    taluk: string;
  }) =>
    request<{ user: UserProfile }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  googleSignIn: (payload: { idToken: string; profession?: Profession }) =>
    request<{ user: UserProfile }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

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
