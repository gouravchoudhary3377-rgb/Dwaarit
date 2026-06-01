// Address book + current delivery address. Persisted to AsyncStorage.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeocodedAddress } from '@/src/utils/location';

export type AddressLabel = 'Home' | 'Work' | 'Other';

export type SavedAddress = {
  id: string;
  label: AddressLabel;
  full_name?: string;
  phone?: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  short: string;
  full: string;
  coords?: { latitude: number; longitude: number };
  created_at: number;
};

const STORAGE_KEY = 'dwaarit.addressBook.v1';

type Persisted = {
  currentId: string | null;
  current: SavedAddress | null; // can also be a non-saved (auto-detected) address
  saved: SavedAddress[];
};

type AddressState = Persisted & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCurrentFromGeocoded: (g: GeocodedAddress) => SavedAddress;
  selectSaved: (id: string) => void;
  upsertAddress: (input: Omit<SavedAddress, 'id' | 'created_at'> & { id?: string }) => SavedAddress;
  removeAddress: (id: string) => void;
  clear: () => void;
};

function genId() {
  return 'addr_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function persist(state: Persisted) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export const useAddressStore = create<AddressState>((set, get) => ({
  currentId: null,
  current: null,
  saved: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Persisted = JSON.parse(raw);
        set({
          currentId: parsed.currentId ?? null,
          current: parsed.current ?? null,
          saved: Array.isArray(parsed.saved) ? parsed.saved : [],
          hydrated: true,
        });
        return;
      }
    } catch {}
    set({ hydrated: true });
  },

  setCurrentFromGeocoded: (g) => {
    const addr: SavedAddress = {
      id: 'current_' + Date.now().toString(36),
      label: 'Other',
      line1: g.line1 || g.full.split(',')[0] || '',
      line2: g.line2,
      city: g.city,
      state: g.state,
      pincode: g.postcode,
      country: g.country,
      short: g.short,
      full: g.full,
      coords: g.coords,
      created_at: Date.now(),
    };
    set({ current: addr, currentId: null });
    persist({ currentId: null, current: addr, saved: get().saved });
    return addr;
  },

  selectSaved: (id) => {
    const found = get().saved.find((s) => s.id === id);
    if (!found) return;
    set({ current: found, currentId: id });
    persist({ currentId: id, current: found, saved: get().saved });
  },

  upsertAddress: (input) => {
    const existing = input.id ? get().saved.find((s) => s.id === input.id) : null;
    const next: SavedAddress = existing
      ? { ...existing, ...input, id: existing.id }
      : {
          id: genId(),
          created_at: Date.now(),
          ...input,
        } as SavedAddress;
    const saved = existing
      ? get().saved.map((s) => (s.id === next.id ? next : s))
      : [next, ...get().saved];
    set({ saved, current: next, currentId: next.id });
    persist({ currentId: next.id, current: next, saved });
    return next;
  },

  removeAddress: (id) => {
    const saved = get().saved.filter((s) => s.id !== id);
    let current = get().current;
    let currentId = get().currentId;
    if (currentId === id) {
      current = saved[0] ?? null;
      currentId = saved[0]?.id ?? null;
    }
    set({ saved, current, currentId });
    persist({ currentId, current, saved });
  },

  clear: () => {
    set({ saved: [], current: null, currentId: null });
    persist({ saved: [], current: null, currentId: null });
  },
}));
