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

import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/Toast';
import { StoreApi, StoreDashboard } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';
import { useStoreToken } from '@/src/hooks/useStoreToken';

export default function StoreDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const token = useStoreToken();
  const toast = useToast();

  const [data, setData] = useState<StoreDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const d = await StoreApi.dashboard(token);
      setData(d);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
          <Text style={styles.hello}>Hi, {user?.name?.split(' ')[0] || 'Manager'}</Text>
          <Text style={styles.role} numberOfLines={1}>
            {data?.store?.name || 'Store Manager'}
            {data?.store?.city ? ` • ${data.store.city}` : ''}
          </Text>
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

      {/* Revenue card */}
      <View style={styles.revenueCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.revenueLabel}>Revenue today</Text>
          <Text style={styles.revenueValue}>{formatINR(data?.revenue_today || 0)}</Text>
          <Text style={styles.revenueSub}>
            {data?.orders?.delivered_today || 0} delivered • {data?.orders?.delivered_week || 0} this week
          </Text>
        </View>
        <View style={styles.revenueIcon}>
          <IconRupee />
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.kpiGrid}>
        <Kpi
          label="Pending"
          value={data?.orders?.pending || 0}
          highlight={(data?.orders?.pending || 0) > 0}
          onPress={() => router.push('/store/orders?filter=pending')}
        />
        <Kpi
          label="In progress"
          value={data?.orders?.in_progress || 0}
          onPress={() => router.push('/store/orders?filter=in_progress')}
        />
        <Kpi
          label="Riders online"
          value={data?.drivers?.online || 0}
          sub={`${data?.drivers?.total || 0} total`}
          onPress={() => router.push('/store/drivers')}
        />
        <Kpi
          label="Low stock"
          value={data?.inventory?.low_stock || 0}
          highlight={(data?.inventory?.low_stock || 0) > 0}
          sub={`${data?.inventory?.out_of_stock || 0} out`}
          onPress={() => router.push('/store/inventory')}
        />
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/store/orders?filter=pending')}
        >
          <View style={[styles.linkIcon, { backgroundColor: '#FFF1E6' }]}>
            <IconBolt />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Accept new orders</Text>
            <Text style={styles.linkSub}>{data?.orders?.pending || 0} waiting for confirmation</Text>
          </View>
          <IconChevron />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/store/orders?filter=in_progress')}
        >
          <View style={[styles.linkIcon, { backgroundColor: '#EAF2FF' }]}>
            <IconBike />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Assign riders</Text>
            <Text style={styles.linkSub}>Dispatch confirmed orders to delivery partners</Text>
          </View>
          <IconChevron />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.75 }]}
          onPress={() => router.push('/store/inventory?low=1')}
        >
          <View style={[styles.linkIcon, { backgroundColor: '#FDECEA' }]}>
            <IconBox />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Restock items</Text>
            <Text style={styles.linkSub}>{data?.inventory?.low_stock || 0} products running low</Text>
          </View>
          <IconChevron />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
  onPress,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kpiCard, pressed && { opacity: 0.75 }]}
    >
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, highlight && { color: colors.primary }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </Pressable>
  );
}

function IconRupee() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4h12M6 9h12M14 4c2 0 3 2 3 4s-1 4-3 4H6l8 8"
        stroke={colors.primary}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconBolt() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="#B23F00" strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function IconBike() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 18a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 15l3-6h6l3 6"
        stroke="#1856B5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconBox() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7"
        stroke="#B42318"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconChevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
  revenueCard: {
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
  revenueLabel: { ...typography.caption, color: colors.textSecondary },
  revenueValue: { ...typography.h1, color: colors.textPrimary, marginTop: 2 },
  revenueSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 4 },
  revenueIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md - spacing.xs / 2,
    marginTop: spacing.md,
  },
  kpiCard: {
    width: '50%',
    paddingHorizontal: spacing.xs / 2,
    marginBottom: spacing.sm,
  },
  kpiLabel: { ...typography.tiny, color: colors.textSecondary, letterSpacing: 0.4 },
  kpiValue: { ...typography.h1, color: colors.textPrimary, marginTop: 2 },
  kpiSub: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
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
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: { ...typography.bodyBold, color: colors.textPrimary },
  linkSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
});
