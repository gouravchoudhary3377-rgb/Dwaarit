import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api, Order } from '@/src/api/client';
import { useSoundPlayer, SoundKey } from './useSoundPlayer';

const POLL_MS = 8000;

/**
 * useOrderAlerts (customer-side)
 * Polls `/orders` every 8 seconds and plays a short alert when any of the
 * caller's orders transitions to `accepted`, `out_for_delivery` or
 * `delivered`. Single-shot per transition — never loops.
 */
export function useOrderAlerts(token: string | null, muted: boolean = false) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const sound = useSoundPlayer(muted);
  const lastStatusRef = useRef<Record<string, Order['status']>>({});
  const firstFetchDoneRef = useRef(false);

  const onTransition = useCallback(
    (next: Order['status']) => {
      let key: SoundKey | null = null;
      if (next === 'accepted') key = 'accepted';
      else if (next === 'delivered') key = 'delivered';
      else if (next === 'out_for_delivery') key = 'accepted'; // re-use the soft chime
      if (key) sound.play(key);
    },
    [sound],
  );

  const fetchOnce = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setRefreshing(true);
      try {
        const list = await api.get<Order[]>('/orders', token);
        // Compare to last snapshot to detect transitions (skip first cold fetch)
        if (firstFetchDoneRef.current) {
          for (const o of list) {
            const prev = lastStatusRef.current[o.order_id];
            if (prev && prev !== o.status) {
              onTransition(o.status);
            }
          }
        }
        for (const o of list) lastStatusRef.current[o.order_id] = o.status;
        firstFetchDoneRef.current = true;
        setOrders(list);
      } catch (e) {
        console.warn('order alerts fetch failed', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, onTransition],
  );

  useEffect(() => {
    if (!token) return;
    fetchOnce({ silent: true });
    const id = setInterval(() => fetchOnce({ silent: true }), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchOnce({ silent: true });
    });
    return () => sub.remove();
  }, [fetchOnce]);

  return { orders, loading, refreshing, refresh: () => fetchOnce() };
}
