import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/Toast';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

// ─── Types ───────────────────────────────────────────────────────────────────
type Store = {
  store_id: string;
  code: string;
  name: string;
  manager_name?: string;
  phone?: string;
  email?: string;
  manager_email?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  delivery_radius_km?: number;
  open_time?: string;
  close_time?: string;
  is_active: boolean;
  inventory_count?: number;
  products_count?: number;
  driver_count?: number;
  created_at?: string;
};

const EMPTY_FORM: Partial<Store> = {
  name: '', code: '', manager_name: '', phone: '', email: '',
  manager_email: '', gst_number: '', address: '', city: '', state: '',
  pincode: '', lat: undefined, lng: undefined,
  delivery_radius_km: 5, open_time: '07:00', close_time: '23:00', is_active: true,
};

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AdminStores() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const toast = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [filterCity, setFilterCity] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created'>('name');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [form, setForm] = useState<Partial<Store>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<Store[]>('/admin/stores', token);
      setStores(data || []);
    } catch {
      toast.error('Could not load stores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Unique cities for filter
  const cities = useMemo(() => {
    const c = [...new Set(stores.map(s => s.city).filter(Boolean))].sort();
    return ['All', ...c];
  }, [stores]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = stores.filter(s => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
        || (s.city || '').toLowerCase().includes(q) || (s.manager_name || '').toLowerCase().includes(q);
      const matchCity = filterCity === 'All' || s.city === filterCity;
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? s.is_active : !s.is_active);
      return matchQ && matchCity && matchStatus;
    });
    if (sortBy === 'name') list = list.sort((a, b) => a.name.localeCompare(b.name));
    else list = list.sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);
    return list;
  }, [stores, searchQ, filterCity, filterStatus, sortBy]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function openAdd() {
    setEditingStore(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(s: Store) {
    setEditingStore(s);
    setForm({ ...s });
    setModalOpen(true);
  }

  async function onSave() {
    if (!form.name?.trim()) { Alert.alert('Required', 'Store name is required'); return; }
    setSaving(true);
    try {
      if (editingStore) {
        await api.patch(`/admin/stores/${editingStore.store_id}`, form, token);
        toast.success('Store updated');
      } else {
        await api.post('/admin/stores', form, token);
        toast.success('Store created');
      }
      setModalOpen(false);
      load(true);
    } catch (e: any) {
      Alert.alert('Error', e?.data?.detail || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(s: Store) {
    try {
      await api.patch(`/admin/stores/${s.store_id}`, { is_active: !s.is_active }, token);
      setStores(prev => prev.map(x => x.store_id === s.store_id ? { ...x, is_active: !x.is_active } : x));
      toast.success(s.is_active ? 'Store deactivated' : 'Store activated');
    } catch (e: any) {
      Alert.alert('Error', e?.data?.detail || 'Could not update status');
    }
  }

  async function onDelete(s: Store) {
    Alert.alert(
      'Delete Store',
      `Delete "${s.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/stores/${s.store_id}`, token);
              setStores(prev => prev.filter(x => x.store_id !== s.store_id));
              toast.success('Store deleted');
            } catch (e: any) {
              Alert.alert('Cannot Delete', e?.data?.detail || e?.message || 'Delete failed');
            }
          },
        },
      ],
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}><BackIcon /></Pressable>
        <Text style={styles.pageTitle}>Stores</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <PlusIcon />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatChip label="Total" value={stores.length} color={colors.primary} />
        <StatChip label="Active" value={stores.filter(s => s.is_active).length} color="#1E8E3E" />
        <StatChip label="Inactive" value={stores.filter(s => !s.is_active).length} color={colors.textMuted} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchQ}
          onChangeText={setSearchQ}
          placeholder="Search by name, code, city…"
          placeholderTextColor={colors.textMuted}
          clearButtonMode="always"
        />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {/* Status */}
        {(['all', 'active', 'inactive'] as const).map(s => (
          <Pressable key={s} onPress={() => setFilterStatus(s)} style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>{s[0].toUpperCase() + s.slice(1)}</Text>
          </Pressable>
        ))}
        <View style={styles.dividerV} />
        {/* Cities */}
        {cities.map(c => (
          <Pressable key={c} onPress={() => setFilterCity(c)} style={[styles.filterChip, filterCity === c && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filterCity === c && styles.filterChipTextActive]}>{c}</Text>
          </Pressable>
        ))}
        <View style={styles.dividerV} />
        {/* Sort */}
        <Pressable onPress={() => setSortBy(sortBy === 'name' ? 'created' : 'name')} style={styles.filterChip}>
          <Text style={styles.filterChipText}>Sort: {sortBy === 'name' ? 'A–Z' : 'Newest'}</Text>
        </Pressable>
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ ...typography.body, color: colors.textMuted }}>No stores found.</Text>
            </View>
          ) : (
            filtered.map(s => (
              <StoreCard
                key={s.store_id}
                store={s}
                onEdit={() => openEdit(s)}
                onDelete={() => onDelete(s)}
                onToggle={() => onToggleActive(s)}
                onInventory={() => router.push({ pathname: '/admin/store-inventory', params: { store_id: s.store_id } })}
                onDetail={() => router.push({ pathname: '/admin/store-detail', params: { store_id: s.store_id } })}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <StoreFormModal
          form={form}
          setForm={setForm}
          isEdit={!!editingStore}
          saving={saving}
          onSave={onSave}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </View>
  );
}

// ─── Store Card ───────────────────────────────────────────────────────────────
function StoreCard({ store: s, onEdit, onDelete, onToggle, onInventory, onDetail }: {
  store: Store;
  onEdit: () => void; onDelete: () => void; onToggle: () => void;
  onInventory: () => void; onDetail: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onDetail}>
      {/* Top row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.storeCode}>{s.code}</Text>
            <View style={[styles.statusBadge, { backgroundColor: s.is_active ? '#E6F9EE' : '#F5F5F5' }]}>
              <Text style={[styles.statusText, { color: s.is_active ? '#1E8E3E' : colors.textMuted }]}>
                {s.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          <Text style={styles.storeName}>{s.name}</Text>
          {s.city ? <Text style={styles.storeLocation}>{[s.city, s.state].filter(Boolean).join(', ')}</Text> : null}
        </View>
        <Switch
          value={s.is_active}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>

      {/* Info grid */}
      <View style={styles.infoGrid}>
        {s.manager_name ? <InfoCell label="Manager" value={s.manager_name} /> : null}
        {s.phone ? <InfoCell label="Phone" value={s.phone} /> : null}
        {s.delivery_radius_km ? <InfoCell label="Radius" value={`${s.delivery_radius_km} km`} /> : null}
        <InfoCell label="Hours" value={`${s.open_time || '—'} – ${s.close_time || '—'}`} />
        <InfoCell label="Products" value={String(s.products_count ?? 0)} />
        <InfoCell label="Inventory" value={String(s.inventory_count ?? 0)} />
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <ActionBtn label="Details" color={colors.primary} onPress={onDetail} />
        <ActionBtn label="Inventory" color="#1769E0" onPress={onInventory} />
        <ActionBtn label="Edit" color="#FF8F00" onPress={onEdit} />
        <ActionBtn label="Delete" color={colors.error} onPress={onDelete} />
      </View>
    </Pressable>
  );
}

