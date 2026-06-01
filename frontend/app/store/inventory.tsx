import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useToast } from '@/src/components/ui/Toast';
import { StoreApi, StoreProduct } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';
import { useStoreToken } from '@/src/hooks/useStoreToken';

export default function StoreInventoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ low?: string }>();
  const token = useStoreToken();
  const toast = useToast();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(params.low === '1');
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [stockInput, setStockInput] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await StoreApi.listProducts(token, search.trim() || undefined, lowOnly);
      setProducts(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, search, lowOnly, toast]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    const low = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
    const out = products.filter((p) => p.stock <= 0).length;
    return { low, out, total: products.length };
  }, [products]);

  const openEditor = (p: StoreProduct) => {
    setEditing(p);
    setStockInput(String(p.stock ?? 0));
  };

  const saveStock = async () => {
    if (!editing || !token) return;
    const n = parseInt(stockInput, 10);
    if (isNaN(n) || n < 0) {
      toast.error('Stock must be a number 0 or greater');
      return;
    }
    try {
      setSaving(true);
      await StoreApi.updateStock(token, editing.product_id, n);
      setProducts((prev) =>
        prev.map((p) => (p.product_id === editing.product_id ? { ...p, stock: n } : p)),
      );
      toast.success(`${editing.name} stock updated`);
      setEditing(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>
          {stats.total} products • {stats.low} low • {stats.out} out of stock
        </Text>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <Pressable
          onPress={() => setLowOnly((v) => !v)}
          style={[styles.toggleBtn, lowOnly && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, lowOnly && styles.toggleTextActive]}>Low stock</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={[styles.flex, styles.center, { padding: spacing.lg }]}>
          <Text style={styles.emptyTitle}>No products match</Text>
          <Text style={styles.emptySub}>Try clearing search or low-stock filter.</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.product_id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => <ProductRow p={item} onEdit={() => openEditor(item)} />}
        />
      )}

      <Modal
        visible={!!editing}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditing(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update stock</Text>
            {editing ? (
              <Text style={styles.modalSub} numberOfLines={2}>
                {editing.name} • current {editing.stock}
              </Text>
            ) : null}
            <TextInput
              style={styles.stockInput}
              value={stockInput}
              onChangeText={(t) => setStockInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setEditing(null)}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
                onPress={saveStock}
                disabled={saving}
              >
                <Text style={styles.modalBtnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProductRow({ p, onEdit }: { p: StoreProduct; onEdit: () => void }) {
  const stockColor =
    p.stock <= 0 ? colors.error : p.stock <= 5 ? '#B23F00' : colors.success;
  return (
    <Pressable onPress={onEdit} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={styles.thumbWrap}>
        {p.image ? (
          <Image source={{ uri: p.image }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.primarySoft }]} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pName} numberOfLines={2}>
          {p.name}
        </Text>
        <Text style={styles.pMeta} numberOfLines={1}>
          {p.unit || ''}{p.category ? ` • ${p.category}` : ''}
        </Text>
        <Text style={styles.pPrice}>{formatINR(p.price)}</Text>
      </View>
      <View style={styles.stockBox}>
        <Text style={[styles.stockNum, { color: stockColor }]}>{p.stock}</Text>
        <Text style={styles.stockLabel}>in stock</Text>
      </View>
    </Pressable>
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-5-5"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.caption, color: colors.textPrimary, paddingVertical: 0 },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: colors.white },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    alignItems: 'center',
    ...(shadow as any).soft,
  },
  thumbWrap: { width: 56, height: 56, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surface },
  thumb: { width: '100%', height: '100%' },
  pName: { ...typography.captionBold, color: colors.textPrimary },
  pMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  pPrice: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 4 },
  stockBox: { alignItems: 'flex-end' },
  stockNum: { ...typography.h3 },
  stockLabel: { ...typography.tiny, color: colors.textMuted },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  modalSub: { ...typography.caption, color: colors.textSecondary },
  stockInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modalBtnGhostText: { ...typography.captionBold, color: colors.textPrimary },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnPrimaryText: { ...typography.captionBold, color: colors.white },
});
