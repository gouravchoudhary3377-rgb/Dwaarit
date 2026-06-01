import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/components/ui/Toast';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

// ---------- Types ----------
type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type VehicleType = 'bike' | 'scooter' | 'cycle' | 'car';

type Driver = {
  driver_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_number?: string;
  store_id?: string | null;
  status: DriverStatus;
  is_online?: boolean;
  deliveries?: number;
  earnings?: number;
  created_at?: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  suspended_at?: string | null;
  docs?: {
    license_number?: string;
    license_image?: string;
    rc_number?: string;
    rc_image?: string;
    insurance_image?: string;
  };
};

type Store = {
  store_id: string;
  name: string;
  city?: string;
};

const FILTERS: Array<{ key: 'all' | DriverStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

const VEHICLES: Array<{ key: VehicleType; label: string; emoji: string }> = [
  { key: 'bike', label: 'Bike', emoji: '🏍️' },
  { key: 'scooter', label: 'Scooter', emoji: '🛵' },
  { key: 'cycle', label: 'Cycle', emoji: '🚲' },
  { key: 'car', label: 'Car', emoji: '🚗' },
];

// ---------- Component ----------
export default function DriversScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const toast = useToast();

  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [filter, setFilter] = useState<'all' | DriverStatus>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Driver | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('status', filter);
        if (q.trim()) params.set('q', q.trim());
        const path = `/admin/drivers${params.toString() ? `?${params.toString()}` : ''}`;
        const data = await api.get<Driver[]>(path, token);
        setDrivers(data);
      } catch (e: any) {
        toast.show(e?.message || 'Failed to load drivers', { kind: 'error' });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, q, token, toast],
  );

  const loadStores = useCallback(async () => {
    try {
      const s = await api.get<Store[]>('/admin/stores', token);
      setStores(s || []);
    } catch {
      // Stores are optional
    }
  }, [token]);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(false);
  }, [load]);

  // ---- Counts for filter chips ----
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 };
    (drivers || []).forEach((d) => {
      c.all += 1;
      c[d.status] = (c[d.status] || 0) + 1;
    });
    return c;
  }, [drivers]);

  // ---- Actions ----
  const doAction = useCallback(
    async (driverId: string, action: 'approve' | 'reject' | 'suspend' | 'delete') => {
      if (!isSuperAdmin) {
        toast.show('Only Super Admin can perform this action', { kind: 'error' });
        return;
      }
      setActingId(driverId);
      try {
        if (action === 'delete') {
          await api.del(`/admin/drivers/${driverId}`, token);
        } else {
          await api.post(`/admin/drivers/${driverId}/${action}`, {}, token);
        }
        toast.show(`Driver ${action}d`, { kind: 'success' });
        setDetail(null);
        load(false);
      } catch (e: any) {
        toast.show(e?.message || `Failed to ${action}`, { kind: 'error' });
      } finally {
        setActingId(null);
      }
    },
    [token, isSuperAdmin, toast, load],
  );

  // ---- Header ----
  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.h2}>Delivery Partners</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            Onboard, approve, and manage your rider fleet
          </Text>
        </View>
        {isSuperAdmin && (
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchIcon color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, email, phone, vehicle…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => load(false)}
        />
        {q.length > 0 && (
          <Pressable onPress={() => { setQ(''); setTimeout(() => load(false), 50); }} hitSlop={10}>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              <View style={[styles.chipCount, active && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, active && { color: colors.white }]}>
                  {counts[f.key] || 0}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // ---- Skeleton ----
  if (loading && !drivers) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={drivers || []}
        keyExtractor={(d) => d.driver_id}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <DriverCard
            driver={item}
            stores={stores}
            onOpen={() => setDetail(item)}
            onAction={isSuperAdmin ? doAction : undefined}
            acting={actingId === item.driver_id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 56, marginBottom: spacing.md }}>🛵</Text>
            <Text style={typography.h3}>No drivers found</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              {q ? 'Try a different search' : 'Add your first delivery partner to get started'}
            </Text>
            {isSuperAdmin && !q && (
              <Pressable onPress={() => setCreateOpen(true)} style={[styles.addBtn, { marginTop: spacing.lg }]}>
                <Text style={styles.addBtnText}>+ Add Driver</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Create modal */}
      <CreateDriverModal
        visible={createOpen}
        stores={stores}
        token={token}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          toast.show('Driver onboarded successfully', { kind: 'success' });
          load(false);
        }}
        onError={(msg) => toast.show(msg, { kind: 'error' })}
      />

      {/* Detail modal */}
      <DriverDetailModal
        driver={detail}
        stores={stores}
        canAct={isSuperAdmin}
        acting={!!actingId}
        onClose={() => setDetail(null)}
        onAction={doAction}
      />
    </View>
  );
}

