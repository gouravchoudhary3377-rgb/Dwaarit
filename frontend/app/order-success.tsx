import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

function Check() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
      <Circle cx={32} cy={32} r={28} fill={colors.primarySoft} />
      <Path d="M20 33l8 8 17-18" stroke={colors.primary} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function OrderSuccess() {
  const insets = useSafeAreaInsets();
  const { id, total } = useLocalSearchParams<{ id?: string; total?: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl }]}>
      <Check />
      <Text style={styles.title}>Order placed!</Text>
      <Text style={styles.sub}>We're packing your fresh groceries. You'll get an update once it's out for delivery.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.k}>Order ID</Text>
          <Text style={styles.v}>#{(id ?? '').slice(-8).toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Total</Text>
          <Text style={styles.v}>${Number(total ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Payment</Text>
          <Text style={styles.v}>Cash on Delivery</Text>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          title="Track order"
          onPress={() =>
            id
              ? router.replace({ pathname: '/order/[id]', params: { id: String(id) } })
              : router.replace('/(tabs)/orders')
          }
        />
        <PrimaryButton title="Back to home" variant="ghost" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  card: { width: '100%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.xl, ...shadow.soft, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { ...typography.body, color: colors.textSecondary },
  v: { ...typography.bodyBold, color: colors.textPrimary },
  actions: { width: '100%', gap: spacing.sm, marginTop: 'auto' },
});
