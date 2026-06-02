import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { ProductCard } from '@/src/components/ProductCard';
import { ProductRowSkeleton } from '@/src/components/ui/Skeleton';
import { useCart } from '@/src/store/cartStore';
import { CartIcon } from '@/src/components/icons/TabIcons';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

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

function SearchIcon({ color = colors.textMuted }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function CategoryProductsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const cartCount = useCart((s) => s.lines.reduce((a, b) => a + b.quantity, 0));
  const params = useLocalSearchParams<{ name: string }>();
  const categoryName = useMemo(() => {
    const raw = Array.isArray(params.name) ? params.name[0] : params.name;
    return decodeURIComponent(raw ?? '');
  }, [params.name]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!categoryName) return;
    try {
      const items = await api.get<Product[]>(
        `/products?category=${encodeURIComponent(categoryName)}`,
        token,
      );
      setProducts(items);
    } catch (e) {
      console.warn('category products load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, categoryName]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <BackArrow />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>
            {categoryName || 'Category'}
          </Text>
          <Text style={styles.sub}>
            {loading ? 'Loading…' : `${products.length} ${products.length === 1 ? 'item' : 'items'}`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(tabs)/cart')}
          hitSlop={10}
        >
          <CartIcon color={colors.textPrimary} size={22} />
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search in ${categoryName || 'this category'}`}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingTop: spacing.lg }}>
          <ProductRowSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.product_id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{
            gap: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xxl + insets.bottom,
          }}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySub}>
                {query ? 'Try a different search term.' : 'Check back soon for fresh stock.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  searchWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  clearText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  emptySub: { ...typography.small, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
