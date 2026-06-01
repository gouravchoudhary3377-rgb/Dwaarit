import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/Toast';
import { storage } from '@/src/utils/storage';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type RiderProfile = {
  driver_id: string;
  name: string;
  email: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  status: string;
  is_online?: boolean;
  store_id?: string | null;
  docs?: { license_number?: string; rc_number?: string };
};

export default function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      const p = await api.get<RiderProfile>('/rider/me', token);
      setProfile(p);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>My Profile</Text>
      </View>
      {loading || !profile ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            <View style={[styles.statusBadge, statusColor(profile.status)]}>
              <Text style={styles.statusBadgeText}>{profile.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Contact</Text>
            <InfoRow label="Phone" value={profile.phone || '—'} />
            <InfoRow label="Email" value={profile.email} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Vehicle</Text>
            <InfoRow label="Type" value={profile.vehicle_type || '—'} />
            <InfoRow label="Number" value={profile.vehicle_number || '—'} />
          </View>

          {profile.docs ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Documents</Text>
              <InfoRow label="License No." value={profile.docs.license_number || '—'} />
              <InfoRow label="RC No." value={profile.docs.rc_number || '—'} />
            </View>
          ) : null}

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace('/(auth)/login');
            }}
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function statusColor(s: string) {
  if (s === 'approved') return { backgroundColor: '#E6F7EC', borderColor: '#34C759' };
  if (s === 'pending') return { backgroundColor: '#FFF7E6', borderColor: '#F5A623' };
  if (s === 'suspended' || s === 'rejected') return { backgroundColor: '#FDECEA', borderColor: '#FF3B30' };
  return { backgroundColor: colors.surfaceAlt, borderColor: colors.border };
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...(shadow as any).soft,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.primary },
  name: { ...typography.h3, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusBadgeText: { ...typography.tiny, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.4 },
  sectionLabel: {
    ...typography.captionBold,
    color: colors.textMuted,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
  },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: { ...typography.captionBold, color: colors.textPrimary },
  logoutBtn: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  logoutText: { ...typography.bodyBold, color: colors.error },
});
