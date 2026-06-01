import React, { useMemo, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/store/cartStore';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const total = subtotal();

  const [fullName, setFullName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const canPlace = useMemo(
    () => fullName && phone && line1 && city && pincode && lines.length > 0,
    [fullName, phone, line1, city, pincode, lines.length],
  );

  async function placeOrder() {
    setErr(null);
    if (!canPlace) { setErr('Please fill all required fields'); return; }
    setPlacing(true);
    try {
      const resp = await api.post<{ order_id: string; total: number }>(
        '/orders',
        {
          items: lines.map((l) => ({ product_id: l.product.product_id, quantity: l.quantity })),
          address: { full_name: fullName, phone, line1, line2, city, pincode },
          payment_method: 'cod',
          notes,
        },
        token,
      );
      clear();
      router.replace({ pathname: '/order-success', params: { id: resp.order_id, total: String(resp.total) } });
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
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Delivery address</Text>
        <TextField label="Full name" value={fullName} onChangeText={setFullName} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Address line 1" value={line1} onChangeText={setLine1} placeholder="Street, house no." />
        <TextField label="Address line 2" value={line2} onChangeText={setLine2} placeholder="Apartment, landmark (optional)" />
        <TextField label="City" value={city} onChangeText={setCity} />
        <TextField label="PIN / ZIP" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />

        <Text style={styles.section}>Order notes</Text>
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Leave at the door" />

        <Text style={styles.section}>Payment</Text>
        <View style={styles.payCard}>
          <View style={styles.payDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Cash on Delivery</Text>
            <Text style={styles.paySub}>Pay in cash when your order arrives.</Text>
          </View>
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>${total.toFixed(2)}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  section: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft },
  payDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
  payTitle: { ...typography.bodyBold, color: colors.textPrimary },
  paySub: { ...typography.caption, color: colors.textSecondary },
  err: { color: colors.error, ...typography.caption },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.white, ...shadow.card, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.h3, color: colors.textPrimary },
  totalVal: { ...typography.h2, color: colors.primary },
});
