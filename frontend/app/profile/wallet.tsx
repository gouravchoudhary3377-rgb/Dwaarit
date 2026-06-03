import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { profileApi, WalletSummary, WalletTxn } from '@/src/api/profile';
import { paymentsApi } from '@/src/api/payments';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import {
  RazorpayCheckout,
  RazorpaySuccess,
} from '@/src/components/RazorpayCheckout';
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

function txnMeta(t: WalletTxn): { sign: '+' | '-'; color: string; label: string } {
  if (t.type === 'debit') return { sign: '-', color: colors.error, label: 'Order payment' };
  if (t.type === 'refund') return { sign: '+', color: colors.success, label: 'Refund' };
  if (t.type === 'topup') return { sign: '+', color: colors.success, label: 'Top-up' };
  return { sign: '+', color: colors.success, label: 'Credit' };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type RzpSession = {
  mode: 'live' | 'mock';
  keyId: string;
  orderId: string;
  amount: number; // paise
  inrAmount: number; // INR
};

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [data, setData] = useState<WalletSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('500');
  const [busy, setBusy] = useState(false);
  const [rzp, setRzp] = useState<RzpSession | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await profileApi.walletSummary(token);
      setData(res);
    } catch {
      setData({ balance: 0, transactions: [] });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function startTopup() {
    if (!token) return;
    const amt = parseFloat(topupAmount);
    if (!isFinite(amt) || amt <= 0) {
      return Alert.alert('Invalid amount', 'Enter a positive amount.');
    }
    setBusy(true);
    try {
      const order = await paymentsApi.createOrder(token, amt);
      setTopupOpen(false);
      setRzp({
        mode: order.mode,
        keyId: order.key_id,
        orderId: order.razorpay_order_id,
        amount: order.amount,
        inrAmount: amt,
      });
    } catch (e: any) {
      Alert.alert('Could not start payment', e?.message ?? 'Try again later.');
    } finally {
      setBusy(false);
    }
  }

  async function onPaymentSuccess(resp: RazorpaySuccess) {
    if (!token || !rzp) return;
    setRzp(null);
    try {
      const v = await paymentsApi.verifyWalletTopup(token, {
        razorpay_order_id: resp.razorpay_order_id,
        razorpay_payment_id: resp.razorpay_payment_id,
        razorpay_signature: resp.razorpay_signature,
        amount: rzp.inrAmount,
      });
      setTopupAmount('500');
      await load();
      if (v.duplicate) {
        Alert.alert('Already credited', 'This payment was already added to your wallet.');
      } else {
        Alert.alert(
          'Wallet credited',
          `${formatINR(rzp.inrAmount)} added. New balance: ${formatINR(v.balance)}`,
        );
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message ?? 'Please contact support.');
    }
  }

  function onPaymentFailure(reason: string) {
    setRzp(null);
    Alert.alert('Payment failed', reason);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={styles.headerTitle}>Flynkit Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ListHeaderComponent={
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              gap: spacing.lg,
            }}
          >
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available balance</Text>
              <Text style={styles.balanceValue} testID="wallet-balance">
                {formatINR(data?.balance ?? 0)}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <PrimaryButton
                  title="+ Add money"
                  onPress={() => setTopupOpen(true)}
                  style={{ flex: 1 }}
                  testID="open-topup-btn"
                />
              </View>
            </View>
            <Text style={styles.section}>Recent transactions</Text>
            {data === null ? <ActivityIndicator color={colors.primary} /> : null}
            {data && data.transactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyText}>
                  Add money to start using wallet for faster checkout.
                </Text>
              </View>
            ) : null}
          </View>
        }
        data={data?.transactions ?? []}
        keyExtractor={(item) => item.txn_id}
        renderItem={({ item }) => {
          const m = txnMeta(item);
          return (
            <View style={styles.txnRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnTitle}>{item.note || m.label}</Text>
                <Text style={styles.txnSub}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={[styles.txnAmt, { color: m.color }]}>
                {m.sign}
                {formatINR(item.amount)}
              </Text>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      />

      <Modal
        visible={topupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTopupOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTopupOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add money to wallet</Text>
            <Text style={styles.modalHint}>Powered by Razorpay (UPI, Cards, Netbanking)</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {[200, 500, 1000, 2000].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setTopupAmount(String(v))}
                  style={[styles.amtChip, String(v) === topupAmount && styles.amtChipActive]}
                >
                  <Text
                    style={[
                      styles.amtChipText,
                      String(v) === topupAmount && styles.amtChipTextActive,
                    ]}
                  >
                    ₹{v}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
              style={styles.amtInput}
              testID="topup-amount-input"
            />
            <PrimaryButton
              title={busy ? 'Starting…' : `Pay ${formatINR(parseFloat(topupAmount) || 0)}`}
              onPress={startTopup}
              disabled={busy}
              loading={busy}
              testID="start-topup-btn"
            />
            <Pressable
              onPress={() => setTopupOpen(false)}
              style={{ alignItems: 'center', marginTop: spacing.sm }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {rzp ? (
        <RazorpayCheckout
          visible={!!rzp}
          onClose={() => setRzp(null)}
          onSuccess={onPaymentSuccess}
          onFailure={onPaymentFailure}
          mode={rzp.mode}
          keyId={rzp.keyId}
          orderId={rzp.orderId}
          amount={rzp.amount}
          name="Flynkit Wallet"
          description="Wallet top-up"
          prefill={{ name: user?.name, email: user?.email, contact: user?.mobile || '' }}
          themeColor={colors.primary}
        />
      ) : null}
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
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  balanceLabel: {
    ...typography.captionBold,
    color: colors.white,
    opacity: 0.85,
    letterSpacing: 0.5,
  },
  balanceValue: { fontSize: 36, fontWeight: '800', color: colors.white, marginTop: 6 },
  section: {
    ...typography.captionBold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: { ...typography.bodyBold, color: colors.textPrimary },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  txnTitle: { ...typography.bodyBold, color: colors.textPrimary },
  txnSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  txnAmt: { ...typography.bodyBold, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalHint: { ...typography.caption, color: colors.textSecondary },
  amtChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  amtChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  amtChipText: { ...typography.bodyBold, color: colors.textSecondary },
  amtChipTextActive: { color: colors.white },
  amtInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  cancelText: { ...typography.bodyBold, color: colors.textSecondary },
});
