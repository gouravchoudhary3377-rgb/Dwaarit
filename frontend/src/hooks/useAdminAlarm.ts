import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api, Order } from '@/src/api/client';
import { useSoundPlayer } from './useSoundPlayer';

const POLL_MS = 8000;
const LOOP_MS = 6000;

/**
 * useAdminAlarm
 * - Polls `/admin/orders` every 8 seconds.
 * - Loops the `newOrder` sound continuously while at least one order is in
 *   the `pending` state (until the admin accepts/cancels).
 * - Reacts to mute toggles: silences immediately and resumes when un-muted.
 * - Resyncs immediately when the app returns to foreground.
 */
export function useAdminAlarm(token: string | null, muted: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [latestNewOrderId, setLatestNewOrderId] = useState<string | null>(null);

  const sound = useSoundPlayer(muted);
  const isLoopingRef = useRef(false);
  const mutedRef = useRef(muted);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const ordersRef = useRef<Order[]>([]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const evaluateAlarm = useCallback(
    (list: Order[]) => {
      const hasPending = list.some((o) => o.status === 'pending');
      if (hasPending && !isLoopingRef.current && !mutedRef.current) {
        isLoopingRef.current = true;
        sound.startLoop('newOrder', LOOP_MS);
      } else if (!hasPending && isLoopingRef.current) {
        isLoopingRef.current = false;
        sound.stopLoop();
      }
    },
    [sound],
  );

  const fetchOnce = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setRefreshing(true);
      try {
        const list = await api.get<Order[]>('/admin/orders', token);

        // detect brand-new pending order arrivals (for the "ping" highlight)
        const incomingPending = list.filter((o) => o.status === 'pending');
        const freshlyArrived = incomingPending.find(
          (o) => !knownIdsRef.current.has(o.order_id),
        );
        if (freshlyArrived) {
          setLatestNewOrderId(freshlyArrived.order_id);
        }
        list.forEach((o) => knownIdsRef.current.add(o.order_id));

        setOrders(list);
        ordersRef.current = list;
        setLastFetchAt(new Date());
        evaluateAlarm(list);
      } catch (e) {
        // surfaced via console only — UI shows stale data gracefully
        console.warn('admin alarm fetch failed', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, evaluateAlarm],
  );

  // Poll loop
  useEffect(() => {
    if (!token) return;
    fetchOnce({ silent: true });
    const id = setInterval(() => fetchOnce({ silent: true }), POLL_MS);
    return () => {
      clearInterval(id);
      sound.stopLoop();
      isLoopingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // React to mute toggle
  useEffect(() => {
    if (muted) {
      sound.stopLoop();
      isLoopingRef.current = false;
    } else {
      evaluateAlarm(ordersRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // Foreground sync
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchOnce({ silent: true });
    });
    return () => sub.remove();
  }, [fetchOnce]);

  const setLocalOrder = useCallback((updated: Order) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.order_id === updated.order_id ? updated : o));
      ordersRef.current = next;
      evaluateAlarm(next);
      return next;
    });
  }, [evaluateAlarm]);

  const clearNewOrderHighlight = useCallback(() => setLatestNewOrderId(null), []);

  return {
    orders,
    loading,
    refreshing,
    lastFetchAt,
    latestNewOrderId,
    clearNewOrderHighlight,
    refresh: () => fetchOnce(),
    setLocalOrder,
  };
}
