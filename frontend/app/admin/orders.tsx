import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

import { api, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { Status } from '@/src/components/StatusBadge';
import { useAdminAlarm } from '@/src/hooks/useAdminAlarm';
import { useMuteToggle } from '@/src/hooks/useMuteToggle';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

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
}: {
  order: Order;
  busy: boolean;
  onAdvance: (o: Order) => void;
  onCancel: (o: Order) => void;
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
          <Text style={styles.totalAmt}>${order.total.toFixed(2)}</Text>
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

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kpiRow}
      >
        <KpiTile label="New" value={counts.pending} color="#E04F00" accent="#FFF1E6" />
        <KpiTile label="Preparing" value={counts.accepted} color="#1769E0" accent="#E6F1FF" />
        <KpiTile label="On the way" value={counts.out} color="#9A6B00" accent="#FFF8DB" />
        <KpiTile label="Delivered today" value={counts.deliveredToday} color="#1E8E3E" accent="#E7F8EC" />
      </ScrollView>

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
});
