import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { Product } from '@/src/api/client';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { useCart } from '@/src/store/cartStore';
import { formatINR } from '@/src/utils/format';

type Props = {
  product: Product;
  onPress?: () => void;
};

function BoltMini({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill={color} />
    </Svg>
  );
}

/**
 * Blinkit-style product card with:
 *  - Discount % ribbon (top-left)
 *  - Lightning ETA badge (top-right)
 *  - MRP strikethrough beside price
 *  - Low-stock / out-of-stock indicators
 *  - +/- quantity stepper that appears when item is in the cart
 */
export function ProductCard({ product, onPress }: Props) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);
  const inCart =
    lines.find((l) => l.product.product_id === product.product_id)?.quantity ?? 0;

  // Store-aware out-of-stock: prefer is_out_of_stock from inventory, fallback to catalog stock
  const outOfStock = (product as any).is_out_of_stock ?? (product.stock ?? 0) <= 0;
  const storeQty = (product as any).store_qty;
  const lowStock = !outOfStock && (
    storeQty !== undefined
      ? storeQty > 0 && storeQty <= ((product as any).low_stock_threshold ?? 5)
      : (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5
  );

  // Selling price (preferred) with backward-compat fallback to legacy `price`.
  const sellingPrice = product.selling_price ?? product.price;

  // Compute discount info defensively — server may not send mrp.
  const { mrp, discountPct } = useMemo(() => {
    let mrpVal = product.mrp ?? null;
    let pct = product.discount_percent ?? null;
    if (mrpVal && mrpVal > sellingPrice) {
      pct = pct ?? Math.round(((mrpVal - sellingPrice) / mrpVal) * 100);
    } else {
      mrpVal = null;
      pct = null;
    }
    return { mrp: mrpVal, discountPct: pct };
  }, [product.mrp, product.discount_percent, sellingPrice]);

  const eta = product.delivery_eta_min ?? 18;

  const handleAdd = () => {
    if (outOfStock) return;
    add(product, 1);
  };
  const handleInc = () => {
    if (inCart >= (product.stock ?? 99)) return;
    setQty(product.product_id, inCart + 1);
  };
  const handleDec = () => {
    setQty(product.product_id, Math.max(0, inCart - 1));
  };

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/product/${product.product_id}`))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`product-card-${product.product_id}`}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.image_url }}
          style={[styles.image, outOfStock && { opacity: 0.45 }]}
          contentFit="cover"
          transition={150}
        />

        {/* Discount ribbon */}
        {discountPct && discountPct > 0 ? (
          <View style={styles.discountRibbon}>
            <Text style={styles.discountText}>{discountPct}%{'\n'}OFF</Text>
          </View>
        ) : null}

        {/* ETA badge */}
        <View style={styles.etaBadge}>
          <BoltMini color={colors.white} />
          <Text style={styles.etaText}>{eta} MIN</Text>
        </View>

        {/* Out of stock veil */}
        {outOfStock ? (
          <View style={styles.oosWrap}>
            <Text style={styles.oosText}>Out of stock</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        <Text style={styles.unit}>{product.unit}</Text>

        {lowStock ? (
          <Text style={styles.lowStock}>Only {product.stock} left</Text>
        ) : null}

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.priceLine}>
              <Text style={styles.price}>{formatINR(sellingPrice)}</Text>
              {mrp ? (
                <Text style={styles.mrp}>{formatINR(mrp)}</Text>
              ) : null}
            </View>
            {discountPct && discountPct > 0 ? (
              <Text style={styles.offText}>{discountPct}% OFF</Text>
            ) : null}
          </View>

          {inCart > 0 ? (
            <View style={styles.stepper}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleDec();
                }}
                hitSlop={6}
                style={styles.stepBtn}
                testID={`dec-${product.product_id}`}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepQty}>{inCart}</Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleInc();
                }}
                hitSlop={6}
                style={styles.stepBtn}
                testID={`inc-${product.product_id}`}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleAdd();
              }}
              disabled={outOfStock}
              style={({ pressed }) => [
                styles.addBtn,
                outOfStock && styles.addBtnDisabled,
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
              hitSlop={8}
              testID={`add-${product.product_id}`}
            >
              <Text style={[styles.addBtnText, outOfStock && { color: colors.textMuted }]}>
                ADD
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },

  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },

  /* Top-left discount ribbon */
  discountRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#0C831F',
    borderTopLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  /* Top-right ETA badge */
  etaBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1A1512CC',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  etaText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /* OOS overlay */
  oosWrap: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#1A1512EE',
    borderRadius: radii.sm,
    paddingVertical: 4,
    alignItems: 'center',
  },
  oosText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  body: { paddingHorizontal: 2, paddingTop: spacing.sm, gap: 2 },
  name: {
    ...typography.captionBold,
    color: colors.textPrimary,
    minHeight: 36,
  },
  unit: { ...typography.tiny, color: colors.textSecondary },
  lowStock: {
    ...typography.tiny,
    color: '#E04F00',
    fontWeight: '700',
    marginTop: 2,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  price: { ...typography.bodyBold, color: colors.textPrimary },
  mrp: {
    ...typography.tiny,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },

  /* ADD button (initial) */
  addBtn: {
    minWidth: 64,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  addBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* +/- stepper (when in cart) */
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    height: 32,
    paddingHorizontal: 2,
  },
  stepBtn: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginTop: -2,
  },
  stepQty: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
});
