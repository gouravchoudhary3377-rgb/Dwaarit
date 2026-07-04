import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { ProductCard } from '@/src/components/ProductCard';
import { BannerCarousel } from '@/src/components/BannerCarousel';
import { CartIcon } from '@/src/components/icons/TabIcons';
import { ProductRowSkeleton, CategoryPillSkeleton } from '@/src/components/ui/Skeleton';
import { useCart } from '@/src/store/cartStore';
import { displayLabel, shortAddress, useAddressStore } from '@/src/store/addressStore';
import { useActiveStore } from '@/src/store/activeStoreStore';
import { useNearestStore } from '@/src/hooks/useNearestStore';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

/* ---------- Small inline icons ---------- */
function SearchIcon({ color = colors.textMuted }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PinIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} stroke={colors.textPrimary} strokeWidth={2} />
    </Svg>
  );
}

function ChevronDown() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BoltIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill={colors.primary} />
    </Svg>
  );
}

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
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const cartCount = useCart((s) => s.lines.reduce((a, b) => a + b.quantity, 0));
  const activeAddress = useAddressStore((s) =>
    s.activeId ? s.addresses.find((a) => a.id === s.activeId) ?? null : null,
  );
  const activeStore = useActiveStore((s) => s.store);
  const { resolve: resolveStore } = useNearestStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef<FlatList<any>>(null);

  // Resolve nearest store whenever active address changes
  useEffect(() => {
    if (activeAddress?.lat && activeAddress?.lng) {
      resolveStore(activeAddress.lat, activeAddress.lng);
    }
  }, [activeAddress?.lat, activeAddress?.lng]);

  const load = useCallback(async () => {
    try {
      const storeParam = activeStore ? `&store_id=${activeStore.store_id}` : '';
      const [items, cats] = await Promise.all([
        api.get<Product[]>(`/products?${storeParam}`, token),
        api.get<{ categories: string[] }>(`/products/categories?${storeParam}`, token),
      ]);
      setProducts(items);
      setCategories(cats.categories);
    } catch (e) {
      console.warn('home load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeStore?.store_id]);

  useEffect(() => {
    load();
  }, [load]);

  /* Filter products by category + search query */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = activeCat === 'All' || p.category === activeCat;
      const q = query.trim().toLowerCase();
      const matchesQ =
        !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [products, activeCat, query]);

  /* Build category tiles - pick first product image as thumbnail */
  const categoryTiles = useMemo(() => {
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

  /* Top picks - first 6 products */
  const topPicks = useMemo(() => products.slice(0, 6), [products]);

  const handleCategoryPress = (cat: string) => {
    setActiveCat((prev) => (prev === cat ? 'All' : cat));
    // Scroll to products section
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 380, animated: true });
    }, 50);
  };

  /* ---------- Header content above the product grid ---------- */
  const ListHeader = (
    <View>
      {/* Hero promo banner */}
      <Pressable
        style={styles.bannerOuter}
        onPress={() => router.push('/(tabs)/home')}
        activeOpacity={0.97}
      >
        <Image
          source={{ uri: 'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/jtjx7kma_flynkit%20home%20bbn.png' }}
          style={styles.heroBannerImg}
          contentFit="cover"
          transition={200}
        />
      </Pressable>

      {/* Categories grid */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
      </View>

      <View style={styles.tileGrid}>
        {categoryTiles.map((t) => {
          const isActive = activeCat === t.name;
          return (
            <Pressable
              key={t.name}
              onPress={() => handleCategoryPress(t.name)}
              style={({ pressed }) => [
                styles.tile,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <View
                style={[
                  styles.tileImageWrap,
                  { backgroundColor: t.bg },
                  isActive && styles.tileImageActive,
                ]}
              >
                {t.image ? (
                  <Image
                    source={{ uri: t.image }}
                    style={styles.tileImage}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <Text style={{ fontSize: 28 }}>🛍️</Text>
                )}
              </View>
              <Text numberOfLines={2} style={[styles.tileLabel, isActive && { color: colors.primary }]}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Top picks rail */}
      {topPicks.length > 0 && activeCat === 'All' && !query ? (
        <View>
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Top picks for you</Text>
            <Text style={styles.sectionLink}>See all</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {topPicks.map((p) => (
              <Pressable
                key={p.product_id}
                onPress={() => router.push(`/product/${p.product_id}`)}
                style={({ pressed }) => [styles.railCard, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.railImageWrap}>
                  <Image
                    source={{ uri: p.image_url }}
                    style={styles.railImage}
                    contentFit="cover"
                    transition={120}
                  />
                </View>
                <Text numberOfLines={1} style={styles.railName}>
                  {p.name}
                </Text>
                <Text style={styles.railUnit}>{p.unit}</Text>
                <Text style={styles.railPrice}>₹{p.price}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* All products header */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>
          {activeCat === 'All' ? 'All products' : activeCat}
        </Text>
        {activeCat !== 'All' ? (
          <Pressable onPress={() => setActiveCat('All')} hitSlop={8}>
            <Text style={styles.sectionLink}>Clear filter</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* --- Sticky top: location + cart --- */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.locWrap}
          hitSlop={8}
          onPress={() => router.push('/location')}
          testID="home-location-chip"
        >
          <View style={styles.boltChip}>
            <BoltIcon />
            <Text style={styles.boltText}>18 min</Text>
          </View>
          <View style={styles.locTextWrap}>
            <View style={styles.locTitleRow}>
              <PinIcon />
              <Text style={styles.locTitle} numberOfLines={1}>
                {activeAddress ? displayLabel(activeAddress) : 'Set delivery address'}
              </Text>
              <ChevronDown />
            </View>
            <Text style={styles.locSub} numberOfLines={1}>
              {activeStore
                ? `${activeStore.name} · ${activeStore.distance_km ? `${activeStore.distance_km.toFixed(1)} km` : 'Serving your area'}`
                : activeAddress
                ? `${shortAddress(activeAddress)} · 18 min delivery`
                : 'Tap to choose where to deliver'}
            </Text>
          </View>
        </Pressable>

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

      {/* --- Search bar --- */}
      <View style={styles.searchWrap}>
        <SearchIcon />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder='Search "fresh tomatoes"'
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

      {/* --- Admin-managed banner carousel (auto-scrolling, hides if empty) --- */}
      <BannerCarousel />

      {loading ? (
        <View style={{ paddingTop: spacing.md }}>
          <CategoryPillSkeleton count={6} />
          <View style={{ height: spacing.lg }} />
          <ProductRowSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(p) => p.product_id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{
            gap: spacing.md,
            paddingBottom: spacing.xxl + insets.bottom,
          }}
          ListHeaderComponent={ListHeader}
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
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyText}>
                Try a different category or search term.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  /* Top bar */
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topBarLogo: { width: 90, height: 44 },
  locWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  boltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  boltText: { ...typography.tiny, color: colors.primary, fontWeight: '700' },
  locTextWrap: { flex: 1 },
  locTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    maxWidth: 120,
  },
  locSub: {
    ...typography.tiny,
    color: colors.textSecondary,
    marginTop: 2,
  },

  cartChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  /* Search */
  searchWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  clearText: { ...typography.captionBold, color: colors.primary },

  /* Banner */
  bannerOuter: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  heroBannerImg: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  bannerTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFFEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  bannerTagText: { ...typography.tiny, color: colors.primary, fontWeight: '700' },
  bannerTitle: {
    ...typography.h2,
    color: colors.white,
    lineHeight: 28,
  },
  bannerSub: {
    ...typography.caption,
    color: '#FFFFFFD8',
    marginTop: 4,
  },
  bannerArt: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEmoji: { fontSize: 48 },

  /* Section header */
  sectionWrap: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionLink: { ...typography.captionBold, color: colors.primary },

  /* Category tile grid */
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg - 4,
    marginBottom: spacing.md,
  },
  tile: {
    width: '25%',
    paddingHorizontal: 4,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  tileImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileImageActive: {
    borderColor: colors.primary,
  },
  tileImage: { width: '78%', height: '78%' },
  tileLabel: {
    ...typography.tiny,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
    minHeight: 28,
  },

  /* Horizontal rail */
  rail: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  railCard: {
    width: 140,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  railImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  railImage: { width: '100%', height: '100%' },
  railName: { ...typography.captionBold, color: colors.textPrimary },
  railUnit: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  railPrice: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 4 },

  /* Misc */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
