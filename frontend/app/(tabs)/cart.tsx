import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CartLine, useCart } from '@/src/store/cartStore';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function QtyStepper({ line }: { line: CartLine }) {
  const setQty = useCart((s) => s.setQty);
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => setQty(line.product.product_id, line.quantity - 1)}
        style={styles.stepBtn}
        hitSlop={8}
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.qty}>{line.quantity}</Text>
      <Pressable
        onPress={() => setQty(line.product.product_id, line.quantity + 1)}
        style={styles.stepBtn}
        hitSlop={8}
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function Cart() {
  const insets = useSafeAreaInsets();
  const { lines, subtotal, clear } = useCart();
  const total = subtotal();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        {lines.length > 0 ? (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {lines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Browse fresh groceries and add them to your cart.</Text>
          <PrimaryButton
            title="Start shopping"
            onPress={() => router.replace('/(tabs)/home')}
            style={{ marginTop: spacing.lg, width: 220 }}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(l) => l.product.product_id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 220 }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Image source={{ uri: item.product.image_url }} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={styles.name}>{item.product.name}</Text>
                  <Text style={styles.unit}>{formatINR(item.product.price)} / {item.product.unit}</Text>
                  <Text style={styles.lineTotal}>{formatINR(item.product.price * item.quantity)}</Text>
                </View>
                <QtyStepper line={item} />
              </View>
            )}
          />
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>{formatINR(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryVal}>Free</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 4 }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>{formatINR(total)}</Text>
            </View>
            <PrimaryButton
              title="Proceed to checkout"
              onPress={() => router.push('/checkout')}
              style={{ marginTop: spacing.md }}
              testID="checkout-btn"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  clear: { ...typography.bodyBold, color: colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 8 },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
  },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surface },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  unit: { ...typography.caption, color: colors.textSecondary },
  lineTotal: { ...typography.captionBold, color: colors.primary, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 6, height: 38 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  stepBtnText: { ...typography.bodyBold, color: colors.textPrimary, marginTop: -2 },
  qty: { ...typography.bodyBold, color: colors.textPrimary, minWidth: 18, textAlign: 'center' },
  summary: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadow.card,
    gap: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...typography.body, color: colors.textSecondary },
  summaryVal: { ...typography.bodyBold, color: colors.textPrimary },
  totalLabel: { ...typography.h3, color: colors.textPrimary },
  totalVal: { ...typography.h3, color: colors.primary },
});
