// Address book + current delivery address.
// Server-first when authenticated, with AsyncStorage cache for offline/anon use.
import { create } from 'zustand';
import { storage } from '@/src/utils/storage';
import { profileApi, ServerAddress, ServerAddressIn } from '@/src/api/profile';

const ADDR_KEY = 'dwaarit.addresses.v1';
const ACTIVE_KEY = 'dwaarit.address.active.v1';
const CUSTOM_KEY = 'dwaarit.addresses.customlabels.v1';

export type AddressLabel = 'Home' | 'Work' | 'Other';

export type SavedAddress = {
  id: string;
  label: AddressLabel;
  custom_label?: string; // Used when label === 'Other'
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  lat?: number;
  lng?: number;
  display_name?: string;
  is_default?: boolean;
};

type AddressState = {
  addresses: SavedAddress[];
  activeId: string | null;
  hydrated: boolean;
  loading: boolean;
  _token: string | null;
  setAuthToken: (token: string | null) => void;
  hydrate: () => Promise<void>;
  loadFromServer: () => Promise<void>;
  upsert: (address: SavedAddress) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  getActive: () => SavedAddress | null;
  clear: () => void;
};

async function persist(addresses: SavedAddress[], activeId: string | null) {
  await Promise.all([
    storage.setItem(ADDR_KEY, JSON.stringify(addresses)),
    storage.setItem(ACTIVE_KEY, activeId ?? ''),
  ]);
}

export function makeAddressId(): string {
  return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function displayLabel(addr: SavedAddress): string {
  if (addr.label === 'Other' && addr.custom_label) return addr.custom_label;
  return addr.label;
}

export function shortAddress(addr: SavedAddress): string {
  const parts = [addr.line1, addr.line2, addr.city].filter(Boolean);
  return parts.join(', ');
}

/* ---------------- Server <-> client mapping ---------------- */
const LABEL_TO_SERVER: Record<AddressLabel, ServerAddress['label']> = {
  Home: 'home',
  Work: 'work',
  Other: 'other',
};
const LABEL_FROM_SERVER: Record<ServerAddress['label'], AddressLabel> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
};

function toServerIn(addr: SavedAddress): ServerAddressIn {
  return {
    label: LABEL_TO_SERVER[addr.label],
    custom_label: addr.custom_label || '',
    full_name: addr.full_name,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2 || '',
    landmark: '',
    city: addr.city,
    pincode: addr.pincode,
    state: '',
    lat: addr.lat ?? null,
    lng: addr.lng ?? null,
    is_default: !!addr.is_default,
  };
}

