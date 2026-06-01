import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { Product } from '@/src/api/client';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { useCart } from '@/src/store/cartStore';
import { formatINR } from '@/src/utils/format';

type Props = {
  product: Product;
  onPress?: () => void;
};

export function ProductCard({ product, onPress }: Props) {
  const add = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const inCart = lines.find((l) => l.product.product_id === product.product_id)?.quantity ?? 0;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/product/${product.product_id}`))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.image_url }}
          style={styles.image}
          contentFit="cover"
          transition={150}
        />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
        <Text style={styles.unit}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatINR(product.price)}</Text>
          <Pressable
            onPress={(e) => { e.stopPropagation(); add(product, 1); }}
            style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.94 }] }]}
            hitSlop={8}
            testID={`add-${product.product_id}`}
          >
            <Text style={styles.addBtnText}>{inCart > 0 ? `+${inCart}` : '+'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.sm,
    ...shadow.card,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: { width: '100%', height: '100%' },
  body: { paddingHorizontal: 4, paddingTop: spacing.sm, gap: 2 },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  unit: { ...typography.caption, color: colors.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  price: { ...typography.h3, color: colors.textPrimary },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.strong,
  },
  addBtnText: { color: colors.white, fontSize: 18, fontWeight: '700', marginTop: -2 },
});
