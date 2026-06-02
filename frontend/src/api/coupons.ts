import { api } from './client';
import type { Coupon, CouponValidateResult } from './types';

export const couponsApi = {
  /** Public list of active coupons (for promo banners). */
  listActive: (token?: string | null) =>
    api.get<Coupon[]>('/coupons', token),

  /** Validate a code against current cart subtotal. Throws ApiError on invalid. */
  validate: (token: string, code: string, subtotal: number) =>
    api.post<CouponValidateResult>(
      '/coupons/validate',
      { code: code.trim().toUpperCase(), subtotal },
      token,
    ),

  // ----- Admin -----
  adminList: (token: string) => api.get<Coupon[]>('/admin/coupons', token),
  adminCreate: (token: string, body: Partial<Coupon>) =>
    api.post<Coupon>('/admin/coupons', body, token),
  adminUpdate: (token: string, code: string, body: Partial<Coupon>) =>
    api.patch<Coupon>(`/admin/coupons/${encodeURIComponent(code)}`, body, token),
  adminDelete: (token: string, code: string) =>
    api.del<{ ok: boolean }>(`/admin/coupons/${encodeURIComponent(code)}`, token),
};
