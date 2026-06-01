import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { api, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { StatusBadge } from '@/src/components/StatusBadge';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

export default function Orders() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
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
                <Text style={styles.total}>${item.total.toFixed(2)}</Text>
              </View>
              <View style={styles.viewHint}>
                <Text style={styles.viewHintText}>View details</Text>
                <Text style={styles.viewHintArrow}>›</Text>
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
});
