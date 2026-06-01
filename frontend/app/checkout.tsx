import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/store/cartStore';
import {
  displayLabel,
  shortAddress,
  useAddressStore,
} from '@/src/store/addressStore';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

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

function PlusIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={colors.primary}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PinSmall({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-7.58 7-13a7 7 0 10-14 0c0 5.42 7 13 7 13z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const total = subtotal();

  const addresses = useAddressStore((s) => s.addresses);
  const activeId = useAddressStore((s) => s.activeId);
  const setActive = useAddressStore((s) => s.setActive);

  const [selectedId, setSelectedId] = useState<string | null>(activeId);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Keep selection in sync with activeId when user returns from /location
  useEffect(() => {
    if (activeId && !selectedId) setSelectedId(activeId);
    if (selectedId && !addresses.some((a) => a.id === selectedId)) {
      setSelectedId(activeId);
    }
  }, [activeId, addresses, selectedId]);

  const selected = useMemo(
    () => addresses.find((a) => a.id === selectedId) ?? null,
    [addresses, selectedId],
  );

  const canPlace = !!selected && lines.length > 0 && !placing;

  function chooseAddress(id: string) {
    setSelectedId(id);
    setActive(id);
  }

  async function placeOrder() {
    setErr(null);
    if (!selected) {
      setErr('Please select a delivery address');
      return;
    }
    if (!lines.length) {
      setErr('Your cart is empty');
      return;
    }
    setPlacing(true);
    try {
      const resp = await api.post<{ order_id: string; total: number }>(
        '/orders',
        {
          items: lines.map((l) => ({
            product_id: l.product.product_id,
            quantity: l.quantity,
          })),
          address: {
            full_name: selected.full_name,
            phone: selected.phone,
            line1: selected.line1,
            line2: selected.line2 ?? '',
            city: selected.city,
            pincode: selected.pincode,
          },
          payment_method: 'cod',
          notes,
        },
        token,
      );
      clear();
      router.replace({
        pathname: '/order-success',
        params: { id: resp.order_id, total: String(resp.total) },
      });
    } catch (e: any) {
      setErr(e?.message ?? 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <BackArrow />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 200,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Delivery address</Text>

        {addresses.length === 0 ? (
          <View style={styles.emptyAddrCard}>
            <Text style={styles.emptyTitle}>No saved addresses yet</Text>
            <Text style={styles.emptySub}>
              Add a delivery address to continue with checkout.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {addresses.map((a) => {
              const sel = a.id === selectedId;
              return (
                <Pressable
                  key={a.id}
                  testID={`address-card-${a.id}`}
                  onPress={() => chooseAddress(a.id)}
                  style={[styles.addrCard, sel && styles.addrCardActive]}
                >
                  <View style={[styles.radio, sel && styles.radioActive]}>
                    {sel ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.addrTitleRow}>
                      <View
                        style={[
                          styles.labelChip,
                          { backgroundColor: sel ? colors.primarySoft : colors.surface },
                        ]}
                      >
                        <PinSmall color={sel ? colors.primary : colors.textSecondary} />
                        <Text
                          style={[
                            styles.labelChipText,
                            { color: sel ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {displayLabel(a)}
                        </Text>
                      </View>
                      <Text style={styles.addrName} numberOfLines={1}>
                        {a.full_name}
                      </Text>
                    </View>
                    <Text style={styles.addrLine} numberOfLines={2}>
                      {shortAddress(a)}
                    </Text>
                    <Text style={styles.addrMeta}>
                      {a.pincode} · {a.phone}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          testID="add-new-address-btn"
          onPress={() => router.push('/location?from=checkout')}
          style={styles.addNewCard}
        >
          <View style={styles.addNewIcon}>
            <PlusIcon />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addNewTitle}>Add new address</Text>
            <Text style={styles.addNewSub}>
              Choose on map or search for a location
            </Text>
          </View>
        </Pressable>

        <Text style={styles.section}>Order notes</Text>
        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Leave at the door"
        />

        <Text style={styles.section}>Payment</Text>
        <View style={styles.payCard}>
          <View style={styles.payDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Cash on Delivery</Text>
            <Text style={styles.paySub}>
              Pay in cash when your order arrives.
            </Text>
          </View>
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{formatINR(total)}</Text>
        </View>
        <PrimaryButton
          title={placing ? 'Placing...' : 'Place order'}
          onPress={placeOrder}
          loading={placing}
          disabled={!canPlace}
          testID="place-order-btn"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  section: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },

  /* Address cards */
  addrCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.soft,
  },
  addrCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F1',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  addrTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  labelChipText: { ...typography.tiny, fontWeight: '700' },
  addrName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  addrLine: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addrMeta: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: 4,
  },

  /* Add new */
  addNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addNewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewTitle: { ...typography.bodyBold, color: colors.primary },
  addNewSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  /* Empty addr */
  emptyAddrCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },

  /* Payment */
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
  },
  payDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  payTitle: { ...typography.bodyBold, color: colors.textPrimary },
  paySub: { ...typography.caption, color: colors.textSecondary },
  err: { color: colors.error, ...typography.caption },

  /* Footer */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    ...shadow.card,
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { ...typography.h3, color: colors.textPrimary },
  totalVal: { ...typography.h2, color: colors.primary },
});
