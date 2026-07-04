/**
 * useNearestStore — resolves the nearest Flynkit store for a given lat/lng.
 * Call this whenever the customer's delivery address changes.
 */
import { useCallback } from 'react';
import { api } from '@/src/api/client';
import { useActiveStore, type ActiveStore } from '@/src/store/activeStoreStore';

export function useNearestStore() {
  const { setStore, setNoDelivery } = useActiveStore();

  const resolve = useCallback(
    async (lat: number, lng: number): Promise<ActiveStore | null> => {
      try {
        const store = await api.get<ActiveStore>(
          `/stores/nearest?lat=${lat}&lng=${lng}`,
          null,
        );
        setStore(store);
        return store;
      } catch (err: any) {
        if (err?.status === 404 || err?.statusCode === 404) {
          setNoDelivery(true);
        }
        return null;
      }
    },
    [setStore, setNoDelivery],
  );

  return { resolve };
}
