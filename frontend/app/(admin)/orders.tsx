import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { api, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { StatusBadge, Status } from '@/src/components/StatusBadge';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

const NEXT: Record<Status, Status | null> = {
  pending: 'accepted',
  accepted: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  cancelled: null,
};

const FILTERS: Array<{ key: 'all' | Status; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'out_for_delivery', label: 'Out' },
  { key: 'delivered', label: 'Delivered' },
];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<Order[]>('/admin/orders', token);
      setOrders(list);
    } catch (e) {
      console.warn('admin orders load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next || updating) return;
    setUpdating(order.order_id);
    try {
      const updated = await api.patch<Order>(`/admin/orders/${order.order_id}/status`, { status: next }, token);
      setOrders((prev) => prev.map((o) => o.order_id === order.order_id ? updated : o));
    } catch (e) {
      console.warn(e);
    } finally {
      setUpdating(null);
    }
  }

  async function cancel(order: Order) {
    if (order.status === 'delivered' || order.status === 'cancelled' || updating) return;
    setUpdating(order.order_id);
    try {
      const updated = await api.patch<Order>(`/admin/orders/${order.order_id}/status`, { status: 'cancelled' }, token);
      setOrders((prev) => prev.map((o) => o.order_id === order.order_id ? updated : o));
    } catch (e) {
      console.warn(e);
    } finally {
      setUpdating(null);
    }
  }

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Admin · Orders</Text>
        <Text style={styles.countText}>{visible.length}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filter, filter === f.key && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.order_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptySub}>No orders in this view.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const next = NEXT[item.status];
            const busy = updating === item.order_id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.orderId}>#{item.order_id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.meta}>{item.user_email} • {new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.itemsList}>
                  {item.items.map((it) => (
                    <Text key={it.product_id} style={styles.itemLine} numberOfLines={1}>
                      {it.quantity} × {it.name} <Text style={styles.itemSub}>· ${it.subtotal.toFixed(2)}</Text>
                    </Text>
                  ))}
                </View>

                <View style={styles.addrBox}>
                  <Text style={styles.addrText}>
                    {item.address.full_name} · {item.address.phone}\n{item.address.line1}{item.address.line2 ? `, ${item.address.line2}` : ''}, {item.address.city} {item.address.pincode}
                  </Text>
                </View>

                <View style={styles.cardFoot}>
                  <Text style={styles.total}>${item.total.toFixed(2)} · {item.payment_method.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {item.status !== 'delivered' && item.status !== 'cancelled' ? (
                      <Pressable onPress={() => cancel(item)} style={[styles.actionBtn, styles.actionGhost]} disabled={busy}>
                        <Text style={styles.actionGhostText}>Cancel</Text>
                      </Pressable>
                    ) : null}
                    {next ? (
                      <Pressable onPress={() => advance(item)} style={[styles.actionBtn, styles.actionPrimary]} disabled={busy}>
                        <Text style={styles.actionPrimaryText}>{busy ? '...' : `Mark ${labelFor(next)}`}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function labelFor(s: Status) {
  switch (s) {
    case 'accepted': return 'Accepted';
    case 'out_for_delivery': return 'Out';
    case 'delivered': return 'Delivered';
    default: return s;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary },
  countText: { ...typography.bodyBold, color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  filter: { paddingHorizontal: 14, height: 36, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.primary },
  filterText: { ...typography.captionBold, color: colors.textSecondary },
  filterTextActive: { color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptySub: { ...typography.body, color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft, gap: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  orderId: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  itemsList: { gap: 2 },
  itemLine: { ...typography.caption, color: colors.textPrimary },
  itemSub: { color: colors.textSecondary },
  addrBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.sm },
  addrText: { ...typography.caption, color: colors.textSecondary },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  total: { ...typography.h3, color: colors.primary },
  actionBtn: { paddingHorizontal: 14, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, ...typography.captionBold },
  actionGhost: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  actionGhostText: { color: colors.textPrimary, ...typography.captionBold },
});
