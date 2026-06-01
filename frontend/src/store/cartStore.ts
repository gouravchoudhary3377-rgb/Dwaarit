import { create } from 'zustand';
import { Product } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

const CART_KEY = 'dwaarit.cart.v1';

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

async function persist(lines: CartLine[]) {
  await storage.setItem(CART_KEY, JSON.stringify(lines));
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  hydrated: false,
  hydrate: async () => {
    const raw = await storage.getItem<string>(CART_KEY, '');
    try {
      const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
      set({ lines: parsed, hydrated: true });
    } catch {
      set({ lines: [], hydrated: true });
    }
  },
  add: (product, qty = 1) => {
    const lines = [...get().lines];
    const idx = lines.findIndex((l) => l.product.product_id === product.product_id);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + qty };
    } else {
      lines.push({ product, quantity: qty });
    }
    set({ lines });
    persist(lines);
  },
  setQty: (productId, qty) => {
    let lines = get().lines.map((l) =>
      l.product.product_id === productId ? { ...l, quantity: qty } : l,
    );
    lines = lines.filter((l) => l.quantity > 0);
    set({ lines });
    persist(lines);
  },
  remove: (productId) => {
    const lines = get().lines.filter((l) => l.product.product_id !== productId);
    set({ lines });
    persist(lines);
  },
  clear: () => {
    set({ lines: [] });
    persist([]);
  },
  count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
  subtotal: () => get().lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
}));
