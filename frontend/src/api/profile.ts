// Profile, wallet, wishlist API helpers.
import { api } from './client';

export type WalletTxn = {
  txn_id: string;
  user_id: string;
  type: 'credit' | 'debit' | 'refund' | 'topup';
  amount: number;
  note?: string;
  created_at: string;
};

export type WalletSummary = { balance: number; transactions: WalletTxn[] };

export type WishlistItem = {
  product_id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image_url: string;
  stock: number;
  added_at?: string;
};

export type ServerAddress = {
  address_id: string;
  user_id: string;
  label: 'home' | 'work' | 'other';
  custom_label?: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  pincode: string;
  state: string;
  lat?: number | null;
  lng?: number | null;
  is_default: boolean;
  created_at: string;
};

export type ServerAddressIn = Omit<ServerAddress, 'address_id' | 'user_id' | 'created_at'> & {
  custom_label?: string; // not persisted server-side but we keep client copy
};

export const profileApi = {
  // Profile
  update: (token: string, body: { name?: string; picture?: string }) =>
    api.put<any>('/profile/me', body, token),
  sendMobileOtp: (token: string, mobile: string) =>
    api.post<{ ok: boolean; expires_in: number; dev_otp?: string }>(
      '/profile/mobile/send-otp',
      { mobile },
      token,
    ),
  verifyMobileOtp: (token: string, mobile: string, otp: string) =>
    api.post<any>('/profile/mobile/verify-otp', { mobile, otp }, token),

  // Wallet
  walletSummary: (token: string) => api.get<WalletSummary>('/wallet', token),
  walletTopup: (token: string, amount: number, note?: string) =>
    api.post<{ ok: boolean; balance: number }>('/wallet/topup', { amount, note: note || '' }, token),

  // Wishlist
  wishlist: (token: string) => api.get<WishlistItem[]>('/wishlist', token),
  wishlistAdd: (token: string, product_id: string) =>
    api.post<{ ok: boolean }>('/wishlist', { product_id }, token),
  wishlistRemove: (token: string, product_id: string) =>
    api.del<{ ok: boolean }>(`/wishlist/${product_id}`, token),

  // Addresses
  listAddresses: (token: string) => api.get<ServerAddress[]>('/addresses', token),
  createAddress: (token: string, body: ServerAddressIn) =>
    api.post<ServerAddress>('/addresses', body, token),
  updateAddress: (token: string, address_id: string, body: ServerAddressIn) =>
    api.put<ServerAddress>(`/addresses/${address_id}`, body, token),
  deleteAddress: (token: string, address_id: string) =>
    api.del<{ ok: boolean }>(`/addresses/${address_id}`, token),
  defaultAddress: (token: string, address_id: string) =>
    api.post<ServerAddress>(`/addresses/${address_id}/default`, {}, token),
};
