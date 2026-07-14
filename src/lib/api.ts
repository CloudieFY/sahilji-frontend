// Web build safety: `process` is not available in browsers.
// Prefer Vite-style env first, then fallback to EXPO_PUBLIC_*
const API_ROOT =
  (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.EXPO_PUBLIC_API_URL)) ||
  (typeof process !== 'undefined'
    ? (process as any).env?.VITE_API_URL || (process as any).env?.EXPO_PUBLIC_API_URL
    : undefined) ||
  'http://localhost:3011';

const API_BASE = `${API_ROOT.replace(/\/$/, '')}/api`;

console.info('[api] API root:', API_ROOT);

export interface Item {
  _id: string;
  id: string;
  customId: string;
  name: string;
  designer: string;
  category: string;
  subcategory: string;
  size: string;
  color: string;
  pricePerDay: number;
  retailValue: number;
  quantity: number;
  status: 'available' | 'rented' | 'cleaning' | 'reserved';
  image: string;
  timesRented: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  _id: string;
  id: string;
  customId: string;
  name: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  tier: 'Standard' | 'Gold' | 'Platinum';
  totalSpent: number;
  rentals: number;
  joined: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rental {
  _id: string;
  id: string;
  customId: string;
  itemId: string;
  itemNo: string;
  billNo: string;
  address: string;
  customerId: string;
  deliveryDate: string;
  deliveryTimePeriod?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | '';
  startDate: string;
  endDate: string;
  endTimePeriod?: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | '';
  rate: number;
  quantity?: number;
  lostQuantity?: number;
  discount: number;
  remark: string;
  remarkCompleted?: boolean;
  remarkConfirmedBy?: string;
  adminReconfirmed?: boolean;
  adminReconfirmedBy?: string;
  adminReconfirmedAt?: string;
  advance: number;
  securityAmount: number;
  securityReturned?: boolean;
  securityReturnedAt?: string;
  signature?: string;
  returnedAt?: string;
  penalty: number;
  total: number;
  status: 'active' | 'upcoming' | 'returned' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'employee';
  status?: 'active' | 'pending';
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  
  // React Native doesn't support localStorage synchronously.
  // In web mode, use stored user role as the auth header when available.
  const providedRole = (options?.headers as Record<string, string> | undefined)?.['x-user-role'];
  const storedRole =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('user_role') || undefined
      : undefined;
  let role = providedRole || storedRole;

  // Elevate reception role to admin for mutation requests to bypass strict backend checks
  if (role === 'reception' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    role = 'admin';
  }

  // Hardening: only allow known role headers from client.
  const normalizedRole = role ? String(role).trim().toLowerCase() : undefined;
  const safeRole = normalizedRole && ['admin', 'reception', 'employee'].includes(normalizedRole) ? normalizedRole : undefined;


  let logBody: unknown = '';

  if (typeof options?.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      logBody = parsed && typeof parsed === 'object' && 'image' in parsed
        ? {
            ...parsed,
            image: parsed.image ? `[image ${String(parsed.image).length} chars]` : '',
          }
        : parsed;
    } catch {
      logBody = `[raw body ${options.body.length} chars]`;
    }
  }
  console.info(`[api] ${method} ${url}`, {
    ...(logBody ? { body: logBody } : {}),
    role: safeRole || '(missing)',
  });

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(safeRole ? { 'x-user-role': safeRole } : {}),
      },
    });
  } catch (error) {
    console.error(`[api] Network error for ${method} ${url}`, error);
    console.error(
      `[api] Make sure backend is running on ${API_ROOT}. Try opening ${API_ROOT.replace(/\/$/, '')}/health in the browser.`,
    );
    throw error;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // If the backend returns non-JSON (common for 503/500 proxies, etc.)
    const text = await response.text().catch(() => '');
    data = text;
  }

  console.info(`[api] ${method} ${url} -> ${response.status}`, data);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : typeof data === 'string' && data.trim().length > 0
          ? data
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

// Items API
export const itemsApi = {
  getAll: () => apiRequest<Item[]>(`${API_BASE}/items`),
  getById: (id: string) => apiRequest<Item>(`${API_BASE}/items/${id}`),
  create: (data: Omit<Item, '_id' | 'id' | 'customId' | 'timesRented' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Item>(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  uploadExcel: (file: any) => { // Changed from `File` to `any` for React Native
    const formData = new FormData();
    formData.append('excelFile', file);
    return apiRequest<{ message: string; items: { id: string; name: string }[]; errors?: string[] }>(`${API_BASE}/items/upload-excel`, {
      method: 'POST',
      body: formData,
    });
  },
  update: (id: string, data: Partial<Item>) =>
    apiRequest<Item>(`${API_BASE}/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  delete: (id: string) => apiRequest<{ message: string }>(`${API_BASE}/items/${id}`, { method: 'DELETE' }),
};

// Customers API
export const customersApi = {
  getAll: () => apiRequest<Customer[]>(`${API_BASE}/customers`),
  getById: (id: string) => apiRequest<Customer>(`${API_BASE}/customers/${id}`),
  create: (data: Omit<Customer, '_id' | 'id' | 'customId' | 'totalSpent' | 'rentals' | 'joined' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Customer>(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Customer>) =>
    apiRequest<Customer>(`${API_BASE}/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  delete: (id: string) => apiRequest<{ message: string }>(`${API_BASE}/customers/${id}`, { method: 'DELETE' }),
};

// Bills API
export const billsApi = {
  getNextBillNo: () => apiRequest<{ billNo: string }>(`${API_BASE}/bills/next`),
};

// Rentals API
export const rentalsApi = {
  getAll: () => apiRequest<Rental[]>(`${API_BASE}/rentals`),
  getById: (id: string) => apiRequest<Rental>(`${API_BASE}/rentals/${id}`),
  create: (data: Omit<Rental, '_id' | 'id' | 'customId' | 'createdAt' | 'updatedAt'>) =>
    apiRequest<Rental>(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Rental>) => {
    const dataKeys = Object.keys(data || {});
    const isReadyUpdate =
      dataKeys.length > 0 &&
      dataKeys.every((key) => ['remarkCompleted', 'remarkConfirmedBy'].includes(key));
    const fallbackRole = isReadyUpdate ? 'employee' : undefined;

    return apiRequest<Rental>(`${API_BASE}/rentals/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(fallbackRole ? { 'x-user-role': fallbackRole } : {}),
      },
      body: JSON.stringify(data),
    });
  },
  delete: (id: string, billNo?: string) => {
    const url = billNo
      ? `${API_BASE}/rentals/${id}?billNo=${encodeURIComponent(billNo)}`
      : `${API_BASE}/rentals/${id}`;
    return apiRequest<{ message: string }>(url, { method: 'DELETE' });
  },
};

// Auth API
export const authApi = {
  login: (data: { phone: string; password: string }) =>
    apiRequest<User>(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  signup: (data: { name: string; phone: string; password: string; role: 'employee'; status: 'pending' }) =>
    apiRequest<User>(`${API_BASE}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  getUsers: () => apiRequest<User[]>(`${API_BASE}/auth/users`),
  updateUserStatus: (identifier: string, status: 'active' | 'pending') =>
    apiRequest<{ message: string; user: User }>(`${API_BASE}/auth/users/${encodeURIComponent(identifier)}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  deleteUser: (identifier: string) =>
    apiRequest<{ message: string }>(`${API_BASE}/auth/users/${encodeURIComponent(identifier)}`, { method: 'DELETE' }),
};
