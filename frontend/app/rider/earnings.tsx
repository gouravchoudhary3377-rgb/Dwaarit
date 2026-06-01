import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useToast } from '@/src/components/ui/Toast';
import { storage } from '@/src/utils/storage';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type EarningsResp = {
  summary: { deliveries: number; earnings: number };
  by_day: { date: string; deliveries: number; earnings: number }[];
};

export default function RiderEarningsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [data, setData] = useState<EarningsResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      const resp = await api.get<EarningsResp>('/rider/earnings', token);
      setData(resp);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load earnings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const maxEarn = Math.max(1, ...(data?.by_day || []).map((d) => d.earnings));

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Earnings</Text>
      </View>
      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total earnings</Text>
            <Text style={styles.heroAmount}>{formatINR(data?.summary.earnings ?? 0)}</Text>
            <Text style={styles.heroSub}>{data?.summary.deliveries ?? 0} deliveries</Text>
          </View>

          <Text style={styles.sectionTitle}>Last 14 days</Text>
          {(data?.by_day || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No earnings yet.</Text>
            </View>
          ) : (
            (data?.by_day || []).map((d) => (
              <View key={d.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>{d.date}</Text>
                  <Text style={styles.dayAmount}>{formatINR(d.earnings)}</Text>
                </View>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(8, (d.earnings / maxEarn) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.dayMeta}>{d.deliveries} deliveries</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: spacing.sm, marginRight: spacing.xs },
  title: { ...typography.h3, color: colors.textPrimary },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...(shadow as any).strong,
  },
  heroLabel: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  heroAmount: { fontSize: 38, fontWeight: '800', color: colors.white, marginTop: spacing.xs },
  heroSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  emptyCard: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.md, alignItems: 'center' },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  dayCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayDate: { ...typography.captionBold, color: colors.textPrimary },
  dayAmount: { ...typography.bodyBold, color: colors.primary },
  barBg: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  dayMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.xs },
});
