import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? 'U';

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + spacing.md }]}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <Text style={styles.title}>Profile</Text>

      <View style={styles.hero}>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name ?? 'Guest'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{user?.role === 'admin' ? 'Admin' : 'Customer'}</Text>
        </View>
      </View>

      <View style={styles.list}>
        <Row label="Sign-in method" value={user?.auth_provider === 'google' ? 'Google' : 'Email & Password'} />
        <Row label="User ID" value={user?.user_id?.slice(0, 14) + '…'} />
      </View>

      <PrimaryButton title="Sign out" variant="secondary" onPress={onSignOut} testID="signout-btn" />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  hero: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, ...shadow.soft, gap: 6 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  avatarInitial: { color: colors.primary, fontSize: 40, fontWeight: '700' },
  name: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  email: { ...typography.body, color: colors.textSecondary },
  rolePill: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, marginTop: 4 },
  roleText: { color: colors.primary, ...typography.tiny, fontWeight: '700' },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowVal: { ...typography.bodyBold, color: colors.textPrimary },
});
