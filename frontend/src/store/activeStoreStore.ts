/**
 * Active Store — Zustand store persisted to AsyncStorage.
 * The "active store" is the Flynkit dark store that serves
 * the customer's current delivery address.
 */
import { create } from 'zustand';
import { storage } from '@/src/utils/storage';

const STORE_KEY = 'flynkit.active_store.v1';

export type ActiveStore = {
  store_id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  delivery_radius_km: number;
  open_time?: string;
  close_time?: string;
  distance_km?: number;
};

type ActiveStoreState = {
  store: ActiveStore | null;
  noDelivery: boolean;   // true when address has no covering store
  hydrated: boolean;

  setStore: (s: ActiveStore) => void;
  setNoDelivery: (v: boolean) => void;
  clearStore: () => void;
  hydrate: () => Promise<void>;
};

export const useActiveStore = create<ActiveStoreState>((set) => ({
  store: null,
  noDelivery: false,
  hydrated: false,

  setStore: (s) => {
    set({ store: s, noDelivery: false });
    storage.setItem(STORE_KEY, JSON.stringify(s));
  },

  setNoDelivery: (v) => set({ noDelivery: v, store: null }),

  clearStore: () => {
    set({ store: null, noDelivery: false });
    storage.removeItem(STORE_KEY);
  },

  hydrate: async () => {
    try {
      const raw = await storage.getItem<string>(STORE_KEY, '');
      const parsed = raw ? (JSON.parse(raw) as ActiveStore) : null;
      set({ store: parsed, hydrated: true });
    } catch {
      set({ store: null, hydrated: true });
    }
  },
}));
