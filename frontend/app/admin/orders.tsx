import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';

import { api, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { Status } from '@/src/components/StatusBadge';
import { useAdminAlarm } from '@/src/hooks/useAdminAlarm';
import { useMuteToggle } from '@/src/hooks/useMuteToggle';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type RiderOption = {
  driver_id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_online?: boolean;
};

// ---- Order status flow ----
const NEXT: Record<Status, Status | null> = {
  pending: 'accepted',
  accepted: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  cancelled: null,
};

const NEXT_LABEL: Record<Status, string> = {
  pending: 'Accept',
  accepted: 'Pack & Send',
  out_for_delivery: 'Mark Delivered',
  delivered: '',
  cancelled: '',
};

const FILTERS: Array<{ key: 'live' | 'all' | Status; label: string }> = [
  { key: 'live', label: 'Live' },
  { key: 'pending', label: 'New' },
  { key: 'accepted', label: 'Preparing' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'all', label: 'All' },
];

// ---- Tiny inline icons ----
function BellIcon({ color = colors.white, size = 16, off = false }: { color?: string; size?: number; off?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2H4.5L6 17Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M10 21a2 2 0 0 0 4 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {off ? <Path d="M3 3l18 18" stroke={color} strokeWidth={2} strokeLinecap="round" /> : null}
    </Svg>
  );
}
function DotIcon({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10"><Circle cx={5} cy={5} r={4} fill={color} /></Svg>
  );
}

// ---- Time helpers ----
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

// ---- KPI strip ----
type Counts = { pending: number; accepted: number; out: number; deliveredToday: number };
function buildCounts(list: Order[]): Counts {
  let pending = 0, accepted = 0, out = 0, deliveredToday = 0;
  for (const o of list) {
    if (o.status === 'pending') pending++;
    else if (o.status === 'accepted') accepted++;
    else if (o.status === 'out_for_delivery') out++;
    else if (o.status === 'delivered' && isToday(o.created_at)) deliveredToday++;
  }
  return { pending, accepted, out, deliveredToday };
}

function KpiTile({ label, value, color, accent }: { label: string; value: number; color: string; accent: string }) {
  return (
    <View style={[styles.kpi, { backgroundColor: accent }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ---- Pulse hook for new pending cards ----
function usePulse(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,90,0,0.0)', 'rgba(255,90,0,0.85)'] });
}

// ---- Order Card ----
function OrderCard({
  order,
  busy,
  onAdvance,
  onCancel,
  onAssign,
}: {
  order: Order;
  busy: boolean;
  onAdvance: (o: Order) => void;
  onCancel: (o: Order) => void;
  onAssign: (o: Order) => void;
}) {
  const isPending = order.status === 'pending';
  const pulseColor = usePulse(isPending);
  const next = NEXT[order.status];
  const statusMeta = STATUS_META[order.status];
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <Animated.View style={[styles.card, isPending && { borderColor: pulseColor, borderWidth: 2 }]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTopLeft}>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
            <DotIcon color={statusMeta.fg} />
            <Text style={[styles.statusPillText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
          </View>
          <Text style={styles.orderId}>#{order.order_id.slice(-6).toUpperCase()}</Text>
        </View>
        <Text style={styles.timeAgo}>{timeAgo(order.created_at)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.address.full_name}
          </Text>
          <Text style={styles.customerSub} numberOfLines={1}>
            {order.user_email} · {order.address.phone}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalAmt}>{formatINR(order.total)}</Text>
          <Text style={styles.totalMeta}>{itemCount} item{itemCount !== 1 ? 's' : ''} · {order.payment_method.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.itemsRow}>
        {order.items.slice(0, 3).map((it) => (
          <View key={it.product_id} style={styles.itemChip}>
            <Text style={styles.itemChipText} numberOfLines={1}>
              {it.quantity}× {it.name}
            </Text>
          </View>
        ))}
        {order.items.length > 3 ? (
          <View style={styles.itemChip}>
            <Text style={styles.itemChipText}>+{order.items.length - 3} more</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.addrBox}>
        <Text style={styles.addrText} numberOfLines={2}>
          {`${order.address.line1}${order.address.line2 ? `, ${order.address.line2}` : ''}, ${order.address.city} ${order.address.pincode}`}
        </Text>
      </View>

      {/* Pricing breakdown (shown for all orders, highlighted for Delivered) */}
      {(() => {
        const isDelivered = order.status === 'delivered';
        let orderProfit = 0;
        const hasMargin = order.items.some(
          (it) => it.selling_price != null && it.self_price != null,
        );
        if (!hasMargin) return null;
        order.items.forEach((it) => {
          if (it.selling_price != null && it.self_price != null) {
            orderProfit += (it.selling_price - it.self_price) * it.quantity;
          }
        });
        return (
          <View style={[styles.profitBox, isDelivered && styles.profitBoxDelivered]}>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>Selling Price</Text>
              <Text style={styles.profitVal}>
                {formatINR(order.items.reduce((s, it) => s + (it.selling_price ?? it.price) * it.quantity, 0))}
              </Text>
            </View>
            {order.items.some((it) => it.mrp) ? (
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>MRP Total</Text>
                <Text style={styles.profitVal}>
                  {formatINR(order.items.reduce((s, it) => s + (it.mrp ?? it.price) * it.quantity, 0))}
                </Text>
              </View>
            ) : null}
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>Self Price (Cost)</Text>
              <Text style={styles.profitVal}>
                {formatINR(order.items.reduce((s, it) => s + (it.self_price ?? 0) * it.quantity, 0))}
              </Text>
            </View>
            {isDelivered && (
              <View style={[styles.profitRow, styles.profitTotalRow]}>
                <Text style={styles.profitTotalLabel}>Order Profit</Text>
                <Text style={[styles.profitTotalVal, { color: orderProfit >= 0 ? '#1E8E3E' : '#C5221F' }]}>
                  {formatINR(orderProfit)}
                </Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Status timeline */}
      <View style={styles.timeline}>
        {(['pending', 'accepted', 'out_for_delivery', 'delivered'] as Status[]).map((s, i) => {
          const reached = stageReached(order.status, s);
          return (
            <React.Fragment key={s}>
              <View style={[styles.tlNode, reached && styles.tlNodeActive]} />
              {i < 3 ? <View style={[styles.tlBar, reached && styles.tlBarActive]} /> : null}
            </React.Fragment>
          );
        })}
      </View>

      {/* Assign Rider button — shown on accepted orders */}
      {order.status === 'accepted' && (
        <Pressable
          onPress={() => onAssign(order)}
          disabled={busy}
          style={({ pressed }) => [styles.assignRiderBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.assignRiderBtnText}>🛵 Assign Rider</Text>
        </Pressable>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {order.status !== 'delivered' && order.status !== 'cancelled' ? (
          <Pressable
            onPress={() => onCancel(order)}
            disabled={busy}
            style={({ pressed }) => [styles.actionGhost, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.actionGhostText}>Cancel</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          onPress={() => router.push({ pathname: '/order/[id]/chat', params: { id: order.order_id } })}
          style={({ pressed }) => [styles.actionChat, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.actionChatText}>💬</Text>
        </Pressable>
        {next ? (
          <Pressable
            onPress={() => onAdvance(order)}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionPrimary,
              isPending && styles.actionPrimaryHot,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.actionPrimaryText}>{busy ? '…' : NEXT_LABEL[order.status]}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const STAGE_ORDER: Status[] = ['pending', 'accepted', 'out_for_delivery', 'delivered'];
function stageReached(current: Status, target: Status): boolean {
  if (current === 'cancelled') return target === 'pending';
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

const STATUS_META: Record<Status, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FFF1E6', fg: '#E04F00', label: 'NEW ORDER' },
  accepted: { bg: '#E6F1FF', fg: '#1769E0', label: 'PREPARING' },
  out_for_delivery: { bg: '#FFF8DB', fg: '#9A6B00', label: 'ON THE WAY' },
  delivered: { bg: '#E7F8EC', fg: '#1E8E3E', label: 'DELIVERED' },
  cancelled: { bg: '#FCE8E6', fg: '#C5221F', label: 'CANCELLED' },
};

// ---- Screen ----
export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { muted, toggle: toggleMute } = useMuteToggle();
  const { orders, loading, refreshing, lastFetchAt, refresh, setLocalOrder } = useAdminAlarm(token, muted);
  const [filter, setFilter] = useState<'live' | 'all' | Status>('live');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // OTP modal state
  const [otpModal, setOtpModal] = useState<{ order: Order } | null>(null);
  const [otpInput, setOtpInput] = useState('');
  // Assign Rider modal state
  const [assignModal, setAssignModal] = useState<{ order: Order } | null>(null);
  const [riderList, setRiderList] = useState<RiderOption[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);

  // Re-render every 30s so "X min ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => buildCounts(orders), [orders, tick]);

  const visible = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'live') return orders.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'out_for_delivery');
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const onAdvance = useCallback(
    async (order: Order) => {
      const next = NEXT[order.status];
      if (!next || updatingId) return;
      // If advancing to "delivered", show OTP modal instead
      if (next === 'delivered') {
        setOtpInput('');
        setOtpModal({ order });
        return;
      }
      setUpdatingId(order.order_id);
      try {
        const updated = await api.patch<Order>(`/admin/orders/${order.order_id}/status`, { status: next }, token);
        setLocalOrder(updated);
      } catch (e) {
        console.warn('advance failed', e);
      } finally {
        setUpdatingId(null);
      }
    },
    [token, updatingId, setLocalOrder],
  );

  const onConfirmDelivery = useCallback(async () => {
    if (!otpModal || updatingId) return;
    const { order } = otpModal;
    setUpdatingId(order.order_id);
    setOtpModal(null);
    try {
      const updated = await api.patch<Order>(
        `/admin/orders/${order.order_id}/status`,
        { status: 'delivered', otp: otpInput.trim() },
        token,
      );
      setLocalOrder(updated);
    } catch (e: any) {
      Alert.alert('OTP Error', e?.data?.detail || e?.message || 'Delivery failed');
      setOtpModal({ order });
    } finally {
      setUpdatingId(null);
    }
  }, [otpModal, otpInput, token, updatingId, setLocalOrder]);

  const onCancel = useCallback(
    async (order: Order) => {
      if (order.status === 'delivered' || order.status === 'cancelled' || updatingId) return;
      setUpdatingId(order.order_id);
      try {
        const updated = await api.patch<Order>(`/admin/orders/${order.order_id}/status`, { status: 'cancelled' }, token);
        setLocalOrder(updated);
      } catch (e) {
        console.warn('cancel failed', e);
      } finally {
        setUpdatingId(null);
      }
    },
    [token, updatingId, setLocalOrder],
  );

  const fetchLabel = lastFetchAt ? `Updated ${timeAgo(lastFetchAt.toISOString())}` : 'Syncing…';

  // Open Assign Rider modal and fetch approved drivers
  const onOpenAssign = useCallback(
    async (order: Order) => {
      setAssignModal({ order });
      setLoadingRiders(true);
      try {
        const riders = await api.get<RiderOption[]>('/admin/drivers?status=approved', token);
        setRiderList(riders || []);
      } catch {
        setRiderList([]);
      } finally {
        setLoadingRiders(false);
      }
    },
    [token],
  );

  const onAssignRider = useCallback(
    async (driverId: string) => {
      if (!assignModal || updatingId) return;
      const { order } = assignModal;
      setUpdatingId(order.order_id);
      setAssignModal(null);
      try {
        const updated = await api.post<Order>(
          `/admin/orders/${order.order_id}/assign`,
          { driver_id: driverId },
          token,
        );
        setLocalOrder(updated);
      } catch (e: any) {
        Alert.alert('Assign failed', e?.data?.detail || e?.message || 'Could not assign rider');
      } finally {
        setUpdatingId(null);
      }
    },
    [assignModal, token, updatingId, setLocalOrder],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      {/* Assign Rider Modal */}
      <Modal visible={!!assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.assignSheet}>
            <View style={styles.assignSheetHandle} />
            <Text style={styles.modalTitle}>🛵 Assign a Rider</Text>
            <Text style={styles.modalSub}>
              Order #{assignModal?.order.order_id.slice(-6).toUpperCase()} · Select an approved rider
            </Text>
            {loadingRiders ? (
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : riderList.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing.xl }}>
                <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>🛵</Text>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>No approved riders</Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                  Go to Delivery Partners to approve a rider first.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {riderList.map((rider) => (
                  <Pressable
                    key={rider.driver_id}
                    onPress={() => onAssignRider(rider.driver_id)}
                    style={({ pressed }) => [styles.riderRow, pressed && { backgroundColor: colors.primarySoft }]}
                  >
                    <View style={styles.riderAvatar}>
                      <Text style={styles.riderAvatarText}>{rider.name.charAt(0).toUpperCase()}</Text>
                      {rider.is_online && <View style={styles.riderOnlineDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.riderName}>{rider.name}</Text>
                      <Text style={styles.riderMeta}>
                        {rider.phone} · {rider.vehicle_type}{rider.vehicle_number ? ` · ${rider.vehicle_number}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 20 }}>→</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => setAssignModal(null)} style={styles.modalBtnCancel}>
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={!!otpModal} transparent animationType="fade" onRequestClose={() => setOtpModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔐 Delivery OTP</Text>
            <Text style={styles.modalSub}>
              Ask the customer for their 4-digit delivery code for order #{otpModal?.order.order_id.slice(-6).toUpperCase()}
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Enter 4-digit OTP"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setOtpModal(null)} style={styles.modalBtnCancel}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmDelivery}
                disabled={otpInput.length !== 4}
                style={[styles.modalBtnConfirm, otpInput.length !== 4 && { opacity: 0.5 }]}
              >
                <Text style={styles.modalBtnConfirmText}>Confirm Delivery</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live Orders</Text>
          <View style={styles.statusLine}>
            <View style={[styles.dotLive, muted && styles.dotMuted]} />
            <Text style={styles.statusLineText}>{fetchLabel} · Auto-refresh 8s</Text>
          </View>
        </View>
        <Pressable
          onPress={toggleMute}
          accessibilityLabel={muted ? 'Unmute alerts' : 'Mute alerts'}
          style={({ pressed }) => [
            styles.muteBtn,
            muted ? styles.muteBtnOff : styles.muteBtnOn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <BellIcon color={colors.white} size={18} off={muted} />
          <Text style={styles.muteBtnText}>{muted ? 'Muted' : 'Alerts on'}</Text>
        </Pressable>
      </View>

      {/* KPI strip */}
      <View style={styles.kpiRow}>
        <KpiTile label="New" value={counts.pending} color="#E04F00" accent="#FFF1E6" />
        <KpiTile label="Preparing" value={counts.accepted} color="#1769E0" accent="#E6F1FF" />
        <KpiTile label="On the way" value={counts.out} color="#9A6B00" accent="#FFF8DB" />
        <KpiTile label="Delivered" value={counts.deliveredToday} color="#1E8E3E" accent="#E7F8EC" />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.order_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>All caught up 🎉</Text>
              <Text style={styles.emptySub}>No orders in this view right now.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              busy={updatingId === item.order_id}
              onAdvance={onAdvance}
              onCancel={onCancel}
              onAssign={onOpenAssign}
            />
          )}
        />
      )}
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusLineText: { ...typography.tiny, color: colors.textSecondary },
  dotLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  dotMuted: { backgroundColor: colors.textMuted },

  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radii.pill,
    ...shadow.soft,
  },
  muteBtnOn: { backgroundColor: colors.primary },
  muteBtnOff: { backgroundColor: colors.textMuted },
  muteBtnText: { color: colors.white, ...typography.captionBold },

  kpiRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 10,
  },
  kpi: {
    minWidth: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  kpiValue: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5 },
  kpiLabel: { ...typography.tiny, fontWeight: '700' as const, marginTop: 2, opacity: 0.85 },

  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  filter: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  filterText: { ...typography.captionBold, color: colors.textSecondary },
  filterTextActive: { color: colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  emptySub: { ...typography.body, color: colors.textSecondary },

  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
    gap: spacing.sm,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill,
  },
  statusPillText: { ...typography.tiny, fontWeight: '800' as const, letterSpacing: 0.4 },
  orderId: { ...typography.captionBold, color: colors.textPrimary },
  timeAgo: { ...typography.tiny, color: colors.textSecondary },

  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  customerName: { ...typography.bodyBold, color: colors.textPrimary },
  customerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  totalAmt: { ...typography.h3, color: colors.primary },
  totalMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    maxWidth: '100%',
  },
  itemChipText: { ...typography.tiny, color: colors.textPrimary, fontWeight: '600' as const },

  addrBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  addrText: { ...typography.caption, color: colors.textSecondary },

  // Timeline
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  tlNode: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.border,
  },
  tlNodeActive: { backgroundColor: colors.primary },
  tlBar: { flex: 1, height: 3, backgroundColor: colors.border, marginHorizontal: 2 },
  tlBarActive: { backgroundColor: colors.primary },

  // Profit breakdown box
  profitBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  profitBoxDelivered: {
    backgroundColor: '#E7F8EC',
    borderColor: '#1E8E3E',
    borderWidth: 1,
  },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profitLabel: { ...typography.tiny, color: colors.textSecondary, fontWeight: '500' as const },
  profitVal: { ...typography.tiny, color: colors.textPrimary, fontWeight: '600' as const },
  profitTotalRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E8E3E',
  },
  profitTotalLabel: { ...typography.captionBold, color: '#1E8E3E' },
  profitTotalVal: { ...typography.bodyBold },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionGhost: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  actionGhostText: { ...typography.captionBold, color: colors.textPrimary },
  actionChat: {
    width: 42, height: 42,
    borderRadius: radii.pill,
    backgroundColor: '#E8EAF6',
    alignItems: 'center', justifyContent: 'center',
  },
  actionChatText: { fontSize: 18 },
  actionPrimary: {
    flex: 1,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ ios: {}, default: {} }),
  },
  actionPrimaryHot: { backgroundColor: colors.primary, ...shadow.strong },
  actionPrimaryText: { ...typography.bodyBold, color: colors.white },

  // OTP Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  modalSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  otpInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 10,
  },
  modalBtns: { flexDirection: 'row', gap: spacing.sm },
  modalBtnCancel: {
    flex: 1, height: 48, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnCancelText: { ...typography.bodyBold, color: colors.textSecondary },
  modalBtnConfirm: {
    flex: 2, height: 48, borderRadius: radii.pill,
    backgroundColor: '#1E8E3E',
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnConfirmText: { ...typography.bodyBold, color: colors.white },

  // Assign Rider
  assignSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
    gap: spacing.md,
  },
  assignSheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  riderRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  riderAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  riderAvatarText: { ...typography.bodyBold, color: colors.primary },
  riderOnlineDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white,
  },
  riderName: { ...typography.bodyBold, color: colors.textPrimary },
  riderMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  assignRiderBtn: {
    backgroundColor: '#E8EAF6',
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5CAE9',
  },
  assignRiderBtnText: { ...typography.captionBold, color: '#3949AB' },
});