function fromServer(s: ServerAddress, displayMap?: Record<string, string>): SavedAddress {
  return {
    id: s.address_id,
    label: LABEL_FROM_SERVER[s.label] ?? 'Other',
    custom_label: s.custom_label || undefined,
    full_name: s.full_name,
    phone: s.phone,
    line1: s.line1,
    line2: s.line2 || '',
    city: s.city,
    pincode: s.pincode,
    lat: s.lat ?? undefined,
    lng: s.lng ?? undefined,
    display_name: displayMap?.[s.address_id],
    is_default: s.is_default,
  };
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  activeId: null,
  hydrated: false,
  loading: false,
  _token: null,

  setAuthToken: (token) => {
    const prev = get()._token;
    set({ _token: token });
    if (token && token !== prev) {
      // Load fresh from server on login
      void get().loadFromServer();
    }
    if (!token && prev) {
      // Logged out — keep local cache, clear active for safety
      set({ addresses: [], activeId: null });
      void persist([], null);
    }
  },

  hydrate: async () => {
    const [raw, activeRaw] = await Promise.all([
      storage.getItem<string>(ADDR_KEY, ''),
      storage.getItem<string>(ACTIVE_KEY, ''),
    ]);
    let list: SavedAddress[] = [];
    try {
      list = raw ? (JSON.parse(raw) as SavedAddress[]) : [];
    } catch {
      list = [];
    }
    const activeId =
      activeRaw && list.some((a) => a.id === activeRaw)
        ? activeRaw
        : list[0]?.id ?? null;
    set({ addresses: list, activeId, hydrated: true });
  },

  loadFromServer: async () => {
    const token = get()._token;
    if (!token) return;
    set({ loading: true });
    try {
      // Read display_name overrides from local cache (server doesn't persist these)
      const rawCustom = await storage.getItem<string>(CUSTOM_KEY, '');
      let displayMap: Record<string, string> = {};
      try {
        displayMap = rawCustom ? JSON.parse(rawCustom) : {};
      } catch {
        displayMap = {};
      }
      const docs = await profileApi.listAddresses(token);
      const list = docs.map((d) => fromServer(d, displayMap));
      // Choose default as active, otherwise first
      const def = list.find((a) => a.is_default);
      const activeId = def?.id ?? list[0]?.id ?? null;
      set({ addresses: list, activeId, hydrated: true });
      await persist(list, activeId);
    } catch {
      // network/auth error — keep local cache
    } finally {
      set({ loading: false });
    }
  },

  upsert: async (addr) => {
    const token = get()._token;

    // Always update local cache for instant UI
    const localList = [...get().addresses];
    const localIdx = localList.findIndex((a) => a.id === addr.id);
    if (localIdx >= 0) localList[localIdx] = addr;
    else localList.unshift(addr);
    const localActive = get().activeId ?? addr.id;
    set({ addresses: localList, activeId: localActive });
    await persist(localList, localActive);

    // Save display_name in side cache (server doesn't store it)
    try {
      const rawCustom = await storage.getItem<string>(CUSTOM_KEY, '');
      const map: Record<string, string> = rawCustom ? JSON.parse(rawCustom) : {};
      if (addr.display_name) map[addr.id] = addr.display_name;
      await storage.setItem(CUSTOM_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }

    if (!token) return;

    try {
      const body = toServerIn(addr);
      // If id looks like a server-issued id, attempt update; otherwise create.
      const isServerId = /^addr_[a-f0-9]{12}$/i.test(addr.id) && localIdx >= 0;
      let saved: ServerAddress;
      if (isServerId) {
        try {
          saved = await profileApi.updateAddress(token, addr.id, body);
        } catch {
          // Server doesn't know this id — create instead
          saved = await profileApi.createAddress(token, body);
        }
      } else {
        saved = await profileApi.createAddress(token, body);
      }
      // Replace temp client id with server id
      const merged: SavedAddress = { ...addr, id: saved.address_id, is_default: saved.is_default };
      const list = get().addresses.map((a) => (a.id === addr.id ? merged : a));
      const activeId = get().activeId === addr.id ? merged.id : get().activeId;
      set({ addresses: list, activeId });
      await persist(list, activeId);

      // Update display_name cache key
      if (addr.display_name && saved.address_id !== addr.id) {
        try {
          const rawCustom = await storage.getItem<string>(CUSTOM_KEY, '');
          const map: Record<string, string> = rawCustom ? JSON.parse(rawCustom) : {};
          map[saved.address_id] = addr.display_name;
          delete map[addr.id];
          await storage.setItem(CUSTOM_KEY, JSON.stringify(map));
        } catch {
          /* ignore */
        }
      }
    } catch {
      // Stay with local-only optimistic write
    }
  },

  remove: async (id) => {
    const list = get().addresses.filter((a) => a.id !== id);
    let activeId = get().activeId;
    if (activeId === id) activeId = list[0]?.id ?? null;
    set({ addresses: list, activeId });
    await persist(list, activeId);

    const token = get()._token;
    if (!token) return;
    try {
      await profileApi.deleteAddress(token, id);
    } catch {
      /* ignore */
    }
  },

  setActive: async (id) => {
    if (!get().addresses.some((a) => a.id === id)) return;
    set({ activeId: id });
    await persist(get().addresses, id);

    const token = get()._token;
    if (!token) return;
    try {
      await profileApi.defaultAddress(token, id);
      const list = get().addresses.map((a) => ({ ...a, is_default: a.id === id }));
      set({ addresses: list });
      await persist(list, id);
    } catch {
      /* ignore */
    }
  },

  getActive: () => {
    const { addresses, activeId } = get();
    if (!activeId) return null;
    return addresses.find((a) => a.id === activeId) ?? null;
  },

  clear: () => {
    set({ addresses: [], activeId: null });
    void persist([], null);
  },
}));