// ─── Store Form Modal ─────────────────────────────────────────────────────────
function StoreFormModal({ form, setForm, isEdit, saving, onSave, onClose }: {
  form: Partial<Store>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Store>>>;
  isEdit: boolean; saving: boolean;
  onSave: () => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  function setF(key: keyof Store, val: any) { setForm(p => ({ ...p, [key]: val })); }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Modal header */}
      <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} hitSlop={8}><Text style={styles.cancelBtn}>Cancel</Text></Pressable>
        <Text style={styles.modalTitle}>{isEdit ? 'Edit Store' : 'Add Store'}</Text>
        <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <SectionTitle title="Basic Information" />
        <FormField label="Store Name *" value={form.name} onChangeText={v => setF('name', v)} placeholder="e.g. Flynkit Central" />
        <FormField label="Store Code" value={form.code} onChangeText={v => setF('code', v.toUpperCase())} placeholder="Auto-generated (STR001)" autoCapitalize="characters" />

        <SectionTitle title="Manager Details" />
        <FormField label="Manager Name" value={form.manager_name} onChangeText={v => setF('manager_name', v)} placeholder="Full name" />
        <FormField label="Phone" value={form.phone} onChangeText={v => setF('phone', v)} placeholder="+91 XXXXX XXXXX" keyboardType="phone-pad" />
        <FormField label="Email" value={form.email} onChangeText={v => setF('email', v)} placeholder="store@flynkit.com" keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Manager Email (for login)" value={form.manager_email} onChangeText={v => setF('manager_email', v)} placeholder="manager@flynkit.com" keyboardType="email-address" autoCapitalize="none" />
        <FormField label="GST Number (optional)" value={form.gst_number} onChangeText={v => setF('gst_number', v)} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />

        <SectionTitle title="Address" />
        <FormField label="Address" value={form.address} onChangeText={v => setF('address', v)} placeholder="Street / Area" multiline />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><FormField label="City" value={form.city} onChangeText={v => setF('city', v)} placeholder="Bengaluru" /></View>
          <View style={{ flex: 1 }}><FormField label="State" value={form.state} onChangeText={v => setF('state', v)} placeholder="Karnataka" /></View>
        </View>
        <FormField label="Pincode" value={form.pincode} onChangeText={v => setF('pincode', v)} placeholder="560001" keyboardType="number-pad" />

        <SectionTitle title="Location & Delivery" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><FormField label="Latitude" value={form.lat !== undefined ? String(form.lat) : ''} onChangeText={v => setF('lat', parseFloat(v) || undefined)} placeholder="12.9716" keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><FormField label="Longitude" value={form.lng !== undefined ? String(form.lng) : ''} onChangeText={v => setF('lng', parseFloat(v) || undefined)} placeholder="77.5946" keyboardType="decimal-pad" /></View>
        </View>
        <FormField label="Delivery Radius (km)" value={form.delivery_radius_km !== undefined ? String(form.delivery_radius_km) : ''} onChangeText={v => setF('delivery_radius_km', parseFloat(v) || 5)} placeholder="5" keyboardType="decimal-pad" />

        <SectionTitle title="Operating Hours" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><FormField label="Opening Time" value={form.open_time} onChangeText={v => setF('open_time', v)} placeholder="07:00" /></View>
          <View style={{ flex: 1 }}><FormField label="Closing Time" value={form.close_time} onChangeText={v => setF('close_time', v)} placeholder="23:00" /></View>
        </View>

        <SectionTitle title="Status" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Store Active</Text>
          <Switch
            value={form.is_active ?? true}
            onValueChange={v => setF('is_active', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Small Components ─────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statChip, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={styles.infoCellValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}
function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, { borderColor: color }, pressed && { opacity: 0.75 }]}>
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}
function FormField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline }: {
  label: string; value?: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 72, textAlignVertical: 'top' }]}
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
      />
    </View>
  );
}
function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white, gap: spacing.sm },
  backBtn: { padding: 4 },
  pageTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  addBtnText: { ...typography.captionBold, color: colors.white },

  statsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  statChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radii.md, borderWidth: 1.5 },
  statValue: { ...typography.h3 },
  statLabel: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },

  searchWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  searchInput: { backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10, ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },

  filterRow: { backgroundColor: colors.white, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 44 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterChipText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: colors.primary },
  dividerV: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Card
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.md, ...shadow.soft, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  storeCode: { ...typography.tiny, color: colors.primary, fontWeight: '800', backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  statusText: { ...typography.tiny, fontWeight: '700' },
  storeName: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 4 },
  storeLocation: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  infoCell: { backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90 },
  infoCellLabel: { ...typography.tiny, color: colors.textMuted, fontWeight: '600' },
  infoCellValue: { ...typography.captionBold, color: colors.textPrimary, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1.5 },
  actionBtnText: { ...typography.tiny, fontWeight: '700' },

  // Modal
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  cancelBtn: { ...typography.body, color: colors.textSecondary },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: radii.pill, minWidth: 60, alignItems: 'center' },
  saveBtnText: { ...typography.bodyBold, color: colors.white },

  // Form
  sectionTitle: { ...typography.captionBold, color: colors.textMuted, letterSpacing: 0.8, marginTop: spacing.sm },
  fieldWrap: { gap: 6 },
  fieldLabel: { ...typography.captionBold, color: colors.textSecondary },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 13 : 9, ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  switchLabel: { ...typography.body, color: colors.textPrimary },
});
