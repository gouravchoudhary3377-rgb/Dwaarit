import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

import { api } from '@/src/api/client';
import { profileApi } from '@/src/api/profile';
import { paymentsApi } from '@/src/api/payments';
import { useAuth } from '@/src/context/AuthContext';
import { useCart } from '@/src/store/cartStore';
import {
  displayLabel,
  shortAddress,
  useAddressStore,
} from '@/src/store/addressStore';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import {
  RazorpayCheckout,
  RazorpaySuccess,
} from '@/src/components/RazorpayCheckout';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

const DELIVERY_FEE = 25;
const FREE_DELIVERY_THRESHOLD = 499;

type PayMethod = 'cod' | 'wallet' | 'razorpay';

type RzpSession = {
  mode: 'live' | 'mock';
  keyId: string;
  orderId: string;        // razorpay order id
  amount: number;         // paise
  internalOrderId: string; // our backend order id
  payable: number;        // INR
};

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
      <Path d="M12 5v14M5 12h14" stroke={colors.primary} strokeWidth={2.4} strokeLinecap="round" />
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

function CheckIcon({ color = colors.primary }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l5 5L20 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type CreateOrderResponse = {
  order_id: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  wallet_applied: number;
  payable: number;
  discount: number;
  coupon_code?: string | null;
  payment_method: PayMethod;
  payment_status: string;
};

type ValidatedCoupon = {
  code: string;
  title: string;
  description: string;
  discount_type: 'flat' | 'percent';
  value: number;
  discount: number;
  subtotal: number;
  final: number;
};

type ValidateCouponResponse = {
  valid: boolean;
  code: string;
  title: string;
  description: string;
  discount: number;
  discount_type: 'flat' | 'percent';
  value: number;
  max_discount?: number | null;
  new_subtotal: number;
};

type PublicCoupon = {
  code: string;
  title: string;
  description: string;
  discount_type: 'flat' | 'percent';
  value: number;
  min_order_value: number;
  max_discount?: number | null;
  expires_at?: string | null;
};

function mapValidated(
  resp: ValidateCouponResponse,
  subtotalUsed: number,
): ValidatedCoupon {
  return {
    code: resp.code,
    title: resp.title || resp.code,
    description: resp.description || '',
    discount_type: resp.discount_type,
    value: resp.value,
    discount: resp.discount,
    subtotal: subtotalUsed,
    final: resp.new_subtotal,
  };
}

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const itemsTotal = subtotal();

  const addresses = useAddressStore((s) => s.addresses);
  const activeId = useAddressStore((s) => s.activeId);
  const setActive = useAddressStore((s) => s.setActive);

  const [selectedId, setSelectedId] = useState<string | null>(activeId);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const [payMethod, setPayMethod] = useState<PayMethod>('cod');
  const [useWallet, setUseWallet] = useState(false);
  const [walletBal, setWalletBal] = useState<number>(0);
  const [rzp, setRzp] = useState<RzpSession | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [offers, setOffers] = useState<ValidatedCoupon[] | null>(null);
  const [showOffers, setShowOffers] = useState(false);

  // Load wallet balance once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const ws = await profileApi.walletSummary(token);
        if (!cancelled) setWalletBal(ws.balance || 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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

  const deliveryFee = itemsTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  // If coupon's subtotal no longer matches the cart subtotal, auto-revalidate or clear
  useEffect(() => {
    if (!coupon || !token) return;
    if (Math.abs(coupon.subtotal - itemsTotal) < 0.01) return;
    if (itemsTotal <= 0) {
      setCoupon(null);
      return;
    }
    // Cart changed - try to re-validate the coupon silently
    let cancelled = false;
    (async () => {
      try {
        const v = await api.post<ValidateCouponResponse>(
          '/coupons/validate',
          { code: coupon.code, subtotal: itemsTotal },
          token,
        );
        if (!cancelled) setCoupon(mapValidated(v, itemsTotal));
      } catch {
        if (!cancelled) {
          setCoupon(null);
          setCouponErr('Coupon removed - cart changed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemsTotal, coupon, token]);

  // Load active offers on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.get<PublicCoupon[]>('/coupons');
        if (!cancelled) {
          // Convert to ValidatedCoupon-like for previewing (no discount precomputed)
          const previews: ValidatedCoupon[] = list.map((c) => ({
            code: c.code,
            title: c.title || c.code,
            description: c.description || '',
            discount_type: c.discount_type,
            value: c.value,
            discount: 0,
            subtotal: 0,
            final: 0,
          }));
          setOffers(previews);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyCoupon(rawCode?: string) {
    const code = (rawCode ?? couponInput).trim().toUpperCase();
    if (!code) {
      setCouponErr('Enter a coupon code');
      return;
    }
    if (!token) return;
    if (itemsTotal <= 0) {
      setCouponErr('Add items to your cart first');
      return;
    }
    setCouponBusy(true);
    setCouponErr(null);
    try {
      const v = await api.post<ValidateCouponResponse>(
        '/coupons/validate',
        { code, subtotal: itemsTotal },
        token,
      );
      const applied = mapValidated(v, itemsTotal);
      setCoupon(applied);
      setCouponInput(applied.code);
      setShowOffers(false);
    } catch (e: any) {
      setCoupon(null);
      setCouponErr(e?.message ?? 'Invalid coupon code');
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput('');
    setCouponErr(null);
  }

  const discount = coupon ? coupon.discount : 0;
  const totalBeforeWallet = +Math.max(itemsTotal + deliveryFee - discount, 0).toFixed(2);

  // Compute wallet applied / payable preview
  const { walletApplied, payable } = useMemo(() => {
    if (payMethod === 'wallet') {
      const applied = Math.min(walletBal, totalBeforeWallet);
      return { walletApplied: +applied.toFixed(2), payable: +(totalBeforeWallet - applied).toFixed(2) };
    }
    if (useWallet) {
      const applied = Math.min(walletBal, totalBeforeWallet);
      return { walletApplied: +applied.toFixed(2), payable: +(totalBeforeWallet - applied).toFixed(2) };
    }
    return { walletApplied: 0, payable: totalBeforeWallet };
  }, [payMethod, useWallet, walletBal, totalBeforeWallet]);

  const walletShort = payMethod === 'wallet' && walletBal < totalBeforeWallet;

  const canPlace = !!selected && lines.length > 0 && !placing && !walletShort;

  function chooseAddress(id: string) {
    setSelectedId(id);
    setActive(id);
  }

  async function createBackendOrder(): Promise<CreateOrderResponse | null> {
    if (!selected) {
      setErr('Please select a delivery address');
      return null;
    }
    const resp = await api.post<CreateOrderResponse>(
      '/orders',
      {
        items: lines.map((l) => ({
          product_id: l.product.product_id,
          quantity: l.quantity,
        })),
        address: {
          label:
            selected.label === 'Home' ? 'home' : selected.label === 'Work' ? 'work' : 'other',
          custom_label: selected.custom_label ?? '',
          full_name: selected.full_name,
          phone: selected.phone,
          line1: selected.line1,
          line2: selected.line2 ?? '',
          landmark: '',
          city: selected.city,
          pincode: selected.pincode,
          state: '',
          lat: selected.lat ?? null,
          lng: selected.lng ?? null,
        },
        payment_method: payMethod,
        notes,
        use_wallet: payMethod === 'wallet' || useWallet,
        coupon_code: coupon ? coupon.code : null,
      },
      token,
    );
    return resp;
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
    if (payMethod === 'wallet' && walletBal < totalBeforeWallet) {
      setErr('Insufficient wallet balance');
      return;
    }
    setPlacing(true);
    try {
      const resp = await createBackendOrder();
      if (!resp) return;

      // COD or fully-paid wallet => done
      if (payMethod === 'cod' || (payMethod === 'wallet' && resp.payable <= 0.01)) {
        clear();
        router.replace({
          pathname: '/order-success',
          params: { id: resp.order_id, total: String(resp.total) },
        });
        return;
      }

      // Razorpay flow (or wallet partial — shouldn't happen because we cap)
      if (payMethod === 'razorpay' && resp.payable > 0) {
        const rzpOrder = await paymentsApi.createOrder(token!, resp.payable, resp.order_id);
        setRzp({
          mode: rzpOrder.mode,
          keyId: rzpOrder.key_id,
          orderId: rzpOrder.razorpay_order_id,
          amount: rzpOrder.amount,
          internalOrderId: resp.order_id,
          payable: resp.payable,
        });
      } else {
        // Fallback safety
        clear();
        router.replace({
          pathname: '/order-success',
          params: { id: resp.order_id, total: String(resp.total) },
        });
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  async function onRzpSuccess(data: RazorpaySuccess) {
    if (!rzp || !token) return;
    const session = rzp;
    setRzp(null);
    try {
      await paymentsApi.verifyOrder(token, {
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        order_id: session.internalOrderId,
      });
      clear();
      router.replace({
        pathname: '/order-success',
        params: { id: session.internalOrderId, total: String(session.payable) },
      });
    } catch (e: any) {
      Alert.alert('Payment verification failed', e?.message ?? 'Please contact support.');
    }
  }

  function onRzpFailure(reason: string) {
    setRzp(null);
    Alert.alert('Payment failed', reason);
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

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 220 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Delivery address</Text>

        {addresses.length === 0 ? (
          <View style={styles.emptyAddrCard}>
            <Text style={styles.emptyTitle}>No saved addresses yet</Text>
            <Text style={styles.emptySub}>Add a delivery address to continue with checkout.</Text>
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
            <Text style={styles.addNewSub}>Choose on map or search for a location</Text>
          </View>
        </Pressable>

        <Text style={styles.section}>Order notes</Text>
        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Leave at the door"
        />

        <Text style={styles.section}>Apply coupon</Text>
        {coupon ? (
          <View style={styles.appliedCoupon}>
            <View style={styles.appliedIcon}>
              <CheckIcon color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appliedCode}>{coupon.code}</Text>
              <Text style={styles.appliedSub} numberOfLines={2}>
                {coupon.title || coupon.description || 'Coupon applied'}
              </Text>
              <Text style={styles.appliedSavings}>
                You save {formatINR(coupon.discount)}
              </Text>
            </View>
            <Pressable
              onPress={removeCoupon}
              hitSlop={10}
              testID="remove-coupon-btn"
              style={styles.removeCouponBtn}
            >
              <Text style={styles.removeCouponText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.couponRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Promo code"
                value={couponInput}
                onChangeText={(t) => {
                  setCouponInput(t.toUpperCase());
                  if (couponErr) setCouponErr(null);
                }}
                placeholder="e.g. WELCOME50"
                autoCapitalize="characters"
                testID="coupon-input"
              />
            </View>
            <Pressable
              testID="apply-coupon-btn"
              onPress={() => applyCoupon()}
              disabled={couponBusy || !couponInput.trim()}
              style={[
                styles.applyBtn,
                (couponBusy || !couponInput.trim()) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.applyBtnText}>
                {couponBusy ? '...' : 'Apply'}
              </Text>
            </Pressable>
          </View>
        )}
        {couponErr ? <Text style={styles.err}>{couponErr}</Text> : null}

        {offers && offers.length > 0 ? (
          <>
            <Pressable
              onPress={() => setShowOffers((s) => !s)}
              testID="toggle-offers-btn"
            >
              <Text style={styles.viewOffers}>
                {showOffers ? 'Hide offers' : `View all offers (${offers.length})`}
              </Text>
            </Pressable>
            {showOffers ? (
              <View style={{ gap: spacing.sm }}>
                {offers.map((o) => (
                  <View key={o.code} style={styles.offerCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerCode}>{o.code}</Text>
                      <Text style={styles.offerTitle} numberOfLines={2}>
                        {o.title || o.description || (
                          o.discount_type === 'percent'
                            ? `${o.value}% off`
                            : `Flat ${formatINR(o.value)} off`
                        )}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => applyCoupon(o.code)}
                      disabled={couponBusy}
                      style={[styles.applyBtn, couponBusy && { opacity: 0.5 }]}
                      testID={`apply-offer-${o.code}`}
                    >
                      <Text style={styles.applyBtnText}>Apply</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.section}>Payment method</Text>

        <PayOption
          testID="pay-cod"
          selected={payMethod === 'cod'}
          onPress={() => setPayMethod('cod')}
          title="Cash on Delivery"
          subtitle="Pay in cash when your order arrives"
          badge="COD"
        />
        <PayOption
          testID="pay-razorpay"
          selected={payMethod === 'razorpay'}
          onPress={() => setPayMethod('razorpay')}
          title="UPI / Cards / Netbanking"
          subtitle="Secure online payment via Razorpay"
          badge="Online"
        />
        <PayOption
          testID="pay-wallet"
          selected={payMethod === 'wallet'}
          onPress={() => setPayMethod('wallet')}
          title="Dwaarit Wallet"
          subtitle={`Balance: ${formatINR(walletBal)}`}
          badge="Wallet"
          disabled={walletBal <= 0}
        />
        {payMethod === 'wallet' && walletBal < totalBeforeWallet ? (
          <Text style={styles.err}>
            Wallet has {formatINR(walletBal)}. Need {formatINR(totalBeforeWallet)}. Top up or pick another method.
          </Text>
        ) : null}

        {/* Combine wallet with another method */}
        {payMethod !== 'wallet' && walletBal > 0 ? (
          <View style={styles.walletToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>Use wallet balance</Text>
              <Text style={styles.paySub}>
                Apply {formatINR(Math.min(walletBal, totalBeforeWallet))} from wallet
              </Text>
            </View>
            <Switch
              value={useWallet}
              onValueChange={setUseWallet}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
              testID="use-wallet-toggle"
            />
          </View>
        ) : null}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Row label="Items total" value={formatINR(itemsTotal)} />
          <Row
            label="Delivery"
            value={deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}
            valueColor={deliveryFee === 0 ? colors.success : undefined}
          />
          {discount > 0 ? (
            <Row
              label={`Coupon (${coupon?.code ?? ''})`}
              value={`- ${formatINR(discount)}`}
              valueColor={colors.success}
            />
          ) : null}
          {walletApplied > 0 ? (
            <Row label="Wallet applied" value={`- ${formatINR(walletApplied)}`} valueColor={colors.success} />
          ) : null}
          <View style={styles.divider} />
          <Row label="To pay" value={formatINR(payable)} bold />
          {payMethod === 'cod' ? (
            <Text style={styles.codNote}>Pay {formatINR(payable)} in cash at delivery.</Text>
          ) : null}
        </View>

        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{payMethod === 'cod' ? 'Pay on delivery' : 'To pay now'}</Text>
          <Text style={styles.totalVal}>{formatINR(payable)}</Text>
        </View>
        <PrimaryButton
          title={placing ? 'Placing...' : payMethod === 'razorpay' && payable > 0 ? 'Pay & place order' : 'Place order'}
          onPress={placeOrder}
          loading={placing}
          disabled={!canPlace}
          testID="place-order-btn"
        />
      </View>

      {rzp ? (
        <RazorpayCheckout
          visible={!!rzp}
          onClose={() => setRzp(null)}
          onSuccess={onRzpSuccess}
          onFailure={onRzpFailure}
          mode={rzp.mode}
          keyId={rzp.keyId}
          orderId={rzp.orderId}
          amount={rzp.amount}
          name="Dwaarit Order"
          description={`Payment for ${rzp.internalOrderId}`}
          prefill={{ name: user?.name, email: user?.email, contact: user?.mobile || '' }}
          themeColor={colors.primary}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function PayOption({
  selected,
  onPress,
  title,
  subtitle,
  badge,
  disabled,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={[
        styles.payCardOpt,
        selected && styles.payCardOptActive,
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.payTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.paySub}>{subtitle}</Text>
      </View>
      {selected ? <CheckIcon /> : null}
    </Pressable>
  );
}

function Row({
  label,
  value,
  bold,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && { fontWeight: '800', color: colors.textPrimary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.sumValue,
          bold && { fontWeight: '800', fontSize: 16 },
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
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
  section: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },

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
  addrCardActive: { borderColor: colors.primary, backgroundColor: '#FFF8F1' },
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
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  addrTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  labelChipText: { ...typography.tiny, fontWeight: '700' },
  addrName: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1 },
  addrLine: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  addrMeta: { ...typography.tiny, color: colors.textMuted, marginTop: 4 },

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
  emptyAddrCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptySub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

  /* Payment */
  payCardOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.soft,
  },
  payCardOptActive: { borderColor: colors.primary, backgroundColor: '#FFF8F1' },
  payTitle: { ...typography.bodyBold, color: colors.textPrimary },
  paySub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  badgeText: { ...typography.tiny, fontWeight: '700', color: colors.primary },

  walletToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
  },

  /* Summary */
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
    gap: 6,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { ...typography.caption, color: colors.textSecondary },
  sumValue: { ...typography.bodyBold, color: colors.textPrimary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
  codNote: { ...typography.tiny, color: colors.textMuted, marginTop: 4 },

  err: { color: colors.error, ...typography.caption },

  /* Coupon */
  couponRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  applyBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  applyBtnText: { ...typography.bodyBold, color: colors.white },
  appliedCoupon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#EAF7EE',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  appliedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedCode: { ...typography.bodyBold, color: colors.textPrimary },
  appliedSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  appliedSavings: { ...typography.caption, color: colors.success, fontWeight: '700', marginTop: 4 },
  removeCouponBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  removeCouponText: { ...typography.caption, color: colors.error, fontWeight: '700' },
  viewOffers: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  offerCode: { ...typography.bodyBold, color: colors.primary },
  offerTitle: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.h3, color: colors.textPrimary },
  totalVal: { ...typography.h2, color: colors.primary },
});
