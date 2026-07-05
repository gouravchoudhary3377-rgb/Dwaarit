import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type StoreDetail = {
  store_id: string;
  code: string;
  name: string;
  manager_name?: string;
  phone?: string;
  email?: string;
  manager_email?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  delivery_radius_km?: number;
  open_time?: string;
  close_time?: string;
  is_active: boolean;
  inventory_count?: number;
  products_count?: number;
  pending_orders?: number;
  completed_orders?: number;
  revenue?: number;
  created_at?: string;
};

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function StoreDetailScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { store_id } = useLocalSearchParams<{ store_id: string }>();
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!store_id) return;
    try {
      const data = await api.get<StoreDetail>(`/admin/stores/${store_id}`, token);
      setStore(data);
    } catch { }
    finally { setLoading(false); }
  }, [store_id, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
    </View>;
  }
  if (!store) {
    return <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.center}><Text style={{ color: colors.textMuted }}>Store not found.</Text></View>
    </View>;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><BackIcon /></Pressable>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeCode}>{store.code}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: store.is_active ? '#E6F9EE' : '#F5F5F5' }]}>
          <Text style={[styles.statusText, { color: store.is_active ? '#1E8E3E' : colors.textMuted }]}>
            {store.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + 32 }}>
        {/* KPI Stats */}
        <View style={styles.statsGrid}>
          <KpiCard label="Products" value={store.products_count ?? 0} color={colors.primary} />
          <KpiCard label="Inventory" value={store.inventory_count ?? 0} color="#1769E0" />
          <KpiCard label="Pending Orders" value={store.pending_orders ?? 0} color="#E65100" />
          <KpiCard label="Completed" value={store.completed_orders ?? 0} color="#1E8E3E" />
          <KpiCard label="Revenue" value={formatINR(store.revenue ?? 0)} color="#8E24AA" wide />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/admin/store-inventory', params: { store_id: store.store_id } })}
          >
            <Text style={styles.actionBtnText}>📦 Manage Inventory</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#1769E0' }]}
            onPress={() => router.push('/admin/orders')}
          >
            <Text style={styles.actionBtnText}>📋 View Orders</Text>
          </Pressable>
        </View>

        {/* Store Info */}
        <InfoCard title="Store Information">
          <InfoRow label="Store ID" value={store.store_id} />
          <InfoRow label="Code" value={store.code} />
          <InfoRow label="GST" value={store.gst_number} />
          <InfoRow label="Phone" value={store.phone} />
          <InfoRow label="Email" value={store.email} />
        </InfoCard>

        <InfoCard title="Manager">
          <InfoRow label="Name" value={store.manager_name} />
          <InfoRow label="Email" value={store.manager_email} />
        </InfoCard>

        <InfoCard title="Address">
          <InfoRow label="Address" value={store.address} />
          <InfoRow label="City" value={store.city} />
          <InfoRow label="State" value={store.state} />
          <InfoRow label="Pincode" value={store.pincode} />
        </InfoCard>

        <InfoCard title="Delivery & Hours">
          <InfoRow label="Latitude" value={store.lat !== undefined ? String(store.lat) : undefined} />
          <InfoRow label="Longitude" value={store.lng !== undefined ? String(store.lng) : undefined} />
          <InfoRow label="Delivery Radius" value={store.delivery_radius_km ? `${store.delivery_radius_km} km` : undefined} />
          <InfoRow label="Opening" value={store.open_time} />
          <InfoRow label="Closing" value={store.close_time} />
        </InfoCard>

        {store.created_at && (
          <Text style={styles.createdAt}>
            Created: {new Date(store.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, color, wide }: { label: string; value: number | string; color: string; wide?: boolean }) {
  return (
    <View style={[styles.kpiCard, wide && { width: '100%' }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  storeName: { ...typography.h3, color: colors.textPrimary },
  storeCode: { ...typography.tiny, color: colors.textSecondary },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  statusText: { ...typography.captionBold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, alignItems: 'center', ...shadow.soft },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { ...typography.tiny, color: colors.textMuted, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.lg, alignItems: 'center' },
  actionBtnText: { ...typography.bodyBold, color: colors.white },
  infoCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.md, gap: spacing.xs, ...shadow.soft },
  infoCardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.captionBold, color: colors.textPrimary, flex: 2, textAlign: 'right' },
  createdAt: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },
});
