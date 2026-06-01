import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type Dashboard = {
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  lifetime: { orders: number; revenue: number };
  status_counts: Record<string, number>;
  series_7d: { date: string; revenue: number; orders: number }[];
  top_products: { product_id: string; name: string; qty: number; revenue: number }[];
  users: { total: number; new_7d: number };
  tickets: { open: number; total: number };
  products: { total: number; low_stock: number };
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF8A00',
  accepted: '#1E88E5',
  out_for_delivery: '#8E24AA',
  delivered: '#34C759',
  cancelled: '#FF3B30',
};

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={[styles.statCard, color ? { borderTopColor: color, borderTopWidth: 3 } : null]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function BarChart({ series }: { series: Dashboard['series_7d'] }) {
  const max = Math.max(1, ...series.map((s) => s.revenue));
  if (!series.length) {
    return <Text style={styles.empty}>No revenue in the last 7 days</Text>;
  }
  return (
    <View style={styles.chart}>
      {series.map((s) => {
        const h = Math.max(4, (s.revenue / max) * 110);
        const d = new Date(s.date);
        const day = d.toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <View key={s.date} style={styles.barCol}>
            <Text style={styles.barValue}>{Math.round(s.revenue)}</Text>
            <View style={[styles.bar, { height: h }]} />
            <Text style={styles.barLabel}>{day}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get<Dashboard>('/admin/dashboard', token);
      setData(res);
    } catch {
      // keep prev
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textSecondary }}>Could not load dashboard.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + 8, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
      }
    >
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.sub}>Real-time platform overview</Text>

      {/* Headline KPIs */}
      <View style={styles.row2}>
        <StatCard
          label="TODAY · REVENUE"
          value={formatINR(data.today.revenue)}
          sub={`${data.today.orders} orders`}
          color={colors.primary}
        />
        <StatCard
          label="7-DAY · REVENUE"
          value={formatINR(data.week.revenue)}
          sub={`${data.week.orders} orders`}
          color="#1E88E5"
        />
      </View>
      <View style={styles.row2}>
        <StatCard
          label="LIFETIME · REVENUE"
          value={formatINR(data.lifetime.revenue)}
          sub={`${data.lifetime.orders} orders`}
          color="#34C759"
        />
        <StatCard
          label="USERS"
          value={String(data.users.total)}
          sub={`+${data.users.new_7d} this week`}
          color="#8E24AA"
        />
      </View>

      {/* Revenue chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Revenue · last 7 days</Text>
        <BarChart series={data.series_7d} />
      </View>

      {/* Order status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order status breakdown</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          {Object.keys(data.status_counts).length === 0 && (
            <Text style={styles.empty}>No orders yet.</Text>
          )}
          {Object.entries(data.status_counts).map(([s, n]) => (
            <View key={s} style={styles.statusRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLORS[s] || colors.textMuted }} />
                <Text style={styles.statusLabel}>{s.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.statusCount}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top products */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top products · 30 days</Text>
        {data.top_products.length === 0 ? (
          <Text style={styles.empty}>No sales yet.</Text>
        ) : (
          data.top_products.map((p, i) => (
            <View key={p.product_id} style={styles.topRow}>
              <View style={styles.topRank}><Text style={styles.topRankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.topSub}>{p.qty} sold</Text>
              </View>
              <Text style={styles.topRev}>{formatINR(p.revenue)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Operational shortcuts */}
      <Text style={[styles.cardTitle, { marginTop: spacing.lg, marginLeft: 4 }]}>Shortcuts</Text>
      <View style={styles.row2}>
        <Shortcut
          title="Tickets"
          value={`${data.tickets.open} open`}
          tint="#FFF3E0"
          onPress={() => router.push('/admin/tickets')}
        />
        <Shortcut
          title="Users"
          value={`${data.users.total} total`}
          tint="#E8EAF6"
          onPress={() => router.push('/admin/users')}
        />
      </View>
      <View style={styles.row2}>
        <Shortcut
          title="Low Stock"
          value={`${data.products.low_stock} items`}
          tint="#FFEBEE"
          onPress={() => router.push('/admin/products')}
        />
        <Shortcut
          title="Wallet Ops"
          value="Credit / Refund"
          tint="#E8F5E9"
          onPress={() => router.push('/admin/wallet-adjustments')}
        />
      </View>
    </ScrollView>
  );
}

function Shortcut({
  title, value, tint, onPress,
}: { title: string; value: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.shortcut, { backgroundColor: tint }]}>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutValue}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  h1: { ...typography.h1, color: colors.textPrimary, marginTop: 8 },
  sub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md,
    ...shadow.soft,
  },
  statLabel: { ...typography.tiny, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  statValue: { ...typography.h2, color: colors.textPrimary, marginTop: 6 },
  statSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  card: {
    marginTop: 12, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft,
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
  empty: { ...typography.caption, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, marginTop: 12, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '70%', backgroundColor: colors.primary, borderRadius: 6, minHeight: 4 },
  barLabel: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  barValue: { ...typography.tiny, color: colors.textMuted, fontWeight: '700', fontSize: 10 },

  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  statusLabel: { ...typography.body, color: colors.textPrimary, textTransform: 'capitalize' },
  statusCount: { ...typography.bodyBold, color: colors.textPrimary },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  topRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  topRankText: { ...typography.captionBold, color: colors.primary },
  topName: { ...typography.bodyBold, color: colors.textPrimary },
  topSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  topRev: { ...typography.bodyBold, color: colors.textPrimary },

  shortcut: {
    flex: 1, borderRadius: radii.lg, padding: spacing.md, minHeight: 80, justifyContent: 'space-between',
  },
  shortcutTitle: { ...typography.tiny, color: colors.textPrimary, fontWeight: '800', letterSpacing: 1 },
  shortcutValue: { ...typography.bodyBold, color: colors.textPrimary },
});
