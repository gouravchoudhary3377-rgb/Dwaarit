import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

export default function AdminAccount() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + spacing.md }]} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={styles.title}>Admin · Account</Text>
      <View style={styles.card}>
        <Row label="Name" value={user?.name} />
        <Row label="Email" value={user?.email} />
        <Row label="Role" value={user?.role} />
        <Row label="Provider" value={user?.auth_provider} />
      </View>

      <Text style={styles.section}>Manage</Text>
      <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
        <LinkRow
          label="Coupons"
          hint="Create, edit & toggle discount codes"
          onPress={() => router.push('/admin/coupons')}
          testID="admin-link-coupons"
        />
      </View>

      <PrimaryButton title="Sign out" variant="secondary" onPress={onSignOut} testID="admin-signout" />
    </ScrollView>
  );
}

function LinkRow({ label, hint, onPress, testID }: { label: string; hint?: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        {!!hint && <Text style={styles.linkHint}>{hint}</Text>}
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M9 6l6 6-6 6" stroke={colors.textMuted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  section: { ...typography.captionBold, color: colors.textMuted, marginTop: spacing.sm, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  k: { ...typography.body, color: colors.textSecondary },
  v: { ...typography.bodyBold, color: colors.textPrimary },
  linkRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkLabel: { ...typography.bodyBold, color: colors.textPrimary },
  linkHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
});
