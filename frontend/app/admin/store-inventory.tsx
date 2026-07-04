import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type StoreDoc = { store_id: string; name: string; city: string };
type InvItem = {
  inv_id?: string;
  product_id: string;
  qty: number;
  selling_price: number;
  mrp: number;
  is_available: boolean;
  low_stock_threshold: number;
  product?: {
    name: string;
    image_url: string;
    category: string;
    unit: string;
  };
};

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function StoreInventoryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ store_id?: string }>();

  const [stores, setStores] = useState<StoreDoc[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreDoc | null>(null);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // product_id being saved
  const [filterQ, setFilterQ] = useState('');

  // Load stores list
  useEffect(() => {
    api.get<any[]>('/admin/stores', token).then((s) => {
      setStores(s || []);
      if (params.store_id) {
        const found = (s || []).find((x) => x.store_id === params.store_id);
        if (found) setSelectedStore(found);
      } else if (s?.length) {
        setSelectedStore(s[0]);
      }
    }).catch(() => {});
  }, [token]);

  // Load inventory for selected store
  const loadInventory = useCallback(async () => {
    if (!selectedStore || !token) return;
    setLoading(true);
    try {
      const res = await api.get<{ inventory: InvItem[] }>(
        `/admin/stores/${selectedStore.store_id}/inventory`, token
      );
      setInventory(res.inventory || []);
    } catch {
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, token]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  async function onUpdate(item: InvItem, field: string, value: any) {
    if (!selectedStore || !token) return;
    const updated = { ...item, [field]: value };
    setInventory((prev) => prev.map((i) => i.product_id === item.product_id ? updated : i));
    setSaving(item.product_id);
    try {
      await api.patch(
        `/admin/stores/${selectedStore.store_id}/inventory/${item.product_id}`,
        { [field]: value },
        token,
      );
    } catch {
      Alert.alert('Save failed', 'Could not update inventory');
      setInventory((prev) => prev.map((i) => i.product_id === item.product_id ? item : i));
    } finally {
      setSaving(null);
    }
  }

  async function onQtyChange(item: InvItem, raw: string) {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) return;
    await onUpdate(item, 'qty', n);
  }

  async function onPriceChange(item: InvItem, raw: string) {
    const n = parseFloat(raw);
    if (isNaN(n) || n <= 0) return;
    await onUpdate(item, 'selling_price', n);
  }

  const filtered = inventory.filter((i) => {
    if (!filterQ) return true;
    const q = filterQ.toLowerCase();
    return (
      (i.product?.name || '').toLowerCase().includes(q) ||
      (i.product?.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <BackArrow />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Store Inventory</Text>
          {selectedStore && (
            <Text style={styles.subtitle}>{selectedStore.name} · {selectedStore.city}</Text>
          )}
        </View>
      </View>

      {/* Store selector */}
      {stores.length > 1 && (
        <View style={styles.storeRow}>
          {stores.map((s) => (
            <Pressable
              key={s.store_id}
              onPress={() => setSelectedStore(s)}
              style={[styles.storeChip, selectedStore?.store_id === s.store_id && styles.storeChipActive]}
            >
              <Text style={[styles.storeChipText, selectedStore?.store_id === s.store_id && styles.storeChipTextActive]} numberOfLines={1}>
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={filterQ}
          onChangeText={setFilterQ}
          placeholder="Search products…"
          placeholderTextColor={colors.textMuted}
          clearButtonMode="always"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.product_id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: insets.bottom + 32 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ ...typography.body, color: colors.textMuted }}>No inventory records found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const busy = saving === item.product_id;
            const isOos = item.qty === 0 || !item.is_available;
            return (
              <View style={[styles.card, isOos && styles.cardOos]}>
                <View style={styles.cardTop}>
                  <Image
                    source={{ uri: item.product?.image_url }}
                    style={styles.thumb}
                    contentFit="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.product?.name ?? item.product_id}
                    </Text>
                    <Text style={styles.category}>{item.product?.category} · {item.product?.unit}</Text>
                    {isOos && <Text style={styles.oosTag}>Out of Stock</Text>}
                    {!isOos && item.qty <= (item.low_stock_threshold ?? 5) && (
                      <Text style={styles.lowTag}>Low stock — {item.qty} left</Text>
                    )}
                  </View>
                  {busy && <ActivityIndicator color={colors.primary} size="small" />}
                </View>

                <View style={styles.fieldsRow}>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={String(item.qty)}
                      onEndEditing={(e) => onQtyChange(item, e.nativeEvent.text)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Price (₹)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={String(item.selling_price)}
                      onEndEditing={(e) => onPriceChange(item, e.nativeEvent.text)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>MRP (₹)</Text>
                    <Text style={styles.fieldValue}>{formatINR(item.mrp)}</Text>
                  </View>
                  <View style={[styles.fieldWrap, { alignItems: 'center' }]}>
                    <Text style={styles.fieldLabel}>Available</Text>
                    <Switch
                      value={item.is_available}
                      onValueChange={(v) => onUpdate(item, 'is_available', v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  back: { padding: 4 },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  storeRow: {
    flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  storeChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radii.pill, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  storeChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  storeChipText: { ...typography.captionBold, color: colors.textSecondary },
  storeChipTextActive: { color: colors.primary },

  searchBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  searchInput: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    ...typography.body, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },

  card: {
    backgroundColor: colors.white, borderRadius: radii.lg,
    padding: spacing.md, gap: spacing.sm, ...shadow.soft,
  },
  cardOos: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  thumb: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.surface },
  productName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  category: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  oosTag: { ...typography.tiny, color: colors.error, fontWeight: '700', marginTop: 4 },
  lowTag: { ...typography.tiny, color: '#E65100', fontWeight: '700', marginTop: 4 },

  fieldsRow: {
    flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  fieldWrap: { flex: 1, minWidth: 70, gap: 4 },
  fieldLabel: { ...typography.tiny, color: colors.textMuted, fontWeight: '600' },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm,
    paddingHorizontal: 8, paddingVertical: 6,
    ...typography.captionBold, color: colors.textPrimary,
    textAlign: 'center', backgroundColor: colors.surface,
  },
  fieldValue: { ...typography.captionBold, color: colors.textSecondary, paddingVertical: 6 },
});
