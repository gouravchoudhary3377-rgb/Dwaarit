import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { useCart } from '@/src/store/cartStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19l-7-7 7-7"
        stroke={colors.textPrimary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={colors.white}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQtyInCart = useCart((s) => s.setQty);

  const inCart = useMemo(
    () => lines.find((l) => l.product.product_id === id),
    [lines, id],
  );
  const inCartQty = inCart?.quantity ?? 0;

  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<Product>(`/products/${id}`)
      .then(async (p) => {
        setProduct(p);
        // Fetch related from same category
        try {
          const list = await api.get<Product[]>(
            `/products?category=${encodeURIComponent(p.category)}`,
          );
          setRelated(list.filter((x) => x.product_id !== p.product_id).slice(0, 6));
        } catch {
          setRelated([]);
        }
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, [id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setToastMsg(null));
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Product not found.</Text>
      </View>
    );
  }

  const stock = product.stock ?? 0;
  const outOfStock = stock <= 0;
  const stockLow = !outOfStock && stock <= 5;
  const maxQty = outOfStock ? 1 : Math.max(1, stock - inCartQty);
  const effectiveQty = Math.min(qty, maxQty);
  const reachedLimit = !outOfStock && inCartQty + effectiveQty >= stock;

  const handleAdd = () => {
    if (outOfStock) return;
    add(product, effectiveQty);
    showToast(
      inCartQty > 0
        ? `Updated • ${inCartQty + effectiveQty} in cart`
        : `Added ${effectiveQty} to cart`,
    );
    setQty(1);
  };

  const goToCart = () => router.push('/(tabs)/cart');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        <View style={styles.heroWrap}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 8 }]}
            hitSlop={10}
          >
            <BackArrow />
          </Pressable>

          {/* Stock badge */}
          <View style={[styles.stockBadge, { top: insets.top + 12 }]}>
            <View
              style={[
                styles.stockDot,
                {
                  backgroundColor: outOfStock
                    ? colors.error
                    : stockLow
                    ? '#F5A623'
                    : colors.success,
                },
              ]}
            />
            <Text style={styles.stockText}>
              {outOfStock ? 'Out of stock' : stockLow ? `Only ${stock} left` : 'In stock'}
            </Text>
          </View>

          <Image
            source={{ uri: product.image_url }}
            style={styles.hero}
            contentFit="cover"
          />
        </View>

        <View style={styles.body}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>{formatINR(product.price)}</Text>
            <Text style={styles.unit}>/ {product.unit}</Text>
          </View>

          {inCartQty > 0 && (
            <Pressable onPress={goToCart} style={styles.inCartChip} hitSlop={6}>
              <View style={styles.inCartCheck}>
                <CheckIcon />
              </View>
              <Text style={styles.inCartText}>
                {inCartQty} already in your cart
              </Text>
              <Text style={styles.inCartLink}>View</Text>
            </Pressable>
          )}

          <Text style={styles.descLabel}>About</Text>
          <Text style={styles.desc}>
            {product.description || 'A fresh pick handpicked for quality and value.'}
          </Text>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setQty(Math.max(1, qty - 1))}
                style={[styles.stepBtn, qty <= 1 && { opacity: 0.4 }]}
                hitSlop={8}
                disabled={qty <= 1}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{effectiveQty}</Text>
              <Pressable
                onPress={() => setQty(Math.min(maxQty, qty + 1))}
                style={[styles.stepBtn, reachedLimit && { opacity: 0.4 }]}
                hitSlop={8}
                disabled={reachedLimit}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          {reachedLimit && !outOfStock && (
            <Text style={styles.limitText}>
              You've reached the available stock for this item.
            </Text>
          )}

          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>You might also like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: spacing.lg, gap: spacing.md }}
              >
                {related.map((p) => (
                  <Pressable
                    key={p.product_id}
                    style={styles.relCard}
                    onPress={() => router.push(`/product/${p.product_id}`)}
                  >
                    <Image
                      source={{ uri: p.image_url }}
                      style={styles.relImg}
                      contentFit="cover"
                    />
                    <Text style={styles.relName} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={styles.relPrice}>{formatINR(p.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Toast */}
      {toastMsg && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 120,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toastCheck}>
            <CheckIcon />
          </View>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {inCartQty > 0 && !outOfStock && (
          <Pressable onPress={goToCart} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Go to cart</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title={
              outOfStock
                ? 'Out of stock'
                : inCartQty > 0
                ? `Add ${effectiveQty} more • ${formatINR(product.price * effectiveQty)}`
                : `Add ${effectiveQty} • ${formatINR(product.price * effectiveQty)}`
            }
            onPress={handleAdd}
            disabled={outOfStock}
            testID="add-to-cart"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { width: '100%', aspectRatio: 1.1, backgroundColor: colors.surface },
  hero: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  stockBadge: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radii.pill,
    ...shadow.soft,
  },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockText: { ...typography.tiny, color: colors.textPrimary, fontWeight: '600' },

  body: { padding: spacing.lg, gap: 8 },
  category: {
    ...typography.captionBold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  name: { ...typography.h1, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  price: { ...typography.h2, color: colors.textPrimary },
  unit: { ...typography.body, color: colors.textSecondary, marginBottom: 3 },

  inCartChip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  inCartCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartText: { flex: 1, ...typography.captionBold, color: colors.textPrimary },
  inCartLink: { ...typography.captionBold, color: colors.primary },

  descLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  desc: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 24,
  },

  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  qtyLabel: { ...typography.bodyBold, color: colors.textPrimary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    height: 44,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  stepBtnText: { ...typography.h3, color: colors.textPrimary, marginTop: -2 },
  qty: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  limitText: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'right',
  },

  relatedSection: { marginTop: spacing.xl, marginHorizontal: -spacing.lg },
  relatedTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  relCard: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 10,
    ...shadow.soft,
    marginLeft: spacing.lg,
  },
  relImg: {
    width: '100%',
    height: 100,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  relName: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginTop: 8,
    minHeight: 36,
  },
  relPrice: { ...typography.bodyBold, color: colors.primary, marginTop: 2 },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.pill,
    ...shadow.card,
  },
  toastCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { color: colors.white, ...typography.captionBold },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { ...typography.bodyBold, color: colors.textPrimary },
});
