import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useToast } from '@/src/components/ui/Toast';
import { storage } from '@/src/utils/storage';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type RiderOrder = {
  order_id: string;
  status: string;
  total: number;
  payable?: number;
  payment_method?: string;
  items: { name: string; quantity: number }[];
  address: { full_name: string; phone: string; line1: string; city: string; pincode: string };
  created_at: string;
};

type Filter = 'active' | 'delivered' | 'all';

export default function RiderOrdersScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('active');

  const load = useCallback(async () => {
    try {
      const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      const data = await api.get<RiderOrder[]>('/rider/orders', token);
      setOrders(data);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = orders.filter((o) => {
    if (filter === 'active') return o.status !== 'delivered' && o.status !== 'cancelled';
    if (filter === 'delivered') return o.status === 'delivered';
    return true;
  });

  const onUpdate = useCallback(
    async (orderId: string, status: 'out_for_delivery' | 'delivered') => {
      try {
        const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
        await api.post(`/rider/orders/${orderId}/status`, { status }, token);
        toast.success(status === 'delivered' ? 'Marked delivered' : 'Out for delivery');
        load();
      } catch (err: any) {
        toast.error(err?.message || 'Update failed');
      }
    },
    [toast, load],
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>My Orders</Text>
      </View>
      <View style={styles.tabsRow}>
        {(['active', 'delivered', 'all'] as Filter[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setFilter(t)}
            style={[styles.tab, filter === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No orders in this view yet.</Text>
            </View>
          ) : (
            filtered.map((o) => {
              const next: 'out_for_delivery' | 'delivered' | null =
                o.status === 'accepted' || o.status === 'pending'
                  ? 'out_for_delivery'
                  : o.status === 'out_for_delivery'
                    ? 'delivered'
                    : null;
              const itemCount = o.items.reduce((a, b) => a + b.quantity, 0);
              return (
                <View key={o.order_id} style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.id}>#{o.order_id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.statusText}>{o.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={styles.items}>
                    {itemCount} items • {o.items.map((i) => i.name).slice(0, 3).join(', ')}
                    {o.items.length > 3 ? '...' : ''}
                  </Text>
                  <Text style={styles.addr}>
                    {o.address.full_name} • {o.address.line1}, {o.address.city}
                  </Text>
                  <View style={styles.row}>
                    <Text style={styles.amount}>
                      {(o.payment_method || 'cod').toUpperCase()} • {formatINR(o.payable ?? o.total)}
                    </Text>
                    {next ? (
                      <Pressable
                        onPress={() => onUpdate(o.order_id, next)}
                        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.ctaText}>
                          {next === 'out_for_delivery' ? 'Start' : 'Delivered'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: spacing.sm, marginRight: spacing.xs },
  title: { ...typography.h3, color: colors.textPrimary },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.captionBold, color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  emptyCard: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.md, alignItems: 'center' },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...(shadow as any).soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  id: { ...typography.bodyBold, color: colors.textPrimary },
  statusText: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  items: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  addr: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  amount: { ...typography.bodyBold, color: colors.textPrimary },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  ctaText: { ...typography.captionBold, color: colors.white },
});
