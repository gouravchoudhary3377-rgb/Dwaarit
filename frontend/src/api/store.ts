// Store Manager API helpers — calls /api/store/*
import { api } from './client';

export type StoreSummary = {
  store_id: string;
  name: string;
  city?: string;
  manager_id?: string | null;
  is_active?: boolean;
};

export type StoreMe = {
  manager: {
    user_id: string;
    email: string;
    name: string;
    role: string;
    picture?: string | null;
    mobile?: string | null;
  };
  store: StoreSummary | null;
};

export type StoreDashboard = {
  store: StoreSummary;
  orders: {
    pending: number;
    in_progress: number;
    delivered_today: number;
    delivered_week: number;
  };
  revenue_today: number;
  drivers: { total: number; online: number };
  inventory: { low_stock: number; out_of_stock: number };
};

export type StoreOrder = {
  order_id: string;
  status: string;
  total: number;
  payable?: number;
  payment_method?: string;
  items: { name: string; quantity: number; price?: number }[];
  address: {
    full_name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    pincode: string;
  };
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_status?: string | null;
  store_id?: string | null;
  created_at: string;
  updated_at?: string;
};

export type StoreDriver = {
  driver_id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  status: string;
  online?: boolean;
  deliveries?: number;
  earnings?: number;
  store_id?: string | null;
};

export type StoreProduct = {
  product_id: string;
  name: string;
  price: number;
  mrp?: number;
  unit?: string;
  category?: string;
  stock: number;
  image?: string;
};

export const StoreApi = {
  me: (token: string) => api.get<StoreMe>('/store/me', token),
  dashboard: (token: string) => api.get<StoreDashboard>('/store/dashboard', token),
  listOrders: (token: string, status?: string) =>
    api.get<StoreOrder[]>(`/store/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, token),
  getOrder: (token: string, id: string) => api.get<StoreOrder>(`/store/orders/${id}`, token),
  acceptOrder: (token: string, id: string) =>
    api.post<{ ok: boolean; status: string }>(`/store/orders/${id}/accept`, {}, token),
  setStatus: (token: string, id: string, status: string) =>
    api.post<{ ok: boolean; status: string }>(`/store/orders/${id}/status`, { status }, token),
  assignRider: (token: string, id: string, driver_id: string) =>
    api.post<{ ok: boolean }>(`/store/orders/${id}/assign-rider`, { driver_id }, token),
  listDrivers: (token: string, status?: string) =>
    api.get<StoreDriver[]>(`/store/drivers${status ? `?status=${encodeURIComponent(status)}` : ''}`, token),
  listProducts: (token: string, q?: string, lowStock?: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (lowStock) params.set('low_stock', 'true');
    const qs = params.toString();
    return api.get<StoreProduct[]>(`/store/products${qs ? `?${qs}` : ''}`, token);
  },
  updateStock: (token: string, productId: string, stock: number) =>
    api.patch<{ ok: boolean; stock: number }>(`/store/products/${productId}/stock`, { stock }, token),
};
