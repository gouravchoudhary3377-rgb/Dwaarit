import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type Banner = {
  banner_id: string;
  title: string;
  media_type: 'image' | 'video';
  media_url: string;
  link_url: string;
  order: number;
  active: boolean;
  created_at?: string;
};

type Draft = {
  title: string;
  media_type: 'image' | 'video';
  media_url: string;
  link_url: string;
  order: string;
  active: boolean;
};

const emptyDraft: Draft = {
  title: '',
  media_type: 'image',
  media_url: '',
  link_url: '',
  order: '0',
  active: true,
};

export default function AdminBanners() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<Banner[]>('/admin/banners', token);
      setBanners(list || []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft, order: String(banners.length) });
    setShowEditor(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setDraft({
      title: b.title || '',
      media_type: b.media_type || 'image',
      media_url: b.media_url || '',
      link_url: b.link_url || '',
      order: String(b.order ?? 0),
      active: !!b.active,
    });
    setShowEditor(true);
  }

  async function pickImage() {
    try {
      setPicking(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            'Permission needed',
            'Please enable Photos access in Settings to pick a banner image.',
          );
        }
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      if (!a.base64) {
        Alert.alert('Error', 'Could not read image data.');
        return;
      }
      const mime = a.mimeType || 'image/jpeg';
      setDraft((d) => ({ ...d, media_type: 'image', media_url: `data:${mime};base64,${a.base64}` }));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to pick image');
    } finally {
      setPicking(false);
    }
  }

  async function save() {
    if (!token) return;
    if (!draft.media_url.trim()) {
      Alert.alert('Missing media', draft.media_type === 'image'
        ? 'Pick an image or paste an image URL.'
        : 'Paste a video URL.');
      return;
    }
    const orderNum = parseInt(draft.order, 10);
    const payload: any = {
      title: draft.title.trim(),
      media_type: draft.media_type,
      media_url: draft.media_url.trim(),
      link_url: draft.link_url.trim(),
      order: Number.isFinite(orderNum) ? orderNum : 0,
      active: draft.active,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/banners/${editing.banner_id}`, payload, token);
      } else {
        await api.post('/admin/banners', payload, token);
      }
      setShowEditor(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Banner) {
    if (!token) return;
    try {
      await api.patch(`/admin/banners/${b.banner_id}`, { active: !b.active }, token);
      setBanners((prev) => prev.map((x) => (x.banner_id === b.banner_id ? { ...x, active: !b.active } : x)));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    }
  }

  function remove(b: Banner) {
    if (!token) return;
    Alert.alert('Delete banner', `Delete "${b.title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/admin/banners/${b.banner_id}`, token);
            setBanners((prev) => prev.filter((x) => x.banner_id !== b.banner_id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete');
          }
        },
      },
    ]);
  }

  async function move(b: Banner, direction: -1 | 1) {
    if (!token) return;
    const sorted = [...banners].sort((a, c) => (a.order ?? 0) - (c.order ?? 0));
    const idx = sorted.findIndex((x) => x.banner_id === b.banner_id);
    const target = idx + direction;
    if (target < 0 || target >= sorted.length) return;
    const other = sorted[target];
    const bOrder = b.order ?? 0;
    const oOrder = other.order ?? 0;
    // Optimistic
    setBanners((prev) =>
      prev.map((x) => {
        if (x.banner_id === b.banner_id) return { ...x, order: oOrder };
        if (x.banner_id === other.banner_id) return { ...x, order: bOrder };
        return x;
      }),
    );
    try {
      await Promise.all([
        api.patch(`/admin/banners/${b.banner_id}`, { order: oOrder }, token),
        api.patch(`/admin/banners/${other.banner_id}`, { order: bOrder }, token),
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reorder');
      load();
    }
  }

  const sortedList = [...banners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.h1}>Banners</Text>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.newBtn} onPress={openCreate} testID="admin-banner-new">
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>Home screen carousel · drag-free reorder with arrows</Text>
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedList}
          keyExtractor={(b) => b.banner_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.preview}>
                {item.media_type === 'image' && item.media_url ? (
                  <Image
                    source={{ uri: item.media_url }}
                    style={styles.previewImg}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <View style={styles.previewVideo}>
                    <Text style={{ fontSize: 36 }}>🎬</Text>
                    <Text style={styles.previewText} numberOfLines={1}>{item.media_url}</Text>
                  </View>
                )}
                {!item.active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveText}>HIDDEN</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title || 'Untitled banner'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.media_type.toUpperCase()} · order {item.order ?? 0}
                    {item.link_url ? ` · → ${item.link_url}` : ''}
                  </Text>
                </View>
                <Switch value={!!item.active} onValueChange={() => toggleActive(item)} />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.surface, opacity: index === 0 ? 0.4 : 1 }]}
                  disabled={index === 0}
                  onPress={() => move(item, -1)}
                >
                  <Text style={styles.actionText}>↑ Up</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.surface, opacity: index === sortedList.length - 1 ? 0.4 : 1 }]}
                  disabled={index === sortedList.length - 1}
                  onPress={() => move(item, 1)}
                >
                  <Text style={styles.actionText}>↓ Down</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.primarySoft, flex: 1 }]}
                  onPress={() => openEdit(item)}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => remove(item)}
                >
                  <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No banners yet. Tap "+ New" to create one.</Text>
          }
        />
      )}

      <Modal visible={showEditor} animationType="slide" transparent>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit banner' : 'New banner'}</Text>
              <Pressable onPress={() => setShowEditor(false)} hitSlop={8}>
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary }}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Field label="Title (optional)">
                <TextInput
                  value={draft.title}
                  onChangeText={(t) => setDraft({ ...draft, title: t })}
                  placeholder="Summer sale 50% off"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </Field>

              <Field label="Media type">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['image', 'video'] as const).map((t) => {
                    const active = draft.media_type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setDraft({ ...draft, media_type: t, media_url: '' })}
                        style={[styles.typeChip, active && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, active && { color: colors.white }]}>
                          {t === 'image' ? '🖼️ Image' : '🎬 Video URL'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {draft.media_type === 'image' ? (
                <Field label="Image" hint="Pick from device (stored as base64) or paste an image URL below.">
                  <Pressable
                    style={[styles.pickBtn, picking && { opacity: 0.6 }]}
                    onPress={pickImage}
                    disabled={picking}
                  >
                    <Text style={styles.pickBtnText}>
                      {picking ? 'Opening…' : draft.media_url ? 'Replace image' : 'Pick image from device'}
                    </Text>
                  </Pressable>
                  {draft.media_url ? (
                    <View style={styles.previewSmall}>
                      <Image source={{ uri: draft.media_url }} style={styles.previewSmallImg} contentFit="cover" />
                    </View>
                  ) : null}
                  <TextInput
                    value={draft.media_url.startsWith('data:') ? '' : draft.media_url}
                    onChangeText={(t) => setDraft({ ...draft, media_url: t })}
                    placeholder="…or paste image URL (https://…)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    style={[styles.input, { marginTop: 8 }]}
                  />
                </Field>
              ) : (
                <Field label="Video URL" hint="Direct mp4/HLS URL. Plays muted, looped, autoplay.">
                  <TextInput
                    value={draft.media_url}
                    onChangeText={(t) => setDraft({ ...draft, media_url: t })}
                    placeholder="https://example.com/banner.mp4"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </Field>
              )}

              <Field label="Link / deep-link (optional)" hint="e.g. /product/abc or category name">
                <TextInput
                  value={draft.link_url}
                  onChangeText={(t) => setDraft({ ...draft, link_url: t })}
                  placeholder="/product/xyz"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>

              <Field label="Order" hint="Lower numbers appear first.">
                <TextInput
                  value={draft.order}
                  onChangeText={(t) => setDraft({ ...draft, order: t.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </Field>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>Active</Text>
                <Switch value={draft.active} onValueChange={(v) => setDraft({ ...draft, active: v })} />
              </View>

              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create banner'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  h1: { ...typography.h1, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textMuted, marginTop: 4, marginLeft: 32 },
  newBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  newBtnText: { ...typography.captionBold, color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginBottom: 12, ...shadow.soft },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  previewVideo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  previewText: { ...typography.tiny, color: colors.textSecondary, marginTop: 6 },
  inactiveBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#000A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  inactiveText: { color: colors.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

  title: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  actionBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.md, alignItems: 'center' },
  actionText: { ...typography.captionBold, color: colors.textPrimary },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },

  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },

  fieldLabel: { ...typography.captionBold, color: colors.textPrimary, marginBottom: 6 },
  fieldHint: { ...typography.tiny, color: colors.textMuted, marginTop: 4 },
  input: {
    backgroundColor: colors.white, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
    ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { ...typography.captionBold, color: colors.textPrimary },

  pickBtn: { backgroundColor: colors.primarySoft, paddingVertical: 12, borderRadius: radii.md, alignItems: 'center' },
  pickBtnText: { ...typography.captionBold, color: colors.primary },
  previewSmall: { width: '100%', aspectRatio: 16 / 9, marginTop: 10, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surface },
  previewSmallImg: { width: '100%', height: '100%' },

  saveBtn: { marginTop: 16, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  saveBtnText: { ...typography.bodyBold, color: colors.white },
});