// ---------- Driver card ----------
function DriverCard({
  driver,
  stores,
  onOpen,
  onAction,
  acting,
}: {
  driver: Driver;
  stores: Store[];
  onOpen: () => void;
  onAction?: (id: string, a: 'approve' | 'reject' | 'suspend' | 'delete') => void;
  acting: boolean;
}) {
  const store = stores.find((s) => s.store_id === driver.store_id);
  const initials = driver.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const vehicle = VEHICLES.find((v) => v.key === driver.vehicle_type);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
          {driver.is_online ? <View style={styles.onlineDot} /> : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[typography.bodyBold, { flexShrink: 1 }]} numberOfLines={1}>
              {driver.name}
            </Text>
            <StatusPill status={driver.status} />
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {driver.email} · {driver.phone}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6, flexWrap: 'wrap' }}>
            <Tag>{vehicle?.emoji} {vehicle?.label || driver.vehicle_type}</Tag>
            {driver.vehicle_number ? <Tag>{driver.vehicle_number}</Tag> : null}
            {store ? <Tag>📍 {store.name}</Tag> : null}
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Deliveries" value={String(driver.deliveries || 0)} />
        <Stat label="Earnings" value={formatINR(driver.earnings || 0)} />
        <Stat label="Status" value={driver.is_online ? 'Online' : 'Offline'} accent={driver.is_online ? colors.success : colors.textMuted} />
      </View>

      {onAction && driver.status !== 'rejected' && (
        <View style={styles.actionRow}>
          {driver.status === 'pending' && (
            <ActionBtn
              label="Approve"
              kind="primary"
              loading={acting}
              onPress={() => onAction(driver.driver_id, 'approve')}
            />
          )}
          {driver.status === 'pending' && (
            <ActionBtn
              label="Reject"
              kind="danger"
              loading={acting}
              onPress={() => onAction(driver.driver_id, 'reject')}
            />
          )}
          {driver.status === 'approved' && (
            <ActionBtn
              label="Suspend"
              kind="danger"
              loading={acting}
              onPress={() => onAction(driver.driver_id, 'suspend')}
            />
          )}
          {driver.status === 'suspended' && (
            <ActionBtn
              label="Re-approve"
              kind="primary"
              loading={acting}
              onPress={() => onAction(driver.driver_id, 'approve')}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ---------- Create Driver Modal ----------
function CreateDriverModal({
  visible,
  stores,
  token,
  onClose,
  onCreated,
  onError,
}: {
  visible: boolean;
  stores: Store[];
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setPassword('');
    setVehicleType('bike'); setVehicleNumber(''); setStoreId(null); setLicenseNumber('');
  };

  const submit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      onError('Name, email, phone and password are required');
      return;
    }
    if (password.length < 6) {
      onError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(
        '/admin/drivers',
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          vehicle_type: vehicleType,
          vehicle_number: vehicleNumber.trim(),
          store_id: storeId,
          docs: licenseNumber.trim() ? { license_number: licenseNumber.trim() } : undefined,
        },
        token,
      );
      reset();
      onCreated();
    } catch (e: any) {
      onError(e?.message || 'Failed to create driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={typography.h2}>Onboard Driver</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
              </Pressable>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Driver gets a rider account and can sign-in immediately. Status is set to Approved.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Full Name *">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Rajesh Kumar"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
              </Field>

              <Field label="Email *">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="rider@dwaarit.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label="Phone *">
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="9999999999"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      style={styles.input}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Password *">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min 6 chars"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      style={styles.input}
                    />
                  </Field>
                </View>
              </View>

              <Field label="Vehicle Type">
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {VEHICLES.map((v) => {
                    const active = vehicleType === v.key;
                    return (
                      <Pressable
                        key={v.key}
                        onPress={() => setVehicleType(v.key)}
                        style={[styles.vehicleChip, active && styles.vehicleChipActive]}
                      >
                        <Text style={{ fontSize: 16 }}>{v.emoji}</Text>
                        <Text style={[styles.vehicleChipText, active && { color: colors.white }]}>
                          {v.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Vehicle Number">
                <TextInput
                  value={vehicleNumber}
                  onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
                  placeholder="KA01AB1234"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </Field>

              <Field label="License Number (optional)">
                <TextInput
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  placeholder="DL-1420110012345"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </Field>

              {stores.length > 0 && (
                <Field label="Assign Store (optional)">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    <Pressable
                      onPress={() => setStoreId(null)}
                      style={[styles.storeChip, storeId === null && styles.storeChipActive]}
                    >
                      <Text style={[styles.storeChipText, storeId === null && { color: colors.white }]}>
                        Unassigned
                      </Text>
                    </Pressable>
                    {stores.map((s) => (
                      <Pressable
                        key={s.store_id}
                        onPress={() => setStoreId(s.store_id)}
                        style={[styles.storeChip, storeId === s.store_id && styles.storeChipActive]}
                      >
                        <Text style={[styles.storeChipText, storeId === s.store_id && { color: colors.white }]}>
                          {s.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </Field>
              )}
            </ScrollView>

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.9 },
                submitting && { opacity: 0.6 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Onboard Driver</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ---------- Driver Detail Modal ----------
function DriverDetailModal({
  driver,
  stores,
  canAct,
  acting,
  onClose,
  onAction,
}: {
  driver: Driver | null;
  stores: Store[];
  canAct: boolean;
  acting: boolean;
  onClose: () => void;
  onAction: (id: string, a: 'approve' | 'reject' | 'suspend' | 'delete') => void;
}) {
  const insets = useSafeAreaInsets();
  if (!driver) return null;
  const store = stores.find((s) => s.store_id === driver.store_id);
  const vehicle = VEHICLES.find((v) => v.key === driver.vehicle_type);
  const docs = driver.docs || {};

  return (
    <Modal visible={!!driver} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md, maxHeight: '85%' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h2} numberOfLines={1}>{driver.name}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: 4 }}>
                <StatusPill status={driver.status} />
                {driver.is_online ? (
                  <View style={[styles.onlineTag]}>
                    <View style={styles.onlineDotInline} />
                    <Text style={styles.onlineTagText}>Online</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailStats}>
              <Stat label="Deliveries" value={String(driver.deliveries || 0)} />
              <View style={styles.statDivider} />
              <Stat label="Total Earnings" value={formatINR(driver.earnings || 0)} accent={colors.primary} />
            </View>

            <SectionTitle>Contact</SectionTitle>
            <KV k="Email" v={driver.email} />
            <KV k="Phone" v={driver.phone} />

            <SectionTitle>Vehicle</SectionTitle>
            <KV k="Type" v={`${vehicle?.emoji || ''} ${vehicle?.label || driver.vehicle_type}`} />
            <KV k="Number" v={driver.vehicle_number || '—'} />
            <KV k="License" v={docs.license_number || '—'} />
            <KV k="RC Number" v={docs.rc_number || '—'} />

            <SectionTitle>Assignment</SectionTitle>
            <KV k="Store" v={store ? `${store.name}${store.city ? ` · ${store.city}` : ''}` : 'Unassigned'} />
            <KV k="Driver ID" v={driver.driver_id} />

            <SectionTitle>Timeline</SectionTitle>
            <KV k="Created" v={fmtDate(driver.created_at)} />
            {driver.approved_at ? <KV k="Approved" v={fmtDate(driver.approved_at)} /> : null}
            {driver.rejected_at ? <KV k="Rejected" v={fmtDate(driver.rejected_at)} /> : null}
            {driver.suspended_at ? <KV k="Suspended" v={fmtDate(driver.suspended_at)} /> : null}
          </ScrollView>

          {canAct && (
            <View style={styles.detailActions}>
              {driver.status === 'pending' && (
                <>
                  <ActionBtn label="Approve" kind="primary" loading={acting} onPress={() => onAction(driver.driver_id, 'approve')} />
                  <ActionBtn label="Reject" kind="danger" loading={acting} onPress={() => onAction(driver.driver_id, 'reject')} />
                </>
              )}
              {driver.status === 'approved' && (
                <ActionBtn label="Suspend" kind="danger" loading={acting} onPress={() => onAction(driver.driver_id, 'suspend')} />
              )}
              {driver.status === 'suspended' && (
                <ActionBtn label="Re-approve" kind="primary" loading={acting} onPress={() => onAction(driver.driver_id, 'approve')} />
              )}
              <ActionBtn label="Delete" kind="ghost" loading={acting} onPress={() => onAction(driver.driver_id, 'delete')} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------- Small UI helpers ----------
function StatusPill({ status }: { status: DriverStatus }) {
  const palette: Record<DriverStatus, { bg: string; fg: string; label: string }> = {
    pending: { bg: '#FFF4E5', fg: '#B86E00', label: 'Pending' },
    approved: { bg: '#E7F8EC', fg: '#1B7F3A', label: 'Approved' },
    rejected: { bg: '#FDECEA', fg: '#B42318', label: 'Rejected' },
    suspended: { bg: '#F3F1EF', fg: '#736F6D', label: 'Suspended' },
  };
  const p = palette[status];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodyBold, { color: accent || colors.textPrimary, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  label,
  kind,
  loading,
  onPress,
}: {
  label: string;
  kind: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
  onPress: () => void;
}) {
  const style =
    kind === 'primary' ? styles.btnPrimary : kind === 'danger' ? styles.btnDanger : styles.btnGhost;
  const textStyle =
    kind === 'primary' ? styles.btnPrimaryText : kind === 'danger' ? styles.btnDangerText : styles.btnGhostText;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
    >
      {loading ? <ActivityIndicator color={kind === 'primary' ? colors.white : colors.primary} size="small" /> : <Text style={textStyle}>{label}</Text>}
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{k}</Text>
      <Text style={[typography.captionBold, { color: colors.textPrimary, flexShrink: 1, textAlign: 'right' }]} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Header
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    minHeight: 40,
    justifyContent: 'center',
    ...shadow.strong,
  },
  addBtnText: { color: colors.white, ...typography.captionBold },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 0 },

  filters: { gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.captionBold, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  chipCount: { backgroundColor: colors.white, borderRadius: 10, minWidth: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  chipCountText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '700' },

  // Card
  card: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.bodyBold, color: colors.primary },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  onlineDotInline: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  onlineTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E7F8EC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  onlineTagText: { ...typography.tiny, color: '#1B7F3A', fontWeight: '700' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  pillText: { ...typography.tiny, fontWeight: '700' },

  tag: { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  tagText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  // Buttons
  btn: { flex: 1, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, ...typography.captionBold },
  btnDanger: { backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F3B3AC' },
  btnDangerText: { color: '#B42318', ...typography.captionBold },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textSecondary, ...typography.captionBold },

  // Empty
  empty: { padding: spacing.xl, alignItems: 'center', marginTop: spacing.xl },

  // Skeleton
  skeletonCard: {
    height: 132,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '92%',
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },

  fieldLabel: { ...typography.captionBold, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
    ...typography.body,
    color: colors.textPrimary,
  },

  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  vehicleChipText: { ...typography.captionBold, color: colors.textSecondary },

  storeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  storeChipText: { ...typography.captionBold, color: colors.textSecondary },

  submitBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadow.strong,
  },
  submitBtnText: { color: colors.white, ...typography.bodyBold },

  // Detail
  detailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: spacing.md },

  sectionTitle: { ...typography.captionBold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.sm },

  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },

  detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
