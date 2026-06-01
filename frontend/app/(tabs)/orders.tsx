import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { api, Order, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { StatusBadge } from '@/src/components/StatusBadge';
import { useCart } from '@/src/store/cartStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

const TRACKABLE: Order['status'][] = ['pending', 'accepted', 'out_for_delivery'];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const cartAdd = useCart((s) => s.add);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<Order[]>('/orders', token);
      setOrders(list);
    } catch (e) {
      console.warn('orders load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reorder = useCallback(async (order: Order) => {
    // Hydrate cart from order items by fetching live product info per item.
    try {
      let added = 0;
      for (const it of order.items) {
        try {
          const p = await api.get<Product>(`/products/${it.product_id}`);
          if (p && (p.stock ?? 0) > 0) {
            cartAdd(p, Math.min(it.quantity, p.stock));
            added += 1;
          }
        } catch {
          // Skip products that no longer exist
        }
      }
      if (added === 0) {
        Alert.alert('Reorder', 'None of these items are available right now.');
        return;
      }
      router.push('/(tabs)/cart');
    } catch (e) {
      Alert.alert('Reorder failed', 'Please try again.');
    }
  }, [cartAdd]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>My Orders</Text>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.order_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>Your placed orders will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/order/${item.order_id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityLabel={`Order ${item.order_id.slice(-6).toUpperCase()}`}
            >
              <View style={styles.cardHead}>
                <Text style={styles.orderId}>#{item.order_id.slice(-6).toUpperCase()}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.meta}>
                {item.items.length} item{item.items.length !== 1 ? 's' : ''} • {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <View style={styles.itemsList}>
                {item.items.slice(0, 3).map((it) => (
                  <Text key={it.product_id} numberOfLines={1} style={styles.itemLine}>
                    {it.quantity} × {it.name}
                  </Text>
                ))}
                {item.items.length > 3 ? (
                  <Text style={styles.itemLine}>+{item.items.length - 3} more</Text>
                ) : null}
              </View>
              <View style={styles.cardFoot}>
                <Text style={styles.payment}>{item.payment_method === 'cod' ? 'Cash on Delivery' : 'Card'}</Text>
                <Text style={styles.total}>{formatINR(item.total)}</Text>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); reorder(item); }}
                  style={({ pressed }) => [styles.actionBtn, styles.actionGhost, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                  accessibilityLabel={`Reorder ${item.order_id.slice(-6)}`}
                >
                  <Text style={styles.actionGhostText}>↻  Reorder</Text>
                </Pressable>
                {TRACKABLE.includes(item.status) ? (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); router.push(`/order/${item.order_id}`); }}
                    style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && { opacity: 0.85 }]}
                    hitSlop={6}
                    accessibilityLabel={`Track order ${item.order_id.slice(-6)}`}
                  >
                    <Text style={styles.actionPrimaryText}>Track order</Text>
                  </Pressable>
                ) : (
                  <View style={styles.viewHint}>
                    <Text style={styles.viewHintText}>View details</Text>
                    <Text style={styles.viewHintArrow}>›</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  emptySub: { ...typography.body, color: colors.textSecondary },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft, gap: 6 },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  itemsList: { marginTop: 4, gap: 2 },
  itemLine: { ...typography.caption, color: colors.textPrimary },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  payment: { ...typography.caption, color: colors.textSecondary },
  total: { ...typography.h3, color: colors.primary },
  viewHint: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  viewHintText: { ...typography.captionBold, color: colors.primary },
  viewHintArrow: { ...typography.bodyBold, color: colors.primary, marginTop: -2 },
  actionsRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  actionGhost: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionGhostText: { ...typography.captionBold, color: colors.primary },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { ...typography.captionBold, color: colors.white },
});
