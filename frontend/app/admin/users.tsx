import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type AdminUser = {
  user_id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  auth_provider: 'password' | 'google';
  mobile?: string | null;
  orders_count: number;
  total_spent: number;
};

const FILTERS: { key: 'all' | 'customer' | 'admin'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'customer', label: 'Customers' },
  { key: 'admin', label: 'Admins' },
];

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (filter !== 'all') params.set('role', filter);
      const list = await api.get<AdminUser[]>(`/admin/users?${params.toString()}`, token);
      setUsers(list || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, search, filter]);

  useEffect(() => { load(); }, [load]);

  async function toggleRole(u: AdminUser) {
    if (u.user_id === me?.user_id) {
      Alert.alert('Not allowed', 'You cannot change your own role here.');
      return;
    }
    const next = u.role === 'admin' ? 'customer' : 'admin';
    Alert.alert(
      'Change role',
      `Make ${u.email} a${next === 'admin' ? 'n admin' : ' customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBusy(u.user_id);
            try {
              await api.patch(`/admin/users/${u.user_id}/role`, { role: next }, token);
              setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, role: next } : x)));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to update role');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const counts = useMemo(() => ({
    all: users.length,
    customer: users.filter((u) => u.role === 'customer').length,
    admin: users.filter((u) => u.role === 'admin').length,
  }), [users]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.h1}>Users</Text>
        </View>

        {/* Search */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search email, name or mobile"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {/* Filter chips */}
        <View style={styles.chipsRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label} · {counts[f.key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.avatar, item.role === 'admin' && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarText, item.role === 'admin' && { color: colors.white }]}>
                    {(item.name || item.email || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                  {item.mobile ? <Text style={styles.meta}>📞 {item.mobile}</Text> : null}
                </View>
                <View style={[styles.rolePill, item.role === 'admin' && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.rolePillText, item.role === 'admin' && { color: colors.white }]}>{item.role}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Orders</Text>
                  <Text style={styles.statValue}>{item.orders_count}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Spent</Text>
                  <Text style={styles.statValue}>{formatINR(item.total_spent)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Provider</Text>
                  <Text style={styles.statValue}>{item.auth_provider}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.primarySoft, flex: 1 }]}
                  onPress={() => router.push({ pathname: '/admin/wallet-adjustments', params: { user_id: item.user_id, email: item.email } })}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>Wallet</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: item.role === 'admin' ? '#FFEBEE' : '#E8F5E9', flex: 1 }]}
                  onPress={() => toggleRole(item)}
                  disabled={busy === item.user_id}
                >
                  <Text style={[styles.actionText, { color: item.role === 'admin' ? colors.error : '#2E7D32' }]}>
                    {busy === item.user_id ? '…' : item.role === 'admin' ? 'Demote' : 'Promote'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No users match the filters.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  h1: { ...typography.h1, color: colors.textPrimary },
  search: {
    marginTop: 12, backgroundColor: colors.white, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.captionBold, color: colors.textPrimary },
  chipTextActive: { color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginBottom: 10, ...shadow.soft },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h3, color: colors.primary },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  meta: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },

  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  rolePillText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '800', textTransform: 'uppercase' },

  statsRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: 8, alignItems: 'center' },
  statLabel: { ...typography.tiny, color: colors.textMuted, fontWeight: '700' },
  statValue: { ...typography.captionBold, color: colors.textPrimary, marginTop: 2 },

  actionBtn: { paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  actionText: { ...typography.captionBold },

  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
