import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { api, Order } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSoundPlayer } from './useSoundPlayer';

/**
 * useCustomerOrderAlerts
 *
 * Mounted once at the customer-app root. Polls `/api/orders` every `intervalMs`
 * and watches each order's status. Plays:
 *   - `accepted`  → soft chime when an order transitions to "accepted"
 *   - `delivered` → success chime when an order transitions to "delivered"
 *
 * First poll only seeds the cache (no sound).
 */
export function useCustomerOrderAlerts(intervalMs: number = 8000) {
  const { token, user } = useAuth();
  const { play } = useSoundPlayer(false);
  const statusMapRef = useRef<Map<string, Order['status']>>(new Map());
  const seededRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      appStateRef.current = s;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!token || user?.role !== 'customer') {
      // Reset cache when logging out / switching to admin
      statusMapRef.current = new Map();
      seededRef.current = false;
      return;
    }

    let cancelled = false;

    async function tick() {
      try {
        const orders = await api.get<Order[]>('/orders', token!);
        if (cancelled) return;

        if (!seededRef.current) {
          // First load — just remember statuses, no sound
          orders.forEach((o) => statusMapRef.current.set(o.order_id, o.status));
          seededRef.current = true;
          return;
        }

        for (const o of orders) {
          const prev = statusMapRef.current.get(o.order_id);
          if (prev !== o.status) {
            // Only chime when transitioning into these terminal-ish states
            if (prev && prev !== o.status) {
              if (o.status === 'accepted') play('accepted');
              else if (o.status === 'delivered') play('delivered');
            }
            statusMapRef.current.set(o.order_id, o.status);
          }
        }
      } catch {
        // network blips — ignore
      }
    }

    // Kick off immediately, then on interval
    tick();
    const id = setInterval(() => {
      if (appStateRef.current === 'active') tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, user?.role, intervalMs, play]);
}
