import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type Txn = {
  txn_id: string;
  user_id: string;
  type: 'credit' | 'debit' | 'refund' | 'topup';
  amount: number;
  note: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
};

type TxnType = 'credit' | 'debit' | 'refund';

const TYPES: { key: TxnType; label: string; bg: string; fg: string }[] = [
  { key: 'credit', label: 'Credit', bg: '#E8F5E9', fg: '#2E7D32' },
  { key: 'refund', label: 'Refund', bg: '#E3F2FD', fg: '#1565C0' },
  { key: 'debit', label: 'Debit', bg: '#FFEBEE', fg: '#C62828' },
];

export default function WalletAdjustments() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ user_id?: string; email?: string }>();

  const [userId, setUserId] = useState<string>(typeof params.user_id === 'string' ? params.user_id : '');
  const [email, setEmail] = useState<string>(typeof params.email === 'string' ? params.email : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TxnType>('credit');
  const [submitting, setSubmitting] = useState(false);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTxns = useCallback(async () => {
    if (!token) return;
    try {
      const path = userId ? `/admin/wallet/transactions?user_id=${encodeURIComponent(userId)}` : '/admin/wallet/transactions';
      const list = await api.get<Txn[]>(path, token);
      setTxns(list || []);
    } catch {
      setTxns([]);
    } finally {
      setLoadingTxns(false);
      setRefreshing(false);
    }
  }, [token, userId]);

  useEffect(() => { loadTxns(); }, [loadTxns]);

  async function submit() {
    const amt = parseFloat(amount);
    if (!userId.trim()) return Alert.alert('Missing user', 'Enter a user_id (or open from Users).');
    if (!amt || amt <= 0) return Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
    setSubmitting(true);
    try {
      const res = await api.post<{ ok: boolean; balance: number }>(
        '/admin/wallet/adjust',
        { user_id: userId.trim(), type, amount: amt, note: note.trim() },
        token,
      );
      Alert.alert('Success', `New balance: ${formatINR(res.balance)}`);
      setAmount('');
      setNote('');
      loadTxns();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to adjust wallet');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Wallet Adjustments</Text>
          <Text style={styles.sub}>Manual credit, refund or debit</Text>
        </View>
      </View>

      <FlatList
        data={txns}
        keyExtractor={(t) => t.txn_id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTxns(); }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adjust wallet</Text>
            {email ? <Text style={styles.targetEmail}>For: {email}</Text> : null}

            <Text style={styles.label}>User ID</Text>
            <TextInput
              value={userId}
              onChangeText={setUserId}
              placeholder="e.g. usr_abc123"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TYPES.map((t) => {
                const active = type === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.typeChip, active && { backgroundColor: t.bg, borderColor: t.fg }]}>
                    <Text style={[styles.typeChipText, active && { color: t.fg }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="e.g. 100"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Reason / reference"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { minHeight: 60 }]}
              multiline
            />

            <Pressable onPress={submit} disabled={submitting} style={[styles.submit, submitting && { opacity: 0.6 }]}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Apply adjustment</Text>}
            </Pressable>

            <Text style={[styles.cardTitle, { marginTop: spacing.lg }]}>
              {userId ? 'Transactions for this user' : 'Recent transactions'}
            </Text>
            {loadingTxns && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
          </View>
        }
        renderItem={({ item }) => {
          const meta = TYPES.find((t) => t.key === item.type) || { bg: colors.surface, fg: colors.textPrimary, label: item.type };
          const sign = item.type === 'debit' ? '−' : '+';
          return (
            <View style={styles.txnRow}>
              <View style={[styles.txnBadge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.txnBadgeText, { color: meta.fg }]}>{meta.label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnNote} numberOfLines={1}>{item.note || '—'}</Text>
                <Text style={styles.txnSub} numberOfLines={1}>
                  {item.user_email || item.user_id} · {new Date(item.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[styles.txnAmt, { color: item.type === 'debit' ? colors.error : '#2E7D32' }]}>
                {sign}{formatINR(item.amount)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={!loadingTxns ? <Text style={styles.empty}>No transactions yet.</Text> : null}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  h1: { ...typography.h2, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, marginBottom: 12, ...shadow.soft },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary },
  targetEmail: { ...typography.caption, color: colors.primary, marginTop: 4, fontWeight: '700' },

  label: { ...typography.tiny, color: colors.textMuted, fontWeight: '700', marginTop: 12, marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
  },
  typeChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  typeChipText: { ...typography.captionBold, color: colors.textSecondary },

  submit: { marginTop: 16, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: colors.white, fontWeight: '800', ...typography.body },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.md, marginBottom: 8, ...shadow.soft,
  },
  txnBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  txnBadgeText: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase' },
  txnNote: { ...typography.bodyBold, color: colors.textPrimary },
  txnSub: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  txnAmt: { ...typography.bodyBold },

  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
});
