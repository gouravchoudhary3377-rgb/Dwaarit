import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { ProductCard } from '@/src/components/ProductCard';
import { CategoryPill } from '@/src/components/CategoryPill';
import { CartIcon } from '@/src/components/icons/TabIcons';
import { useCart } from '@/src/store/cartStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const cartCount = useCart((s) => s.lines.reduce((a, b) => a + b.quantity, 0));

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, cats] = await Promise.all([
        api.get<Product[]>('/products', token),
        api.get<{ categories: string[] }>('/products/categories', token),
      ]);
      setProducts(items);
      setCategories(['All', ...cats.categories]);
    } catch (e) {
      console.warn('home load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = activeCat === 'All' || p.category === activeCat;
      const q = query.trim().toLowerCase();
      const matchesQ = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [products, activeCat, query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
          <Text style={styles.title}>What's fresh today?</Text>
        </View>
        <Pressable
          style={styles.cartChip}
          onPress={() => router.push('/(tabs)/cart')}
          hitSlop={8}
        >
          <CartIcon color={colors.textPrimary} size={22} />
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search groceries..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {categories.map((c) => (
          <CategoryPill
            key={c}
            label={c}
            active={c === activeCat}
            onPress={() => setActiveCat(c)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.product_id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          renderItem={({ item }) => <ProductCard product={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No products match your search.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  hello: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.h2, color: colors.textPrimary, marginTop: 2 },
  cartChip: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  searchWrap: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: 10,
    ...shadow.soft,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 16 },
  catRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { ...typography.body, color: colors.textSecondary },
});
