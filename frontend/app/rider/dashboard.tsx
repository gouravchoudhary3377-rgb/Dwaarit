import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/Toast';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type RiderProfile = {
  driver_id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_online?: boolean;
  deliveries?: number;
  earnings?: number;
  store_id?: string | null;
};

type RiderOrder = {
  order_id: string;
  status: string;
  total: number;
  payable?: number;
  payment_method?: string;
  delivery_fee?: number;
  items: { name: string; quantity: number }[];
  address: { full_name: string; phone: string; line1: string; city: string; pincode: string };
  created_at: string;
};

type EarningsResp = {
  summary: { deliveries: number; earnings: number };
  by_day: { date: string; deliveries: number; earnings: number }[];
};

export default function RiderDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const token = useToken();
  const toast = useToast();

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [earnings, setEarnings] = useState<EarningsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [p, o, e] = await Promise.all([
        api.get<RiderProfile>('/rider/me', token),
        api.get<RiderOrder[]>('/rider/orders', token).catch(() => [] as RiderOrder[]),
        api.get<EarningsResp>('/rider/earnings', token).catch(
          () => ({ summary: { deliveries: 0, earnings: 0 }, by_day: [] } as EarningsResp),
        ),
      ]);
      setProfile(p);
      setOrders(o);
      setEarnings(e);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load rider profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onToggleOnline = useCallback(
    async (next: boolean) => {
      if (!token || !profile) return;
      if (profile.status !== 'approved') {
        toast.info('Your account is awaiting approval');
        return;
      }
      setToggling(true);
      try {
        await api.post('/rider/online', { online: next }, token);
        setProfile((p) => (p ? { ...p, is_online: next } : p));
        toast.success(next ? 'You are now online' : 'You are offline');
      } catch (err: any) {
        toast.error(err?.message || 'Could not update status');
      } finally {
        setToggling(false);
      }
    },
    [token, profile, toast],
  );

  const onStatusChange = useCallback(
    async (orderId: string, status: 'out_for_delivery' | 'delivered') => {
      if (!token) return;
      try {
        await api.post(`/rider/orders/${orderId}/status`, { status }, token);
        toast.success(status === 'delivered' ? 'Marked delivered' : 'Out for delivery');
        fetchAll();
      } catch (err: any) {
        toast.error(err?.message || 'Update failed');
      }
    },
    [token, toast, fetchAll],
  );

  const active = useMemo(
    () => orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled'),
    [orders],
  );

  if (loading) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.surface }]}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          onRefresh={() => {
            setRefreshing(true);
            fetchAll();
          }}
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hi, {profile?.name?.split(' ')[0] || 'Rider'}</Text>
          <Text style={styles.role}>Delivery partner • {profile?.vehicle_type || 'bike'}</Text>
        </View>
        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Online Toggle */}
      <View style={styles.statusCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>
            {profile?.is_online ? 'You are Online' : 'You are Offline'}
          </Text>
          <Text style={styles.statusSub}>
            {profile?.status === 'approved'
              ? profile?.is_online
                ? 'Receiving new orders near you'
                : 'Switch on to receive orders'
              : `Account ${profile?.status}. Activation pending.`}
          </Text>
        </View>
        {toggling ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Switch
            value={!!profile?.is_online}
            onValueChange={onToggleOnline}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={colors.white}
            disabled={profile?.status !== 'approved'}
          />
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          label="Deliveries"
          value={String(earnings?.summary.deliveries ?? 0)}
          icon={<IconCheck />}
        />
        <StatCard
          label="Earnings"
          value={formatINR(earnings?.summary.earnings ?? 0)}
          icon={<IconWallet />}
        />
        <StatCard label="Active" value={String(active.length)} icon={<IconBike />} />
      </View>

      {/* Active Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active orders</Text>
        {active.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No active orders. Stay online to get new assignments.
            </Text>
          </View>
        ) : (
          active.map((o) => (
            <OrderCard key={o.order_id} order={o} onStatusChange={onStatusChange} />
          ))
        )}
      </View>

      {/* Recent Earnings */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent earnings</Text>
          <Pressable onPress={() => router.push('/rider/earnings')}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        {(earnings?.by_day || []).slice(0, 5).map((d) => (
          <View key={d.date} style={styles.earnRow}>
            <Text style={styles.earnDate}>{d.date}</Text>
            <Text style={styles.earnDeliveries}>{d.deliveries} deliveries</Text>
            <Text style={styles.earnAmount}>{formatINR(d.earnings)}</Text>
          </View>
        ))}
        {(!earnings || earnings.by_day.length === 0) && (
          <Text style={styles.emptyText}>No earnings yet. Complete your first delivery!</Text>
        )}
      </View>

      {/* Quick Links */}
      <View style={[styles.section, { marginBottom: spacing.lg }]}>
        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/rider/orders')}
        >
          <IconList />
          <Text style={styles.linkCardText}>All assigned orders</Text>
          <IconChevron />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/rider/profile')}
        >
          <IconUser />
          <Text style={styles.linkCardText}>My profile</Text>
          <IconChevron />
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------- Components ----------
function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OrderCard({
  order,
  onStatusChange,
}: {
  order: RiderOrder;
  onStatusChange: (id: string, s: 'out_for_delivery' | 'delivered') => void;
}) {
  const next: 'out_for_delivery' | 'delivered' | null =
    order.status === 'accepted' || order.status === 'pending'
      ? 'out_for_delivery'
      : order.status === 'out_for_delivery'
        ? 'delivered'
        : null;
  const ctaLabel =
    next === 'out_for_delivery' ? 'Start delivery' : next === 'delivered' ? 'Mark delivered' : '';

  const itemCount = order.items.reduce((a, b) => a + b.quantity, 0);
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHead}>
        <Text style={styles.orderId}>#{order.order_id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.badge, badgeStyle(order.status)]}>
          <Text style={[styles.badgeText, badgeTextStyle(order.status)]}>
            {order.status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
      <Text style={styles.orderItems} numberOfLines={2}>
        {itemCount} items • {order.items.map((i) => i.name).slice(0, 3).join(', ')}
        {order.items.length > 3 ? '...' : ''}
      </Text>
      <View style={styles.divider} />
      <View style={styles.addrBlock}>
        <Text style={styles.addrName}>{order.address.full_name}</Text>
        <Text style={styles.addrLine}>
          {order.address.line1}, {order.address.city} — {order.address.pincode}
        </Text>
        <Text style={styles.addrPhone}>📞 {order.address.phone}</Text>
      </View>
      <View style={styles.orderFoot}>
        <View>
          <Text style={styles.payLabel}>{(order.payment_method || 'cod').toUpperCase()}</Text>
          <Text style={styles.payAmount}>{formatINR(order.payable ?? order.total)}</Text>
        </View>
        {next ? (
          <Pressable
            onPress={() => onStatusChange(order.order_id, next)}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function badgeStyle(s: string) {
  if (s === 'delivered') return { backgroundColor: '#E6F7EC' };
  if (s === 'cancelled') return { backgroundColor: '#FDECEA' };
  if (s === 'out_for_delivery') return { backgroundColor: '#FFF1E6' };
  return { backgroundColor: '#EAF2FF' };
}
function badgeTextStyle(s: string) {
  if (s === 'delivered') return { color: '#157A37' };
  if (s === 'cancelled') return { color: '#B42318' };
  if (s === 'out_for_delivery') return { color: '#B23F00' };
  return { color: '#1856B5' };
}

// ---------- Hook ----------
function useToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { storage } = await import('@/src/utils/storage');
      const t = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      setToken(t);
    })();
  }, []);
  return token;
}

// ---------- Icons ----------
function IconCheck() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconWallet() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h12" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 12h3" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconBike() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15l3-6h6l3 6" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconList() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconUser() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 1116 0" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconChevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  hello: { ...typography.h2, color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { ...typography.captionBold, color: colors.textPrimary },
  statusCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...(shadow as any).card,
  },
  statusTitle: { ...typography.bodyBold, color: colors.textPrimary },
  statusSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    ...(shadow as any).soft,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: { ...typography.bodyBold, color: colors.textPrimary, fontSize: 18 },
  statLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  link: { ...typography.captionBold, color: colors.primary },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...(shadow as any).soft,
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: { ...typography.bodyBold, color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
  badgeText: { ...typography.tiny, fontWeight: '700' },
  orderItems: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  addrBlock: { gap: 2 },
  addrName: { ...typography.captionBold, color: colors.textPrimary },
  addrLine: { ...typography.caption, color: colors.textSecondary },
  addrPhone: { ...typography.caption, color: colors.textSecondary },
  orderFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  payLabel: { ...typography.tiny, color: colors.textMuted, letterSpacing: 0.6 },
  payAmount: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 2 },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
  },
  ctaText: { ...typography.captionBold, color: colors.white },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  earnDate: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  earnDeliveries: { ...typography.caption, color: colors.textSecondary, marginRight: spacing.md },
  earnAmount: { ...typography.captionBold, color: colors.primary },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...(shadow as any).soft,
  },
  linkCardText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
});
