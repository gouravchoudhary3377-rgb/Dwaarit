/**
 * Centralized TypeScript types for the Flynkit API.
 *
 * NOTE: client.ts and profile.ts re-export from here for backward compatibility.
 * New code should import directly from '@/src/api/types'.
 */

// ---------- Auth ----------
export type Role =
  | 'customer'
  | 'admin'
  | 'super_admin'
  | 'store_manager'
  | 'rider';

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  auth_provider: 'password' | 'google';
  picture?: string | null;
  mobile?: string | null;
  mobile_verified?: boolean;
  // Security additions (Phase 8.6)
  two_factor_enabled?: boolean;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
  /** Present when the account requires a second factor before issuing the
   * final session token. The client should call /auth/2fa/verify with this. */
  two_factor_required?: boolean;
  challenge_id?: string;
};

// ---------- Products & catalog ----------
export type Product = {
  product_id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  image_url: string;
  stock: number;
  // Optional Blinkit-style enhancements:
  mrp?: number | null;
  selling_price?: number | null;
  self_price?: number | null;
  discount_percent?: number | null;
  variants?: ProductVariant[];
  rating?: number | null;
  rating_count?: number | null;
  delivery_eta_min?: number | null;
};

export type ProductVariant = {
  variant_id: string;
  name: string; // e.g. "500g", "1kg"
  unit?: string;
  price: number;
  mrp?: number | null;
  stock: number;
  is_default?: boolean;
};

export type Category = {
  slug: string;
  name: string;
  icon: string;
  gallery: string[];
  is_default: boolean;
  created_at?: string;
};

// ---------- Wishlist ----------
export type WishlistItem = Product & { added_at?: string };
export type WishlistProduct = WishlistItem;

// ---------- Wallet ----------
export type WalletTxn = {
  txn_id: string;
  user_id: string;
  type: 'credit' | 'debit' | 'refund' | 'topup';
  amount: number;
  note?: string;
  created_at: string;
};

export type WalletSummary = {
  balance: number;
  transactions: WalletTxn[];
};

// ---------- Addresses ----------
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

export type ServerAddressIn = Omit<
  ServerAddress,
  'address_id' | 'user_id' | 'created_at'
> & {
  custom_label?: string;
};

// Backwards-compat alias used by some screens.
export type SavedAddressApi = ServerAddress;

// ---------- Orders ----------
export type OrderItem = {
  product_id: string;
  name: string;
  image_url: string;
  unit: string;
  price: number;
  mrp?: number | null;
  selling_price?: number | null;
  self_price?: number | null;
  quantity: number;
  subtotal: number;
};

export type Order = {
  order_id: string;
  user_id: string;
  user_email: string;
  items: OrderItem[];
  subtotal?: number;
  delivery_fee?: number;
  handling_fee?: number;
  wallet_applied?: number;
  payable?: number;
  total: number;
  address: {
    full_name: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    pincode: string;
  };
  payment_method: 'cod' | 'card' | 'wallet' | 'razorpay';
  payment_status?: 'pending' | 'paid' | 'cod' | 'failed';
  notes: string;
  status: 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_otp?: string | null;
  created_at: string;
  updated_at: string;
  // Set after a rider is assigned to the order
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_vehicle?: string | null;
  driver_status?: string | null;
  assigned_at?: string | null;
};

// ---------- Chat ----------
export type ChatMessage = {
  message_id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
};

export type OrderDriverLocation =
  | { assigned: false }
  | {
      assigned: true;
      driver: {
        driver_id: string;
        name?: string | null;
        phone?: string | null;
        vehicle?: string | null;
      };
      location: {
        lat?: number | null;
        lng?: number | null;
        updated_at?: string | null;
      };
    };

export type Invoice = {
  invoice_no: string;
  order_id: string;
  date: string;
  customer: { name: string; email: string };
  address: Order['address'];
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  wallet_applied: number;
  payable: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
};

// ---------- Security / Phase 8.6 ----------
export type AuditLogEntry = {
  log_id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string; // e.g. "user.delete", "order.update"
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type LoginHistoryEntry = {
  entry_id: string;
  user_id: string;
  email?: string | null;
  success: boolean;
  reason?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  device_label?: string | null;
  created_at: string;
};
