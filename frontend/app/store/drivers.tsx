import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useToast } from '@/src/components/ui/Toast';
import { StoreApi, StoreDriver } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { useStoreToken } from '@/src/hooks/useStoreToken';

type FilterKey = 'all' | 'online' | 'offline' | 'pending';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'pending', label: 'Pending approval' },
];

export default function StoreDriversScreen() {
  const insets = useSafeAreaInsets();
  const token = useStoreToken();
  const toast = useToast();
  const [drivers, setDrivers] = useState<StoreDriver[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const status = filter === 'pending' ? 'pending' : undefined;
      const data = await StoreApi.listDrivers(token, status);
      setDrivers(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load riders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const visible = drivers.filter((d) => {
    if (filter === 'online') return !!d.online && d.status === 'approved';
    if (filter === 'offline') return !d.online && d.status === 'approved';
    return true;
  });

  const onlineCount = drivers.filter((d) => d.online && d.status === 'approved').length;

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Riders</Text>
        <Text style={styles.subtitle}>
          {onlineCount} online • {drivers.length} total at your store
        </Text>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : visible.length === 0 ? (
        <View style={[styles.flex, styles.center, { padding: spacing.lg }]}>
          <Text style={styles.emptyTitle}>No riders found</Text>
          <Text style={styles.emptySub}>Try a different filter or pull to refresh.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(d) => d.driver_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => <DriverCard d={item} onCall={(p) => Linking.openURL(`tel:${p}`)} />}
        />
      )}
    </View>
  );
}

function DriverCard({ d, onCall }: { d: StoreDriver; onCall: (phone: string) => void }) {
  const initials = (d.name || 'R')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const isApproved = d.status === 'approved';
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: d.online && isApproved ? colors.success : colors.textMuted },
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.driverName} numberOfLines={1}>
          {d.name || 'Rider'}
        </Text>
        <Text style={styles.driverMeta} numberOfLines={1}>
          {d.vehicle_type ? d.vehicle_type.toUpperCase() : 'BIKE'}
          {d.vehicle_number ? ` • ${d.vehicle_number}` : ''}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.tinyPill, { backgroundColor: isApproved ? '#E5F4EC' : '#FFF1E6' }]}>
            <Text
              style={[
                styles.tinyPillText,
                { color: isApproved ? '#0F7B3F' : '#B23F00' },
              ]}
            >
              {isApproved ? 'Approved' : (d.status || 'pending').toUpperCase()}
            </Text>
          </View>
          {typeof d.deliveries === 'number' ? (
            <Text style={styles.metaText}>📦 {d.deliveries}</Text>
          ) : null}
        </View>
      </View>
      {d.phone ? (
        <Pressable onPress={() => onCall(d.phone!)} style={styles.callBtn} hitSlop={8}>
          <PhoneIcon />
        </Pressable>
      ) : null}
    </View>
  );
}

function PhoneIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 5a2 2 0 012-2h2l2 5-2 1a11 11 0 005 5l1-2 5 2v2a2 2 0 01-2 2A16 16 0 015 5z"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    ...(shadow as any).soft,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { ...typography.bodyBold, color: colors.primary },
  statusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
  },
  driverName: { ...typography.bodyBold, color: colors.textPrimary },
  driverMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' },
  tinyPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill },
  tinyPillText: { ...typography.tiny, fontWeight: '700' },
  metaText: { ...typography.tiny, color: colors.textSecondary },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
