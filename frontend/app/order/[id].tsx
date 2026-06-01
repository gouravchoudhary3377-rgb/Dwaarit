import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { StatusBadge, Status } from '@/src/components/StatusBadge';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12l5 5L20 7"
        stroke={filled ? colors.white : colors.textMuted}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const FLOW: Array<{ key: Status; label: string; hint: string }> = [
  { key: 'pending', label: 'Order placed', hint: 'We received your order' },
  { key: 'accepted', label: 'Accepted', hint: 'Packing your groceries' },
  { key: 'out_for_delivery', label: 'Out for delivery', hint: 'On the way to you' },
  { key: 'delivered', label: 'Delivered', hint: 'Enjoy your fresh groceries!' },
];

function rankOf(status: Status): number {
  const idx = FLOW.findIndex((f) => f.key === status);
  return idx === -1 ? 0 : idx;
}

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      const o = await api.get<Order>(`/orders/${id}`, token);
      setOrder(o);
    } catch (e) {
      console.warn('order load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8, left: spacing.md }]} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>Order not found.</Text>
      </View>
    );
  }

  const cancelled = order.status === 'cancelled';
  const currentRank = rankOf(order.status);
  const subtotal = order.items.reduce((s, it) => s + it.subtotal, 0);
  const deliveryFee = 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtnInline} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order #{order.order_id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.headerSub}>
            Placed {new Date(order.created_at).toLocaleString()}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Status timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{cancelled ? 'Order cancelled' : 'Order status'}</Text>
          {cancelled ? (
            <View style={styles.cancelBox}>
              <Text style={styles.cancelText}>
                This order was cancelled. If this wasn't you, please contact support.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {FLOW.map((step, idx) => {
                const reached = idx <= currentRank;
                const active = idx === currentRank;
                const isLast = idx === FLOW.length - 1;
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          reached ? styles.timelineDotActive : styles.timelineDotIdle,
                          active && styles.timelineDotPulse,
                        ]}
                      >
                        <CheckIcon filled={reached} />
                      </View>
                      {!isLast ? (
                        <View
                          style={[
                            styles.timelineConnector,
                            idx < currentRank ? styles.timelineConnectorActive : null,
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.timelineText}>
                      <Text style={[styles.stepLabel, reached && styles.stepLabelReached]}>
                        {step.label}
                      </Text>
                      <Text style={styles.stepHint}>{step.hint}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.countPill}>{order.items.length}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {order.items.map((it) => (
              <View key={it.product_id} style={styles.itemRow}>
                <Image source={{ uri: it.image_url }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.itemMeta}>
                    {it.quantity} × {formatINR(it.price)} · {it.unit}
                  </Text>
                </View>
                <Text style={styles.itemSubtotal}>{formatINR(it.subtotal)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          <View style={styles.addrBox}>
            <Text style={styles.addrName}>{order.address.full_name}</Text>
            <Text style={styles.addrPhone}>{order.address.phone}</Text>
            <Text style={styles.addrLines}>
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ''}
              {`\n${order.address.city} ${order.address.pincode}`}
            </Text>
          </View>
          {order.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment summary</Text>
          <View style={styles.payRow}>
            <Text style={styles.payK}>Subtotal</Text>
            <Text style={styles.payV}>{formatINR(subtotal)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payK}>Delivery fee</Text>
            <Text style={styles.payVfree}>{deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.payRow}>
            <Text style={styles.totalK}>Total</Text>
            <Text style={styles.totalV}>{formatINR(order.total)}</Text>
          </View>
          <View style={styles.payMethodRow}>
            <Text style={styles.payMethodLabel}>Payment method</Text>
            <View style={styles.payMethodPill}>
              <Text style={styles.payMethodText}>
                {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Card'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  backBtnInline: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  countPill: {
    ...typography.tiny,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },

  // Timeline
  timeline: { paddingTop: spacing.xs },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineDotIdle: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  timelineDotPulse: { ...shadow.strong },
  timelineConnector: {
    width: 2, flex: 1, minHeight: 24,
    backgroundColor: colors.border, marginTop: 2,
  },
  timelineConnectorActive: { backgroundColor: colors.primary },
  timelineText: { flex: 1, paddingBottom: spacing.md, paddingTop: 3 },
  stepLabel: { ...typography.captionBold, color: colors.textMuted },
  stepLabelReached: { color: colors.textPrimary },
  stepHint: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  // Cancelled
  cancelBox: {
    backgroundColor: '#FCE8E6',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  cancelText: { ...typography.caption, color: '#C5221F' },

  // Items
  itemRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  itemImg: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surface },
  itemName: { ...typography.captionBold, color: colors.textPrimary },
  itemMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  itemSubtotal: { ...typography.bodyBold, color: colors.textPrimary },

  // Address
  addrBox: { backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radii.md, gap: 2 },
  addrName: { ...typography.bodyBold, color: colors.textPrimary },
  addrPhone: { ...typography.caption, color: colors.textSecondary },
  addrLines: { ...typography.caption, color: colors.textPrimary, marginTop: 4, lineHeight: 20 },
  notesBox: { marginTop: spacing.xs },
  notesLabel: { ...typography.tiny, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  notesText: { ...typography.caption, color: colors.textPrimary },

  // Payment
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  payK: { ...typography.body, color: colors.textSecondary },
  payV: { ...typography.bodyBold, color: colors.textPrimary },
  payVfree: { ...typography.bodyBold, color: colors.success },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  totalK: { ...typography.bodyBold, color: colors.textPrimary },
  totalV: { ...typography.h3, color: colors.primary },
  payMethodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  payMethodLabel: { ...typography.caption, color: colors.textSecondary },
  payMethodPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill,
  },
  payMethodText: { ...typography.tiny, fontWeight: '700', color: colors.primary },
});
