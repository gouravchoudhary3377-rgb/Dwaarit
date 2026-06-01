import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { StoreApi, StoreMe } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { useStoreToken } from '@/src/hooks/useStoreToken';

export default function StoreAccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const token = useStoreToken();
  const toast = useToast();
  const [me, setMe] = useState<StoreMe | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const m = await StoreApi.me(token);
      setMe(m);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.surface }]}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      <Text style={styles.title}>Account</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(me?.manager?.name || user?.name || 'M')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{me?.manager?.name || user?.name || 'Store Manager'}</Text>
          <Text style={styles.meta}>{me?.manager?.email || user?.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Store Manager</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : me?.store ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Assigned store</Text>
          <Text style={styles.storeName}>{me.store.name}</Text>
          {me.store.city ? <Text style={styles.storeMeta}>{me.store.city}</Text> : null}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: me.store.is_active ? colors.success : colors.textMuted },
              ]}
            />
            <Text style={styles.statusText}>
              {me.store.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Assigned store</Text>
          <Text style={styles.storeMeta}>No store linked yet. Contact your admin.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Row title="Dashboard" onPress={() => router.push('/store/dashboard')} />
        <Row title="All orders" onPress={() => router.push('/store/orders')} />
        <Row title="Riders" onPress={() => router.push('/store/drivers')} />
        <Row title="Inventory" onPress={() => router.push('/store/inventory')} />
      </View>

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/login');
        }}
        style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <Text style={styles.rowText}>{title}</Text>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M9 6l6 6-6 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.h2, color: colors.textPrimary, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  profileCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...(shadow as any).card,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: colors.primary },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  rolePillText: { ...typography.tiny, color: colors.primary, fontWeight: '700' },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    ...(shadow as any).soft,
  },
  cardLabel: { ...typography.tiny, color: colors.textSecondary, letterSpacing: 0.4 },
  storeName: { ...typography.h3, color: colors.textPrimary, marginTop: 4 },
  storeMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  section: { marginTop: spacing.md, paddingHorizontal: spacing.md, gap: 1 },
  row: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { ...typography.body, color: colors.textPrimary },
  logoutBtn: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoutText: { ...typography.captionBold, color: colors.error },
});
