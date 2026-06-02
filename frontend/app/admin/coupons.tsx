import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type Coupon = {
  code: string;
  title?: string;
  description?: string;
  discount_type: 'percent' | 'flat';
  value: number;
  min_order_value?: number;
  max_discount?: number | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  used_count?: number;
  active: boolean;
  expires_at?: string | null;
  created_at?: string;
};

type Draft = {
  code: string;
  title: string;
  description: string;
  discount_type: 'percent' | 'flat';
  value: string;
  min_order_value: string;
  max_discount: string;
  usage_limit: string;
  per_user_limit: string;
  active: boolean;
  expires_at: string; // ISO yyyy-mm-dd or empty
};

const emptyDraft: Draft = {
  code: '',
  title: '',
  description: '',
  discount_type: 'percent',
  value: '',
  min_order_value: '0',
  max_discount: '',
  usage_limit: '',
  per_user_limit: '1',
  active: true,
  expires_at: '',
};

export default function AdminCoupons() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<Coupon[]>('/admin/coupons', token);
      setCoupons(list || []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter((c) =>
      c.code.toLowerCase().includes(q)
      || (c.title || '').toLowerCase().includes(q)
      || (c.description || '').toLowerCase().includes(q),
    );
  }, [coupons, search]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setShowEditor(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setDraft({
      code: c.code,
      title: c.title || '',
      description: c.description || '',
      discount_type: c.discount_type,
      value: String(c.value ?? ''),
      min_order_value: String(c.min_order_value ?? 0),
      max_discount: c.max_discount != null ? String(c.max_discount) : '',
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
      per_user_limit: c.per_user_limit != null ? String(c.per_user_limit) : '',
      active: !!c.active,
      expires_at: c.expires_at ? String(c.expires_at).slice(0, 10) : '',
    });
    setShowEditor(true);
  }

  async function save() {
    if (!token) return;
    const code = draft.code.trim().toUpperCase();
    if (!editing && code.length < 2) {
      Alert.alert('Invalid code', 'Coupon code must be at least 2 characters.');
      return;
    }
    const valueNum = parseFloat(draft.value);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      Alert.alert('Invalid value', 'Discount value must be greater than 0.');
      return;
    }
    if (draft.discount_type === 'percent' && valueNum > 100) {
      Alert.alert('Invalid value', 'Percent cannot exceed 100.');
      return;
    }

    const expiresIso = draft.expires_at.trim()
      ? new Date(`${draft.expires_at.trim()}T23:59:59Z`).toISOString()
      : null;

    const payload: any = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      discount_type: draft.discount_type,
      value: valueNum,
      min_order_value: parseFloat(draft.min_order_value || '0') || 0,
      max_discount: draft.max_discount.trim() ? parseFloat(draft.max_discount) : null,
      usage_limit: draft.usage_limit.trim() ? parseInt(draft.usage_limit, 10) : null,
      per_user_limit: draft.per_user_limit.trim() ? parseInt(draft.per_user_limit, 10) : null,
      active: draft.active,
      expires_at: expiresIso,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/coupons/${editing.code}`, payload, token);
      } else {
        await api.post('/admin/coupons', { ...payload, code }, token);
      }
      setShowEditor(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Coupon) {
    if (!token) return;
    try {
      await api.patch(`/admin/coupons/${c.code}`, { active: !c.active }, token);
      setCoupons((prev) => prev.map((x) => (x.code === c.code ? { ...x, active: !c.active } : x)));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    }
  }

  function remove(c: Coupon) {
    if (!token) return;
    Alert.alert('Delete coupon', `Delete ${c.code}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/admin/coupons/${c.code}`, token);
            setCoupons((prev) => prev.filter((x) => x.code !== c.code));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete');
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.h1}>Coupons</Text>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.newBtn} onPress={openCreate}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search code, title…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.code}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.codePill, { backgroundColor: item.active ? colors.primarySoft : colors.surface }]}>
                  <Text style={[styles.codeText, { color: item.active ? colors.primary : colors.textMuted }]}>{item.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title || '—'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.discount_type === 'percent' ? `${item.value}% off` : `₹${item.value} off`}
                    {item.min_order_value ? ` · Min ₹${item.min_order_value}` : ''}
                    {item.max_discount ? ` · Up to ₹${item.max_discount}` : ''}
                  </Text>
                </View>
                <Switch value={!!item.active} onValueChange={() => toggleActive(item)} />
              </View>

              {!!item.description && (
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              )}

              <View style={styles.statsRow}>
                <Stat label="Used" value={String(item.used_count ?? 0)} />
                <Stat label="Limit" value={item.usage_limit != null ? String(item.usage_limit) : '∞'} />
                <Stat label="Per user" value={item.per_user_limit != null ? String(item.per_user_limit) : '∞'} />
                <Stat label="Expires" value={item.expires_at ? String(item.expires_at).slice(0, 10) : '—'} />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable style={[styles.actionBtn, { backgroundColor: colors.primarySoft, flex: 1 }]} onPress={() => openEdit(item)}>
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { backgroundColor: '#FFEBEE', flex: 1 }]} onPress={() => remove(item)}>
                  <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No coupons yet. Tap “+ New” to create one.</Text>}
        />
      )}

      {/* Editor modal */}
      <Modal visible={showEditor} animationType="slide" transparent>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? `Edit ${editing.code}` : 'New Coupon'}</Text>
              <Pressable onPress={() => setShowEditor(false)} hitSlop={8}>
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary }}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Field label="Code" hint="e.g. WELCOME50 (uppercase)">
                <TextInput
                  value={draft.code}
                  onChangeText={(t) => setDraft({ ...draft, code: t.toUpperCase() })}
                  editable={!editing}
                  placeholder="WELCOME50"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[styles.input, editing && { opacity: 0.6 }]}
                />
              </Field>
              <Field label="Title">
                <TextInput
                  value={draft.title}
                  onChangeText={(t) => setDraft({ ...draft, title: t })}
                  placeholder="50% off welcome"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </Field>
              <Field label="Description">
                <TextInput
                  value={draft.description}
                  onChangeText={(t) => setDraft({ ...draft, description: t })}
                  placeholder="Up to ₹100 off your first order"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { height: 70 }]}
                  multiline
                />
              </Field>

              <Field label="Discount type">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['percent', 'flat'] as const).map((t) => {
                    const active = draft.discount_type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setDraft({ ...draft, discount_type: t })}
                        style={[styles.typeChip, active && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, active && { color: colors.white }]}>
                          {t === 'percent' ? 'Percent (%)' : 'Flat (₹)'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label={draft.discount_type === 'percent' ? 'Value (%)' : 'Value (₹)'}>
                <TextInput
                  value={draft.value}
                  onChangeText={(t) => setDraft({ ...draft, value: t.replace(/[^0-9.]/g, '') })}
                  placeholder={draft.discount_type === 'percent' ? '20' : '50'}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>

              {draft.discount_type === 'percent' && (
                <Field label="Max discount (₹)" hint="Cap for percent discounts (optional)">
                  <TextInput
                    value={draft.max_discount}
                    onChangeText={(t) => setDraft({ ...draft, max_discount: t.replace(/[^0-9.]/g, '') })}
                    placeholder="100"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </Field>
              )}

              <Field label="Minimum order value (₹)">
                <TextInput
                  value={draft.min_order_value}
                  onChangeText={(t) => setDraft({ ...draft, min_order_value: t.replace(/[^0-9.]/g, '') })}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Total uses" hint="Leave empty = unlimited">
                    <TextInput
                      value={draft.usage_limit}
                      onChangeText={(t) => setDraft({ ...draft, usage_limit: t.replace(/[^0-9]/g, '') })}
                      placeholder="∞"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Per user" hint="Per-user cap">
                    <TextInput
                      value={draft.per_user_limit}
                      onChangeText={(t) => setDraft({ ...draft, per_user_limit: t.replace(/[^0-9]/g, '') })}
                      placeholder="1"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </Field>
                </View>
              </View>

              <Field label="Expires on" hint="YYYY-MM-DD (optional)">
                <TextInput
                  value={draft.expires_at}
                  onChangeText={(t) => setDraft({ ...draft, expires_at: t })}
                  placeholder="2025-12-31"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
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
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
  newBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  newBtnText: { ...typography.captionBold, color: colors.white },
  search: {
    marginTop: 12, backgroundColor: colors.white, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },

  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginBottom: 10, ...shadow.soft },
  codePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md },
  codeText: { ...typography.captionBold, letterSpacing: 0.5 },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  desc: { ...typography.caption, color: colors.textSecondary, marginTop: 8 },

  statsRow: { flexDirection: 'row', marginTop: 10, gap: 6 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: 8, alignItems: 'center' },
  statLabel: { ...typography.tiny, color: colors.textMuted, fontWeight: '700' },
  statValue: { ...typography.captionBold, color: colors.textPrimary, marginTop: 2 },

  actionBtn: { paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  actionText: { ...typography.captionBold },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },

  // Modal
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

  saveBtn: { marginTop: 16, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  saveBtnText: { ...typography.bodyBold, color: colors.white },
});
