// Address book + current delivery address. Persisted via AsyncStorage helper.
import { create } from 'zustand';
import { storage } from '@/src/utils/storage';

const ADDR_KEY = 'dwaarit.addresses.v1';
const ACTIVE_KEY = 'dwaarit.address.active.v1';

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
};

type AddressState = {
  addresses: SavedAddress[];
  activeId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (address: SavedAddress) => void;
  remove: (id: string) => void;
  setActive: (id: string) => void;
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

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  activeId: null,
  hydrated: false,
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
  upsert: (addr) => {
    const list = [...get().addresses];
    const idx = list.findIndex((a) => a.id === addr.id);
    if (idx >= 0) list[idx] = addr;
    else list.unshift(addr);
    const activeId = get().activeId ?? addr.id;
    set({ addresses: list, activeId });
    persist(list, activeId);
  },
  remove: (id) => {
    const list = get().addresses.filter((a) => a.id !== id);
    let activeId = get().activeId;
    if (activeId === id) activeId = list[0]?.id ?? null;
    set({ addresses: list, activeId });
    persist(list, activeId);
  },
  setActive: (id) => {
    if (!get().addresses.some((a) => a.id === id)) return;
    set({ activeId: id });
    persist(get().addresses, id);
  },
  getActive: () => {
    const { addresses, activeId } = get();
    if (!activeId) return null;
    return addresses.find((a) => a.id === activeId) ?? null;
  },
  clear: () => {
    set({ addresses: [], activeId: null });
    persist([], null);
  },
}));
