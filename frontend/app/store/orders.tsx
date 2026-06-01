import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useToast } from '@/src/components/ui/Toast';
import { StoreApi, StoreOrder } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';
import { useStoreToken } from '@/src/hooks/useStoreToken';

type FilterKey = 'all' | 'pending' | 'in_progress' | 'delivered';

const FILTERS: { key: FilterKey; label: string; statuses: string[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'pending', label: 'Pending', statuses: ['pending'] },
  { key: 'in_progress', label: 'In progress', statuses: ['confirmed', 'preparing', 'out_for_delivery', 'accepted'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
];

export default function StoreOrdersScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initial = (params.filter as FilterKey) || 'all';
  const token = useStoreToken();
  const toast = useToast();

  const [filter, setFilter] = useState<FilterKey>(
    FILTERS.find((f) => f.key === initial) ? initial : 'all',
  );
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeStatuses = useMemo(
    () => FILTERS.find((f) => f.key === filter)?.statuses ?? [],
    [filter],
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const statusParam = activeStatuses.length ? activeStatuses.join(',') : undefined;
      const data = await StoreApi.listOrders(token, statusParam);
      setOrders(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeStatuses, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Manage incoming & active orders</Text>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.order_id}
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
          renderItem={({ item }) => <OrderCard order={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}

function OrderCard({ order }: { order: StoreOrder }) {
  const palette = statusPalette(order.status);
  const itemsCount = order.items?.reduce((a, i) => a + (i.quantity || 0), 0) ?? 0;
  return (
    <Pressable
      onPress={() => router.push(`/store/order/${order.order_id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{order.order_id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
          <Text style={[styles.statusText, { color: palette.fg }]}>{prettyStatus(order.status)}</Text>
        </View>
      </View>
      <Text style={styles.customer} numberOfLines={1}>
        {order.address?.full_name || 'Customer'} • {order.address?.phone || ''}
      </Text>
      <Text style={styles.address} numberOfLines={1}>
        {order.address?.line1 || ''}
        {order.address?.city ? `, ${order.address.city}` : ''}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {itemsCount} item{itemsCount === 1 ? '' : 's'} • {formatINR(order.payable ?? order.total)}
        </Text>
        <View style={styles.chevRow}>
          {order.driver_name ? (
            <Text style={styles.riderTag} numberOfLines={1}>
              🛵 {order.driver_name.split(' ')[0]}
            </Text>
          ) : null}
          <Chevron />
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ filter }: { filter: FilterKey }) {
  return (
    <View style={[styles.flex, styles.center, { padding: spacing.lg }]}>
      <Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter.replace('_', ' ')} orders</Text>
      <Text style={styles.emptySub}>Pull to refresh to check for new orders.</Text>
    </View>
  );
}

function Chevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function prettyStatus(s: string) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusPalette(s: string) {
  if (s === 'pending') return { bg: '#FFF1E6', fg: '#B23F00' };
  if (s === 'confirmed' || s === 'accepted') return { bg: '#EAF2FF', fg: '#1856B5' };
  if (s === 'preparing') return { bg: '#FFF8DB', fg: '#7A5800' };
  if (s === 'out_for_delivery') return { bg: '#E8F6EE', fg: '#0F7B3F' };
  if (s === 'delivered') return { bg: '#E5F4EC', fg: '#0F7B3F' };
  if (s === 'cancelled') return { bg: '#FDECEA', fg: '#B42318' };
  return { bg: colors.surface, fg: colors.textSecondary };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    ...(shadow as any).soft,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { ...typography.bodyBold, color: colors.textPrimary },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
  statusText: { ...typography.tiny, fontWeight: '700' },
  customer: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.sm },
  address: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaText: { ...typography.captionBold, color: colors.textPrimary },
  chevRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  riderTag: { ...typography.tiny, color: colors.textSecondary },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary, textTransform: 'capitalize' },
  emptySub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
