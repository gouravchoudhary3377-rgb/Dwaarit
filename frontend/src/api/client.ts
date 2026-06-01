// Thin REST client for the Dwaarit FastAPI backend.
import Constants from 'expo-constants';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Constants?.expoConfig?.extra as any)?.EXPO_PUBLIC_BACKEND_URL ||
  '';

export const API_BASE = `${BACKEND_URL.replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: any; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(typeof msg === 'string' ? msg : 'Request failed', res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { token }),
  post: <T>(path: string, body?: any, token?: string | null) =>
    request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: any, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),
  del: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'DELETE', token }),
};

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  auth_provider: 'password' | 'google';
  picture?: string | null;
};

export type AuthResponse = { token: string; user: AuthUser };

export type Product = {
  product_id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image_url: string;
  stock: number;
};

export type Category = {
  slug: string;
  name: string;
  icon: string;
  gallery: string[];
  is_default: boolean;
  created_at?: string;
};

export type OrderItem = {
  product_id: string;
  name: string;
  image_url: string;
  unit: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export type Order = {
  order_id: string;
  user_id: string;
  user_email: string;
  items: OrderItem[];
  total: number;
  address: {
    full_name: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    pincode: string;
  };
  payment_method: 'cod' | 'card';
  notes: string;
  status: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
};
