import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { useCart } from '@/src/store/cartStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const add = useCart((s) => s.add);

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/products/${id}`)
      .then(setProduct)
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Product not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.heroWrap}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 8 }]}
            hitSlop={10}
          >
            <BackArrow />
          </Pressable>
          <Image source={{ uri: product.image_url }} style={styles.hero} contentFit="cover" />
        </View>
        <View style={styles.body}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>${product.price.toFixed(2)}</Text>
            <Text style={styles.unit}>/ {product.unit}</Text>
          </View>
          <Text style={styles.desc}>{product.description || 'No description.'}</Text>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={styles.stepBtn} hitSlop={8}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable onPress={() => setQty(qty + 1)} style={styles.stepBtn} hitSlop={8}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          title={`Add ${qty} to cart • $${(product.price * qty).toFixed(2)}`}
          onPress={() => { add(product, qty); router.back(); }}
          testID="add-to-cart"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { width: '100%', aspectRatio: 1.1, backgroundColor: colors.surface },
  hero: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute', left: spacing.md, zIndex: 10,
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  body: { padding: spacing.lg, gap: 8 },
  category: { ...typography.captionBold, color: colors.primary, textTransform: 'uppercase' },
  name: { ...typography.h1, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  price: { ...typography.h2, color: colors.textPrimary },
  unit: { ...typography.body, color: colors.textSecondary, marginBottom: 3 },
  desc: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 24 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  qtyLabel: { ...typography.bodyBold, color: colors.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 8, height: 44 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  stepBtnText: { ...typography.h3, color: colors.textPrimary, marginTop: -2 },
  qty: { ...typography.bodyBold, color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.white, ...shadow.card },
});
