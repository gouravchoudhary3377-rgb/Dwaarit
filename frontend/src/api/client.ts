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
  put: <T>(path: string, body?: any, token?: string | null) =>
    request<T>(path, { method: 'PUT', body, token }),
  patch: <T>(path: string, body?: any, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),
  del: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'DELETE', token }),
};

// Re-export shared TS types so existing imports keep working.
export type {
  AuthUser,
  AuthResponse,
  Role,
  Product,
  ProductVariant,
  Category,
  OrderItem,
  Order,
  OrderDriverLocation,
  Invoice,
  WishlistItem,
  WishlistProduct,
  WalletTxn,
  WalletSummary,
  ServerAddress,
  ServerAddressIn,
  SavedAddressApi,
  AuditLogEntry,
  LoginHistoryEntry,
} from './types';
