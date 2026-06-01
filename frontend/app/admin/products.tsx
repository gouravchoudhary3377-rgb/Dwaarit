import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { TextField } from '@/src/components/ui/TextField';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type FormState = {
  product_id?: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  category: string;
  image_url: string;
  stock: string;
};

const EMPTY: FormState = { name: '', description: '', price: '', unit: 'ea', category: '', image_url: '', stock: '100' };

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(EMPTY); setErr(null); setShowForm(true); }
  function openEdit(p: Product) {
    setForm({
      product_id: p.product_id,
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      unit: p.unit,
      category: p.category,
      image_url: p.image_url ?? '',
      stock: String(p.stock ?? 100),
    });
    setErr(null);
    setShowForm(true);
  }

  async function save() {
    setErr(null);
    if (!form.name || !form.category || !form.price) { setErr('Name, category, price required'); return; }
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) { setErr('Invalid price'); return; }
    const stock = Number(form.stock) || 0;
    setSaving(true);
    try {
      const payload = { name: form.name, description: form.description, price, unit: form.unit, category: form.category, image_url: form.image_url, stock };
      if (form.product_id) {
        const updated = await api.patch<Product>(`/admin/products/${form.product_id}`, payload, token);
        setItems((prev) => prev.map((p) => p.product_id === updated.product_id ? updated : p));
      } else {
        const created = await api.post<Product>('/admin/products', payload, token);
        setItems((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    const confirm = () => {
      api.del(`/admin/products/${p.product_id}`, token)
        .then(() => setItems((prev) => prev.filter((x) => x.product_id !== p.product_id)))
        .catch((e) => Alert.alert('Delete failed', e?.message ?? ''));
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${p.name}"?`)) confirm();
    } else {
      Alert.alert('Delete product', `Are you sure you want to delete "${p.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Admin · Products</Text>
        <Pressable onPress={openCreate} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.product_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cat}>{item.category} · {item.unit}</Text>
                <Text style={styles.price}>{formatINR(item.price)} · stock {item.stock}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => openEdit(item)} style={[styles.smallBtn, styles.smallEdit]}>
                  <Text style={styles.smallEditText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)} style={[styles.smallBtn, styles.smallDel]}>
                  <Text style={styles.smallDelText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalRoot}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{form.product_id ? 'Edit product' : 'New product'}</Text>
              <ScrollView contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
                <TextField label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                <TextField label="Category" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} placeholder="Fruits, Dairy..." />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextField label="Price" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField label="Unit" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} placeholder="ea, kg, L" />
                  </View>
                </View>
                <TextField label="Stock" value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })} keyboardType="number-pad" />
                <TextField label="Image URL" value={form.image_url} onChangeText={(v) => setForm({ ...form, image_url: v })} autoCapitalize="none" />
                <TextField label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
                {err ? <Text style={{ color: colors.error, ...typography.caption }}>{err}</Text> : null}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title={form.product_id ? 'Save' : 'Create'} onPress={save} loading={saving} />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary },
  addBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.white, ...typography.bodyBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.sm, ...shadow.soft },
  thumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surface },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  cat: { ...typography.caption, color: colors.textSecondary },
  price: { ...typography.captionBold, color: colors.primary },
  smallBtn: { paddingHorizontal: 12, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  smallEdit: { backgroundColor: colors.primarySoft },
  smallEditText: { color: colors.primary, ...typography.tiny, fontWeight: '700' },
  smallDel: { backgroundColor: '#FCE8E6' },
  smallDelText: { color: colors.error, ...typography.tiny, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: '92%' },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  sheetTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
});
