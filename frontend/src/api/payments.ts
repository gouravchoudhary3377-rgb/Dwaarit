// Payments API client. Supports both real Razorpay and a mock fallback when
// no keys are configured on the backend.
import { api } from './client';

export type PaymentsConfig = {
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  currency: string;
};

export type CreateOrderResponse = {
  mode: 'live' | 'mock';
  key_id: string;
  razorpay_order_id: string;
  amount: number; // paise
  currency: string;
};

export type VerifyOrderResponse = { ok: boolean; verified: boolean };
export type VerifyWalletResponse = {
  ok: boolean;
  balance: number;
  verified?: boolean;
  duplicate?: boolean;
};

export type SavedPaymentMethod = {
  method_id: string;
  user_id: string;
  kind: 'card' | 'upi';
  label: string;
  last4?: string | null;
  brand?: string | null;
  vpa?: string | null;
  token: string;
  created_at: string;
};

export const paymentsApi = {
  config: () => api.get<PaymentsConfig>('/payments/config'),

  createOrder: (token: string, amount: number, order_id?: string) =>
    api.post<CreateOrderResponse>(
      '/payments/razorpay/create-order',
      { amount, order_id },
      token,
    ),

  verifyOrder: (
    token: string,
    body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      order_id?: string;
    },
  ) => api.post<VerifyOrderResponse>('/payments/razorpay/verify', body, token),

  verifyWalletTopup: (
    token: string,
    body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      amount: number;
    },
  ) => api.post<VerifyWalletResponse>('/wallet/razorpay/verify', body, token),

  // Saved payment methods (tokens only)
  listMethods: (token: string) => api.get<SavedPaymentMethod[]>('/payments/methods', token),
  addMethod: (
    token: string,
    body: {
      kind: 'card' | 'upi';
      label?: string;
      last4?: string;
      brand?: string;
      vpa?: string;
      token?: string;
    },
  ) => api.post<SavedPaymentMethod>('/payments/methods', body, token),
  deleteMethod: (token: string, method_id: string) =>
    api.del<{ ok: boolean }>(`/payments/methods/${method_id}`, token),
};
