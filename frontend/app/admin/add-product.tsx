import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, Category, Product } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { TextField } from '@/src/components/ui/TextField';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type FormState = {
  name: string;
  description: string;
  mrp: string;
  selling_price: string;
  self_price: string;
  unit: string;
  category: string;
  image_url: string;
  stock: string;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  mrp: '',
  selling_price: '',
  self_price: '',
  unit: 'ea',
  category: '',
  image_url: '',
  stock: '100',
};

const UNITS = ['ea', 'kg', 'g', 'L', 'ml', 'pack', 'dozen'];

function ChevronLeft({ color = colors.textPrimary }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon({ color = colors.white, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function CameraIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8a2 2 0 0 1 2-2h2l1.2-1.6A2 2 0 0 1 10.8 3.6h2.4a2 2 0 0 1 1.6.8L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z"
        stroke={color} strokeWidth={2}
      />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function GalleryIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke={color} strokeWidth={2} />
      <Path d="M3 16l5-5 5 5 3-3 5 5" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" fill={color} />
    </Svg>
  );
}

function LinkIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M10 14a4 4 0 0 1 0-5.66l3-3a4 4 0 1 1 5.66 5.66L17 12.34" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 10a4 4 0 0 1 0 5.66l-3 3a4 4 0 1 1-5.66-5.66L7 11.66" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PhotoIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v14H4z" stroke={color} strokeWidth={2} />
      <Path d="M4 17l5-5 4 4 3-3 4 4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export default function AddProductScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const isEdit = !!editId;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Bottom sheet & sub-modals
  const [showSheet, setShowSheet] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Add-category inline UI
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [creatingCat, setCreatingCat] = useState(false);

  // Curated gallery picker state
  const [galleryFilterSlug, setGalleryFilterSlug] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await api.get<Category[]>('/categories', token);
      setCategories(cats);
    } catch (e) {
      console.warn('categories load failed', e);
    } finally {
      setLoadingCats(false);
    }
  }, [token]);

  const loadProduct = useCallback(async () => {
    if (!editId) {
      // Coming back in "create" mode: ensure form is fully reset
      setForm(EMPTY);
      setLoadingProduct(false);
      return;
    }
    try {
      const products = await api.get<Product[]>('/products', token);
      const p = products.find((x) => x.product_id === editId);
      if (p) {
        setForm({
          name: p.name,
          description: p.description ?? '',
          mrp: p.mrp != null ? String(p.mrp) : String(p.price ?? ''),
          selling_price: p.selling_price != null ? String(p.selling_price) : String(p.price ?? ''),
          self_price: p.self_price != null ? String(p.self_price) : '',
          unit: p.unit,
          category: p.category,
          image_url: p.image_url ?? '',
          stock: String(p.stock ?? 100),
        });
      }
    } catch (e) {
      console.warn('product load failed', e);
    } finally {
      setLoadingProduct(false);
    }
  }, [editId, token]);

  useEffect(() => {
    loadCategories();
    loadProduct();
  }, [loadCategories, loadProduct]);

  const allCategoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ---------- Image picking ----------
  async function pickFromCamera() {
    setShowSheet(false);
    const perm = await ImagePicker.getCameraPermissionsAsync();
    let status = perm.status;
    let canAskAgain = perm.canAskAgain;
    if (status !== 'granted') {
      const req = await ImagePicker.requestCameraPermissionsAsync();
      status = req.status;
      canAskAgain = req.canAskAgain;
    }
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission needed',
        'Allow camera access to capture product photos.',
        canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      const dataUri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      update('image_url', dataUri);
    }
  }

  async function pickFromLibrary() {
    setShowSheet(false);
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    let canAskAgain = perm.canAskAgain;
    if (status !== 'granted') {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
      canAskAgain = req.canAskAgain;
    }
    if (status !== 'granted') {
      Alert.alert(
        'Photo library access needed',
        'Allow photo access to pick a product image.',
        canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      const dataUri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      update('image_url', dataUri);
    }
  }

  function openStockGallery() {
    setShowSheet(false);
    // Default filter to current category if available
    const slug = categories.find((c) => c.name === form.category)?.slug ?? null;
    setGalleryFilterSlug(slug);
    setShowGallery(true);
  }

  function openUrlInput() {
    setShowSheet(false);
    setUrlInput(form.image_url.startsWith('data:') ? '' : form.image_url);
    setShowUrl(true);
  }

  function applyUrl() {
    const v = urlInput.trim();
    if (!v) {
      setShowUrl(false);
      return;
    }
    if (!/^https?:\/\//i.test(v)) {
      Alert.alert('Invalid URL', 'Please paste a valid http(s) image URL.');
      return;
    }
    update('image_url', v);
    setShowUrl(false);
  }

  // ---------- Custom category creation ----------
  async function createCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const created = await api.post<Category>('/admin/categories', { name, icon: newCatIcon, gallery: [] }, token);
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      update('category', created.name);
      setShowNewCatInput(false);
      setNewCatName('');
      setNewCatIcon('🛒');
    } catch (e: any) {
      Alert.alert('Could not add category', e?.message ?? 'Please try again.');
    } finally {
      setCreatingCat(false);
    }
  }

  // ---------- Save ----------
  async function save() {
    setErr(null);
    if (!form.name.trim()) return setErr('Name is required.');
    if (!form.category.trim()) return setErr('Pick or create a category.');
    if (!form.selling_price.trim()) return setErr('Selling Price is required.');
    const selling_price = Number(form.selling_price);
    if (Number.isNaN(selling_price) || selling_price < 0) return setErr('Invalid Selling Price.');
    const mrp = form.mrp.trim() ? Number(form.mrp) : selling_price;
    if (Number.isNaN(mrp) || mrp < 0) return setErr('Invalid MRP.');
    if (mrp < selling_price) return setErr('MRP must be ≥ Selling Price.');
    const self_price = form.self_price.trim() ? Number(form.self_price) : 0;
    if (Number.isNaN(self_price) || self_price < 0) return setErr('Invalid Self Price.');
    const stock = Number(form.stock);
    if (Number.isNaN(stock) || stock < 0) return setErr('Invalid stock.');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: selling_price,
        mrp,
        selling_price,
        self_price,
        unit: form.unit.trim() || 'ea',
        category: form.category.trim(),
        image_url: form.image_url.trim(),
        stock,
      };
      if (isEdit && editId) {
        await api.patch<Product>(`/admin/products/${editId}`, payload, token);
      } else {
        await api.post<Product>('/admin/products', payload, token);
      }
      // Always go back to the products list and unmount this screen so a future
      // "New" tap starts with a clean form (no leftover ?id=).
      router.replace('/admin/products');
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ---------- Render ----------
  if (loadingProduct || loadingCats) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const galleryImages = (() => {
    if (galleryFilterSlug) {
      return categories.find((c) => c.slug === galleryFilterSlug)?.gallery ?? [];
    }
    return categories.flatMap((c) => c.gallery);
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <ChevronLeft />
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit product' : 'Add product'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 140, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Image picker */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>Product image</Text>
            <Pressable onPress={() => setShowSheet(true)} style={styles.imageDrop}>
              {form.image_url ? (
                <>
                  <Image source={{ uri: form.image_url }} style={styles.imagePreview} contentFit="cover" />
                  <View style={styles.imageEditChip}>
                    <Text style={styles.imageEditChipText}>Change</Text>
                  </View>
                </>
              ) : (
                <View style={styles.imageEmpty}>
                  <View style={styles.imageEmptyCircle}>
                    <PhotoIcon color={colors.primary} />
                  </View>
                  <Text style={styles.imageEmptyTitle}>Add product image</Text>
                  <Text style={styles.imageEmptySub}>Stock gallery, paste URL or camera</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Name */}
          <TextField
            label="Name"
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="e.g. Fresh Bananas"
            returnKeyType="next"
          />

          {/* Category chips */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {categories.map((c) => {
                const active = form.category === c.name;
                return (
                  <Pressable
                    key={c.slug}
                    onPress={() => update('category', c.name)}
                    style={[styles.catChip, active && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipIcon, active && { opacity: 1 }]}>{c.icon || '🏷️'}</Text>
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{c.name}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setShowNewCatInput((v) => !v)}
                style={[styles.catChip, styles.catChipAdd]}
              >
                <PlusIcon color={colors.primary} size={14} />
                <Text style={[styles.catChipText, { color: colors.primary }]}>Add new</Text>
              </Pressable>
            </ScrollView>

            {showNewCatInput && (
              <View style={styles.newCatBox}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
                  <View style={{ width: 68 }}>
                    <TextField
                      label="Icon"
                      value={newCatIcon}
                      onChangeText={setNewCatIcon}
                      maxLength={2}
                      style={{ textAlign: 'center', fontSize: 22 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="New category name"
                      value={newCatName}
                      onChangeText={setNewCatName}
                      placeholder="e.g. Frozen Foods"
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Cancel"
                      variant="ghost"
                      onPress={() => {
                        setShowNewCatInput(false);
                        setNewCatName('');
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Add" onPress={createCategory} loading={creatingCat} disabled={!newCatName.trim()} />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Pricing: MRP, Selling Price, Self Price */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>Pricing</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="MRP (₹)"
                  value={form.mrp}
                  onChangeText={(v) => update('mrp', v.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Selling (₹)"
                  value={form.selling_price}
                  onChangeText={(v) => update('selling_price', v.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Self (₹)"
                  value={form.self_price}
                  onChangeText={(v) => update('self_price', v.replace(/[^\d.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            </View>
            {(() => {
              const m = Number(form.mrp);
              const s = Number(form.selling_price);
              const c = Number(form.self_price);
              const hints: string[] = [];
              if (!Number.isNaN(m) && !Number.isNaN(s) && m > 0 && s > 0 && m > s) {
                const off = Math.round((1 - s / m) * 100);
                hints.push(`${off}% off MRP`);
              }
              if (!Number.isNaN(s) && !Number.isNaN(c) && s > 0 && c > 0) {
                const profit = s - c;
                const margin = s > 0 ? Math.round((profit / s) * 100) : 0;
                hints.push(`Profit ₹${profit.toFixed(2)} · ${margin}% margin`);
              }
              return hints.length ? (
                <Text style={styles.pricingHint}>{hints.join(' · ')}</Text>
              ) : null;
            })()}
          </View>

          {/* Unit */}
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
              {UNITS.map((u) => {
                const a = form.unit === u;
                return (
                  <Pressable key={u} onPress={() => update('unit', u)} style={[styles.unitChip, a && styles.unitChipActive]}>
                    <Text style={[styles.unitChipText, a && { color: colors.white }]}>{u}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Stock */}
          <TextField
            label="Stock"
            value={form.stock}
            onChangeText={(v) => update('stock', v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            placeholder="100"
          />

          {/* Description */}
          <TextField
            label="Description"
            value={form.description}
            onChangeText={(v) => update('description', v)}
            placeholder="Short description (optional)"
            multiline
            numberOfLines={3}
            style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }}
          />

          {err ? <Text style={styles.errText}>{err}</Text> : null}
        </ScrollView>

        {/* Sticky save bar */}
        <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <PrimaryButton title={isEdit ? 'Save changes' : 'Create product'} onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>

      {/* ---------- Bottom sheet: choose image source ---------- */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowSheet(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add product image</Text>
            <Text style={styles.sheetSub}>Pick a source</Text>

            <Pressable style={styles.sheetItem} onPress={openStockGallery}>
              <View style={styles.sheetIcon}><GalleryIcon /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Curated stock gallery</Text>
                <Text style={styles.sheetItemSub}>Pick from 45 ready-to-use images</Text>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={openUrlInput}>
              <View style={styles.sheetIcon}><LinkIcon /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Paste image URL</Text>
                <Text style={styles.sheetItemSub}>Use any direct image link</Text>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={pickFromCamera}>
              <View style={styles.sheetIcon}><CameraIcon /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Take a photo</Text>
                <Text style={styles.sheetItemSub}>Capture with device camera</Text>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={pickFromLibrary}>
              <View style={styles.sheetIcon}><PhotoIcon /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetItemTitle}>Choose from library</Text>
                <Text style={styles.sheetItemSub}>Pick from your photos</Text>
              </View>
            </Pressable>

            <View style={{ marginTop: spacing.sm }}>
              <PrimaryButton title="Cancel" variant="ghost" onPress={() => setShowSheet(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---------- Paste URL modal ---------- */}
      <Modal visible={showUrl} transparent animationType="fade" onRequestClose={() => setShowUrl(false)}>
        <View style={styles.urlBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={styles.urlCard}>
              <Text style={styles.sheetTitle}>Paste image URL</Text>
              <TextField
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://example.com/photo.jpg"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Cancel" variant="ghost" onPress={() => setShowUrl(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Use image" onPress={applyUrl} />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------- Stock gallery modal ---------- */}
      <Modal visible={showGallery} animationType="slide" onRequestClose={() => setShowGallery(false)}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowGallery(false)} style={styles.iconBtn} hitSlop={8}>
              <ChevronLeft />
            </Pressable>
            <Text style={styles.title}>Curated gallery</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingVertical: spacing.sm }}
            style={{ flexGrow: 0 }}
          >
            <Pressable
              onPress={() => setGalleryFilterSlug(null)}
              style={[styles.catChip, !galleryFilterSlug && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, !galleryFilterSlug && styles.catChipTextActive]}>All</Text>
            </Pressable>
            {categories.map((c) => {
              const a = galleryFilterSlug === c.slug;
              return (
                <Pressable key={c.slug} onPress={() => setGalleryFilterSlug(c.slug)} style={[styles.catChip, a && styles.catChipActive]}>
                  <Text style={[styles.catChipIcon]}>{c.icon || '🏷️'}</Text>
                  <Text style={[styles.catChipText, a && styles.catChipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {galleryImages.length === 0 ? (
            <View style={[styles.center, { flex: 1, padding: spacing.lg }]}>
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
                No curated images for this category yet. Try “All” or pick another source.
              </Text>
            </View>
          ) : (
            <FlatList
              data={galleryImages}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              numColumns={2}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
              columnWrapperStyle={{ gap: spacing.md }}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    update('image_url', item);
                    setShowGallery(false);
                  }}
                  style={styles.galleryTile}
                >
                  <Image source={{ uri: item }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h3, color: colors.textPrimary },
  sectionLabel: { ...typography.captionBold, color: colors.textSecondary },
  imageDrop: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageEditChip: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  imageEditChipText: { color: colors.primary, ...typography.captionBold },
  imageEmpty: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  imageEmptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  imageEmptySub: { ...typography.caption, color: colors.textSecondary },

  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipIcon: { fontSize: 16 },
  catChipText: { ...typography.captionBold, color: colors.textSecondary },
  catChipTextActive: { color: colors.white },
  catChipAdd: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },

  newCatBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  unitChip: {
    paddingHorizontal: 14,
    height: 56,
    minWidth: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { ...typography.bodyBold, color: colors.textSecondary },

  errText: { color: colors.error, ...typography.caption, textAlign: 'center' },

  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // bottom sheet
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceAlt,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemTitle: { ...typography.bodyBold, color: colors.textPrimary },
  sheetItemSub: { ...typography.caption, color: colors.textSecondary },

  // url modal
  urlBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  urlCard: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  galleryTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
});
