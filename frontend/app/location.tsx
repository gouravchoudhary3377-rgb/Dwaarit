import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import {
  AddressLabel,
  SavedAddress,
  displayLabel,
  makeAddressId,
  shortAddress,
  useAddressStore,
} from '@/src/store/addressStore';
import {
  GeocodeResult,
  reverseGeocode,
  searchAddresses,
} from '@/src/utils/geocoding';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radii, spacing, typography } from '@/src/theme';

/* ---------- Icons ---------- */
function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19l-7-7 7-7"
        stroke={colors.textPrimary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={colors.textMuted} strokeWidth={2} />
      <Path
        d="M20 20l-3.5-3.5"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
function CrosshairIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12l5 5L20 7"
        stroke={colors.white}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function EditIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4l10-10-4-4L4 16v4z"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ---------- Helpers ---------- */
function geocodeToDraft(g: GeocodeResult, label: AddressLabel = 'Home'): SavedAddress {
  return {
    id: makeAddressId(),
    label,
    full_name: '',
    phone: '',
    line1: g.line1,
    line2: g.line2,
    city: g.city,
    pincode: g.pincode,
    lat: g.lat,
    lng: g.lng,
    display_name: g.displayName,
  };
}

/* ---------- Screen ---------- */
type Mode = 'list' | 'edit';

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string }>();
  const { user } = useAuth();
  const addresses = useAddressStore((s) => s.addresses);
  const activeId = useAddressStore((s) => s.activeId);
  const upsert = useAddressStore((s) => s.upsert);
  const removeAddr = useAddressStore((s) => s.remove);
  const setActive = useAddressStore((s) => s.setActive);

  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState<SavedAddress | null>(null);
  const [draftIsNew, setDraftIsNew] = useState(true);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----- Debounced Nominatim search ----- */
  useEffect(() => {
    if (mode !== 'list') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchErr(null);
      return;
    }
    setSearching(true);
    setSearchErr(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchAddresses(q);
        setResults(data);
      } catch (e: any) {
        setSearchErr('Could not search. Try again.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  /* ----- GPS detect ----- */
  const detectCurrent = useCallback(async () => {
    setDetecting(true);
    try {
      // Check current permission status first
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (!perm.canAskAgain) {
          Alert.alert(
            'Location permission blocked',
            'Please enable location access for Dwaarit in Settings to auto-detect your address.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          if (!perm.canAskAgain) {
            Alert.alert(
              'Location permission needed',
              'Enable location access in Settings to use auto-detect.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
          }
          return;
        }
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const g = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const next = geocodeToDraft(g, addresses.length === 0 ? 'Home' : 'Other');
      next.full_name = user?.name ?? '';
      setDraft(next);
      setDraftIsNew(true);
      setMode('edit');
    } catch (e: any) {
      Alert.alert('Could not detect location', e?.message ?? 'Please try again.');
    } finally {
      setDetecting(false);
    }
  }, [addresses.length, user?.name]);

  const pickResult = (g: GeocodeResult) => {
    const next = geocodeToDraft(g, addresses.length === 0 ? 'Home' : 'Other');
    next.full_name = user?.name ?? '';
    setDraft(next);
    setDraftIsNew(true);
    setMode('edit');
    setQuery('');
    setResults([]);
  };

  const startManualNew = () => {
    setDraft({
      id: makeAddressId(),
      label: addresses.length === 0 ? 'Home' : 'Other',
      full_name: user?.name ?? '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      pincode: '',
    });
    setDraftIsNew(true);
    setMode('edit');
  };

  const startEdit = (addr: SavedAddress) => {
    setDraft({ ...addr });
    setDraftIsNew(false);
    setMode('edit');
  };

  const confirmDelete = (addr: SavedAddress) => {
    Alert.alert('Delete address?', `${displayLabel(addr)} — ${shortAddress(addr)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeAddr(addr.id) },
    ]);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.full_name || !draft.phone || !draft.line1 || !draft.city || !draft.pincode) {
      Alert.alert('Missing info', 'Please fill name, phone, address line 1, city, and PIN.');
      return;
    }
    if (draft.label === 'Other' && !draft.custom_label) {
      Alert.alert('Missing label', 'Please add a label for this address (e.g. Mom, Friend).');
      return;
    }
    upsert(draft);
    setActive(draft.id);
    setMode('list');
    setDraft(null);
    // If user came from checkout, go straight back
    if (params.from === 'checkout') router.back();
  };

  /* ============================================================
     Render — EDIT mode
     ============================================================ */
  if (mode === 'edit' && draft) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={() => {
              setMode('list');
              setDraft(null);
            }}
            style={styles.backBtn}
            hitSlop={10}
          >
            <BackArrow />
          </Pressable>
          <Text style={styles.headerTitle}>
            {draftIsNew ? 'Add address' : 'Edit address'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 180 }}
          keyboardShouldPersistTaps="handled"
        >
          {draft.display_name ? (
            <View style={styles.detectedCard}>
              <Text style={styles.detectedLabel}>Detected location</Text>
              <Text style={styles.detectedText} numberOfLines={3}>
                {draft.display_name}
              </Text>
            </View>
          ) : null}

          <Text style={styles.section}>Save as</Text>
          <View style={styles.labelRow}>
            {(['Home', 'Work', 'Other'] as AddressLabel[]).map((l) => {
              const active = draft.label === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setDraft({ ...draft, label: l })}
                  style={[styles.labelChip, active && styles.labelChipActive]}
                >
                  <Text
                    style={[
                      styles.labelChipText,
                      active && styles.labelChipTextActive,
                    ]}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {draft.label === 'Other' ? (
            <TextField
              label="Label (e.g. Mom's house)"
              value={draft.custom_label ?? ''}
              onChangeText={(t) => setDraft({ ...draft, custom_label: t })}
              placeholder="Custom label"
            />
          ) : null}

          <Text style={styles.section}>Contact</Text>
          <TextField
            label="Full name"
            value={draft.full_name}
            onChangeText={(t) => setDraft({ ...draft, full_name: t })}
          />
          <TextField
            label="Phone"
            value={draft.phone}
            onChangeText={(t) => setDraft({ ...draft, phone: t })}
            keyboardType="phone-pad"
          />

          <Text style={styles.section}>Address</Text>
          <TextField
            label="Address line 1"
            value={draft.line1}
            onChangeText={(t) => setDraft({ ...draft, line1: t })}
            placeholder="House / flat, street"
          />
          <TextField
            label="Address line 2"
            value={draft.line2}
            onChangeText={(t) => setDraft({ ...draft, line2: t })}
            placeholder="Landmark, area (optional)"
          />
          <TextField
            label="City"
            value={draft.city}
            onChangeText={(t) => setDraft({ ...draft, city: t })}
          />
          <TextField
            label="PIN / ZIP"
            value={draft.pincode}
            onChangeText={(t) => setDraft({ ...draft, pincode: t })}
            keyboardType="number-pad"
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <PrimaryButton title="Save address" onPress={saveDraft} testID="save-address-btn" />
        </View>
      </KeyboardAvoidingView>
    );
  }

  /* ============================================================
     Render — LIST mode
     ============================================================ */
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingTop: spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={styles.headerTitle}>Delivery location</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={results}
        keyExtractor={(_, i) => `r${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {/* Search */}
            <View style={styles.searchWrap}>
              <SearchIcon />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search area, street, landmark"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                testID="location-search-input"
              />
              {searching ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>

            {/* GPS */}
            <Pressable
              style={({ pressed }) => [styles.gpsBtn, pressed && { opacity: 0.85 }]}
              onPress={detectCurrent}
              disabled={detecting}
              testID="use-current-location-btn"
            >
              <CrosshairIcon />
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsTitle}>
                  {detecting ? 'Detecting your location…' : 'Use current location'}
                </Text>
                <Text style={styles.gpsSub}>
                  We use GPS to auto-fill the delivery address.
                </Text>
              </View>
              {detecting ? <ActivityIndicator color={colors.primary} /> : null}
            </Pressable>

            {/* Manual */}
            <Pressable
              style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.85 }]}
              onPress={startManualNew}
              testID="add-address-manual-btn"
            >
              <Text style={styles.manualText}>+ Add new address manually</Text>
            </Pressable>

            {searchErr ? <Text style={styles.errText}>{searchErr}</Text> : null}

            {results.length > 0 ? (
              <Text style={[styles.sectionHeading, { marginTop: spacing.sm }]}>
                Search results
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.8 }]}
            onPress={() => pickResult(item)}
          >
            <View style={styles.resultIcon}>
              <CrosshairIcon color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.line1 || item.displayName.split(',')[0]}
              </Text>
              <Text style={styles.resultSub} numberOfLines={2}>
                {item.displayName}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            {addresses.length > 0 ? (
              <Text style={styles.sectionHeading}>Saved addresses</Text>
            ) : null}
            {addresses.map((addr) => {
              const isActive = addr.id === activeId;
              return (
                <View
                  key={addr.id}
                  style={[styles.savedRow, isActive && styles.savedRowActive]}
                >
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                    onPress={() => {
                      setActive(addr.id);
                      if (params.from === 'checkout') router.back();
                    }}
                  >
                    <View style={[styles.labelTag, isActive && styles.labelTagActive]}>
                      <Text style={[styles.labelTagText, isActive && styles.labelTagTextActive]}>
                        {displayLabel(addr)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.savedName} numberOfLines={1}>
                        {addr.full_name || displayLabel(addr)}
                      </Text>
                      <Text style={styles.savedAddr} numberOfLines={2}>
                        {shortAddress(addr)}
                        {addr.pincode ? ` — ${addr.pincode}` : ''}
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={styles.activeBadge}>
                        <CheckIcon />
                      </View>
                    ) : null}
                  </Pressable>
                  <View style={styles.savedActions}>
                    <Pressable
                      onPress={() => startEdit(addr)}
                      style={styles.actionBtn}
                      hitSlop={8}
                    >
                      <EditIcon />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(addr)}
                      style={styles.actionBtn}
                      hitSlop={8}
                    >
                      <TrashIcon />
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {addresses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No saved addresses yet</Text>
                <Text style={styles.emptyText}>
                  Use current location or search above to add your first one.
                </Text>
              </View>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  clearText: { ...typography.captionBold, color: colors.primary },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  gpsTitle: { ...typography.bodyBold, color: colors.primary },
  gpsSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  manualBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
  },
  manualText: { ...typography.bodyBold, color: colors.textPrimary },

  sectionHeading: {
    ...typography.captionBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { ...typography.bodyBold, color: colors.textPrimary },
  resultSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  labelTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  labelTagActive: { backgroundColor: colors.white },
  labelTagText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '700' },
  labelTagTextActive: { color: colors.primary },
  savedName: { ...typography.bodyBold, color: colors.textPrimary },
  savedAddr: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedActions: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm, gap: 4 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
  },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },

  errText: { ...typography.caption, color: colors.error },

  /* edit mode */
  detectedCard: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  detectedLabel: { ...typography.tiny, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  detectedText: { ...typography.caption, color: colors.textPrimary, marginTop: 4 },

  section: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },

  labelRow: { flexDirection: 'row', gap: spacing.sm },
  labelChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { ...typography.bodyBold, color: colors.textSecondary },
  labelChipTextActive: { color: colors.white },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
