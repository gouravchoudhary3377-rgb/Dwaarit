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
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { CategoryPillSkeleton } from '@/src/components/ui/Skeleton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

/* ---------- Pastel palette for category tiles ---------- */
const TILE_BG = [
  '#FFE8D6',
  '#E6F4EA',
  '#E3F2FD',
  '#FCE4EC',
  '#F3E5F5',
  '#FFF3E0',
  '#E8F5E9',
  '#E0F7FA',
  '#FFF8E1',
  '#F1F8E9',
];

function SearchIcon({ color = colors.textMuted }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={colors.textMuted}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type CategoryTile = {
  name: string;
  image: string;
  count: number;
  bg: string;
};

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [items, cats] = await Promise.all([
        api.get<Product[]>('/products', token),
        api.get<{ categories: string[] }>('/products/categories', token),
      ]);
      setProducts(items);
      setCategories(cats.categories);
    } catch (e) {
      console.warn('categories load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const tiles: CategoryTile[] = useMemo(() => {
    return categories.map((c, i) => {
      const sample = products.find((p) => p.category === c);
      return {
        name: c,
        image: sample?.image_url ?? '',
        count: products.filter((p) => p.category === c).length,
        bg: TILE_BG[i % TILE_BG.length],
      };
    });
  }, [categories, products]);

  const filteredTiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter((t) => t.name.toLowerCase().includes(q));
  }, [tiles, query]);

  const handlePress = (name: string) => {
    router.push(`/category/${encodeURIComponent(name)}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <Text style={styles.headerSub}>Browse everything by category · delivered in minutes</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search categories"
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
          <CategoryPillSkeleton count={9} />
        </View>
      ) : (
        <FlatList
          data={filteredTiles}
          keyExtractor={(t) => t.name}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{
            gap: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.xxl + insets.bottom,
          }}
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
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No categories found</Text>
              <Text style={styles.emptySub}>Try a different search term.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item.name)}
              style={({ pressed }) => [
                styles.card,
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
              ]}
            >
              <View style={[styles.thumbWrap, { backgroundColor: item.bg }]}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <Text style={{ fontSize: 36 }}>🛍️</Text>
                )}
              </View>
              <View style={styles.cardFooter}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.cardTitle}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardSub}>
                    {item.count} {item.count === 1 ? 'item' : 'items'}
                  </Text>
                </View>
                <Chevron />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  clearText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  thumbWrap: {
    aspectRatio: 1.25,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: '78%', height: '78%' },
  cardFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 38, marginBottom: spacing.sm },
  emptyText: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  emptySub: { ...typography.small, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
