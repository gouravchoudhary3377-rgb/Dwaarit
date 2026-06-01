import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/src/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width: width as any, height: height as any, borderRadius: radius, backgroundColor: '#ECEAE7', opacity: pulse },
        style as any,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      <Skeleton width="100%" height={104} radius={14} />
      <Skeleton width="80%" height={14} radius={6} style={{ marginTop: spacing.sm }} />
      <Skeleton width="50%" height={12} radius={6} style={{ marginTop: 6 }} />
      <View style={styles.productFooter}>
        <Skeleton width={60} height={18} radius={6} />
        <Skeleton width={64} height={30} radius={radii.pill} />
      </View>
    </View>
  );
}

export function ProductRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function CategoryPillSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={[styles.row, { paddingHorizontal: spacing.md }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: 78, alignItems: 'center', marginRight: spacing.md }}>
          <Skeleton width={70} height={70} radius={radii.md} />
          <Skeleton width={56} height={10} radius={6} style={{ marginTop: spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

export function OrderRowSkeleton() {
  return (
    <View style={styles.orderRow}>
      <View style={{ flex: 1 }}>
        <Skeleton width="55%" height={14} radius={6} />
        <Skeleton width="40%" height={12} radius={6} style={{ marginTop: 8 }} />
        <Skeleton width="70%" height={12} radius={6} style={{ marginTop: 8 }} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Skeleton width={70} height={22} radius={radii.pill} />
        <Skeleton width={50} height={14} radius={6} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <OrderRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.md },
  productCard: {
    width: 160,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
