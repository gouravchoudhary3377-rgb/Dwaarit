import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function PlusIcon({ color = colors.white }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.get<Product[]>('/products', token);
      setItems(list);
    } catch (e) {
      console.warn('admin products load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Refresh list whenever the screen regains focus (e.g. after returning from /admin/add-product)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCreate = () => router.push('/admin/add-product');
  const openEdit = (p: Product) =>
    router.push({ pathname: '/admin/add-product', params: { id: p.product_id } });

  async function remove(p: Product) {
    const doDelete = () => {
      api
        .del(`/admin/products/${p.product_id}`, token)
        .then(() => setItems((prev) => prev.filter((x) => x.product_id !== p.product_id)))
        .catch((e) => Alert.alert('Delete failed', e?.message ?? ''));
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${p.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete product', `Are you sure you want to delete "${p.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={openCreate} style={styles.addBtn} accessibilityRole="button">
          <PlusIcon />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.product_id}
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: insets.bottom + 120,
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
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptySub}>Tap “New” to add your first product.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openEdit(item)} style={styles.card}>
              <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cat} numberOfLines={1}>
                  {item.category} · {item.unit}
                </Text>
                <Text style={styles.price}>
                  {formatINR(item.price)} · stock {item.stock}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => openEdit(item)} style={[styles.smallBtn, styles.smallEdit]}>
                  <Text style={styles.smallEditText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} style={[styles.smallBtn, styles.smallDel]}>
                  <Text style={styles.smallDelText}>Delete</Text>
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
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    height: 42,
    ...shadow.soft,
  },
  addBtnText: { color: colors.white, ...typography.bodyBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: 4 },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textSecondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm,
    ...shadow.soft,
  },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surface },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  cat: { ...typography.caption, color: colors.textSecondary },
  price: { ...typography.captionBold, color: colors.primary },
  smallBtn: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallEdit: { backgroundColor: colors.primarySoft },
  smallEditText: { color: colors.primary, ...typography.tiny, fontWeight: '700' },
  smallDel: { backgroundColor: '#FCE8E6' },
  smallDelText: { color: colors.error, ...typography.tiny, fontWeight: '700' },
});
