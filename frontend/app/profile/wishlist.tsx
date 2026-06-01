import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { profileApi, WishlistItem } from '@/src/api/profile';
import { useCart } from '@/src/store/cartStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HeartFilled() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.error}>
      <Path d="M12 21s-7-4.35-10-9.5C-0.5 6.5 4 2.5 8 5c1.5.9 2.5 2.2 4 4 1.5-1.8 2.5-3.1 4-4 4-2.5 8.5 1.5 6 6.5-3 5.15-10 9.5-10 9.5z" />
    </Svg>
  );
}

export default function Wishlist() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const addToCart = useCart((s) => s.add);
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return setItems([]);
    try {
      const list = await profileApi.wishlist(token);
      setItems(list);
    } catch (e: any) {
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(productId: string) {
    if (!token) return;
    try {
      await profileApi.wishlistRemove(token, productId);
      setItems((curr) => (curr ?? []).filter((p) => p.product_id !== productId));
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message ?? 'Try again later.');
    }
  }

  function moveToCart(item: WishlistItem) {
    addToCart({
      product_id: item.product_id,
      name: item.name,
      image_url: item.image_url,
      unit: item.unit,
      price: item.price,
    });
    remove(item.product_id);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <HeartFilled />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyText}>Tap the heart on any product to save it for later.</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.push('/(tabs)/')}>
            <Text style={styles.shopBtnText}>Browse products</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.product_id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + 32, gap: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/product/${item.product_id}` as any)}
            >
              <View style={styles.imgWrap}>
                <Image source={{ uri: item.image_url }} style={styles.img} contentFit="cover" />
                <Pressable
                  style={styles.heartBtn}
                  onPress={() => remove(item.product_id)}
                  hitSlop={8}
                >
                  <HeartFilled />
                </Pressable>
              </View>
              <Text numberOfLines={2} style={styles.name}>
                {item.name}
              </Text>
              <Text style={styles.unit}>{item.unit}</Text>
              <View style={styles.bottomRow}>
                <Text style={styles.price}>{formatINR(item.price)}</Text>
                <Pressable style={styles.addBtn} onPress={() => moveToCart(item)}>
                  <Text style={styles.addBtnText}>ADD</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },

  emptyBox: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.sm },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  shopBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  shopBtnText: { ...typography.bodyBold, color: colors.white },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.sm,
    ...shadow.soft,
  },
  imgWrap: {
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.captionBold, color: colors.textPrimary, minHeight: 36 },
  unit: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: { ...typography.bodyBold, color: colors.textPrimary },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addBtnText: { ...typography.tiny, color: colors.primary, fontWeight: '800', letterSpacing: 0.5 },
});
