import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type AdminTicket = {
  ticket_id: string;
  user_id: string;
  user_email: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  updated_at: string;
  created_at: string;
};

const FILTERS: { key: 'all' | AdminTicket['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_TINT: Record<AdminTicket['status'], { bg: string; fg: string }> = {
  open: { bg: '#FFF3E0', fg: '#E65100' },
  pending: { bg: '#E3F2FD', fg: '#1565C0' },
  resolved: { bg: '#E8F5E9', fg: '#2E7D32' },
  closed: { bg: '#ECEFF1', fg: '#455A64' },
};

export default function AdminTickets() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<AdminTicket[]>('/support/admin/tickets', token);
      setTickets(list || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const visible = tickets.filter((t) => filter === 'all' || t.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Text style={styles.h1}>Support Tickets</Text>
        <Text style={styles.sub}>{tickets.length} total · {tickets.filter(t => t.status === 'open').length} open</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'all' ? tickets.length : tickets.filter((t) => t.status === f.key).length;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} · {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.ticket_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const tint = STATUS_TINT[item.status] || STATUS_TINT.open;
            return (
              <Pressable
                onPress={() => router.push(`/admin/ticket/${item.ticket_id}`)}
                android_ripple={{ color: colors.surface }}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.subject} numberOfLines={1}>{item.subject || 'Conversation'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{item.user_email}</Text>
                  <Text style={styles.metaSm}>
                    Updated {new Date(item.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.pillText, { color: tint.fg }]}>{item.status}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No tickets in this category yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { ...typography.h1, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  chipsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingTop: 12, flexWrap: 'wrap',
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.captionBold, color: colors.textPrimary },
  chipTextActive: { color: colors.white },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md,
    marginBottom: 10, ...shadow.soft,
  },
  subject: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  metaSm: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  pillText: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase' },

  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
