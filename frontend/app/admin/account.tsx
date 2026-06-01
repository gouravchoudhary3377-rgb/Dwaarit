import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

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
      <PrimaryButton title="Sign out" variant="secondary" onPress={onSignOut} testID="admin-signout" />
    </ScrollView>
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
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  k: { ...typography.body, color: colors.textSecondary },
  v: { ...typography.bodyBold, color: colors.textPrimary },
});
