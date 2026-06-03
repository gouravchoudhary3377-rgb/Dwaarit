import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/src/context/AuthContext';
import { DwaaritMark } from '@/src/components/icons/TabIcons';
import { colors, spacing, typography } from '@/src/theme';

export default function Gate() {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'store_manager') {
      router.replace('/admin/orders');
    } else if (user.role === 'rider') {
      router.replace('/rider/dashboard');
    } else {
      router.replace('/(tabs)/home');
    }
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <DwaaritMark color={colors.primary} size={96} />
      <Text style={styles.brand}>Flynkit</Text>
      <Text style={styles.tag}>Fresh groceries at your doorstep</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brand: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.md },
  tag: { ...typography.caption, color: colors.textSecondary },
});
