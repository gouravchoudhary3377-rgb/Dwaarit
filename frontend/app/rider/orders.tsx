import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useToast } from '@/src/components/ui/Toast';
import { storage } from '@/src/utils/storage';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

type RiderOrder = {
  order_id: string;
  status: string;
  total: number;
  payable?: number;
  payment_method?: string;
  items: { name: string; quantity: number }[];
  address: {
    full_name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    pincode: string;
    lat?: number | null;
    lng?: number | null;
  };
  created_at: string;
};

function openNavigation(address: RiderOrder['address']) {
  const label = encodeURIComponent(`${address.full_name} - ${address.line1}, ${address.city}`);
  if (address.lat && address.lng) {
    const lat = address.lat;
    const lng = address.lng;
    const url = Platform.OS === 'ios'
      ? `maps://0,0?daddr=${lat},${lng}&dirflg=d`
      : `google.navigation:q=${lat},${lng}`;
    Linking.canOpenURL(url)
      .then((can) => {
        if (can) return Linking.openURL(url);
        // Fallback: Google Maps web
        return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      })
      .catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      });
  } else {
    const query = encodeURIComponent(`${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}, ${address.pincode}, India`);
    const url = Platform.OS === 'ios'
      ? `maps://0,0?daddr=${query}`
      : `geo:0,0?q=${query}(${label})`;
    Linking.canOpenURL(url)
      .then((can) => {
        if (can) return Linking.openURL(url);
        return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
      })
      .catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
      });
  }
}

type Filter = 'active' | 'delivered' | 'all';

export default function RiderOrdersScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('active');
  // OTP delivery modal
  const [otpModal, setOtpModal] = useState<{ orderId: string } | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      const data = await api.get<RiderOrder[]>('/rider/orders', token);
      setOrders(data);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = orders.filter((o) => {
    if (filter === 'active') return o.status !== 'delivered' && o.status !== 'cancelled';
    if (filter === 'delivered') return o.status === 'delivered';
    return true;
  });

  // Start delivery (no OTP needed)
  const onStartDelivery = useCallback(
    async (orderId: string) => {
      try {
        const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
        await api.post(`/rider/orders/${orderId}/status`, { status: 'out_for_delivery' }, token);
        toast.success('Started delivery');
        load();
      } catch (err: any) {
        toast.error(err?.message || 'Update failed');
      }
    },
    [toast, load],
  );

  // Confirm delivery with OTP
  const onConfirmDelivery = useCallback(async () => {
    if (!otpModal || submitting) return;
    if (otpValue.length !== 4) {
      Alert.alert('Enter OTP', 'Please enter the 4-digit code from the customer.');
      return;
    }
    setSubmitting(true);
    try {
      const token = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      await api.post(
        `/rider/orders/${otpModal.orderId}/status`,
        { status: 'delivered', otp: otpValue },
        token,
      );
      toast.success('Order marked delivered! 🎉');
      setOtpModal(null);
      setOtpValue('');
      load();
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || 'Delivery failed';
      Alert.alert('OTP Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [otpModal, otpValue, submitting, toast, load]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      {/* OTP Delivery Modal */}
      <Modal visible={!!otpModal} transparent animationType="fade" onRequestClose={() => setOtpModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔐 Enter Delivery OTP</Text>
            <Text style={styles.modalSub}>
              Ask the customer for their 4-digit code to confirm delivery
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otpValue}
              onChangeText={(t) => setOtpValue(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="• • • •"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              textAlign="center"
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => { setOtpModal(null); setOtpValue(''); }} style={styles.btnCancel}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmDelivery}
                disabled={otpValue.length !== 4 || submitting}
                style={[styles.btnConfirm, (otpValue.length !== 4 || submitting) && { opacity: 0.5 }]}
              >
                {submitting
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.btnConfirmText}>Confirm</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.title}>My Orders</Text>
      </View>
      <View style={styles.tabsRow}>
        {(['active', 'delivered', 'all'] as Filter[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setFilter(t)}
            style={[styles.tab, filter === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No orders in this view yet.</Text>
            </View>
          ) : (
            filtered.map((o) => {
              const isActive = o.status === 'out_for_delivery';
              const canStart = o.status === 'accepted' || o.status === 'pending';
              const itemCount = o.items.reduce((a, b) => a + b.quantity, 0);
              return (
                <View key={o.order_id} style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.id}>#{o.order_id.slice(-6).toUpperCase()}</Text>
                    <View style={[styles.statusPill, isActive && styles.statusPillActive]}>
                      <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
                        {o.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.items}>
                    {itemCount} items • {o.items.map((i) => i.name).slice(0, 3).join(', ')}
                    {o.items.length > 3 ? '…' : ''}
                  </Text>
                  <Text style={styles.addr}>
                    {o.address.full_name} • {o.address.line1}, {o.address.city}
                  </Text>
                  {/* Navigate button — available once order is accepted or out for delivery */}
                  {(canStart || isActive) && (
                    <Pressable
                      onPress={() => openNavigation(o.address)}
                      style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.navBtnText}>🗺️ Navigate to customer</Text>
                    </Pressable>
                  )}
                  <View style={styles.row}>
                    <Text style={styles.amount}>
                      {(o.payment_method || 'cod').toUpperCase()} • {formatINR(o.payable ?? o.total)}
                    </Text>
                    {canStart && (
                      <Pressable
                        onPress={() => onStartDelivery(o.order_id)}
                        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.ctaText}>Start</Text>
                      </Pressable>
                    )}
                    {isActive && (
                      <Pressable
                        onPress={() => { setOtpValue(''); setOtpModal({ orderId: o.order_id }); }}
                        style={({ pressed }) => [styles.cta, styles.ctaDeliver, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.ctaText}>🔐 Delivered</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: spacing.sm, marginRight: spacing.xs },
  title: { ...typography.h3, color: colors.textPrimary },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.captionBold, color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  emptyCard: { backgroundColor: colors.white, padding: spacing.lg, borderRadius: radii.md, alignItems: 'center' },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  id: { ...typography.bodyBold, color: colors.textPrimary },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  statusPillActive: { backgroundColor: '#FFF8E1' },
  statusText: { ...typography.tiny, color: colors.textSecondary, textTransform: 'capitalize', fontWeight: '600' },
  statusTextActive: { color: '#E65100' },
  items: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  addr: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  amount: { ...typography.bodyBold, color: colors.textPrimary },
  cta: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  ctaDeliver: { backgroundColor: '#1E8E3E' },
  ctaText: { ...typography.captionBold, color: colors.white },
  navBtn: {
    marginTop: spacing.xs,
    backgroundColor: '#E8F4FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  navBtnText: { ...typography.captionBold, color: '#1565C0' },

  // OTP Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
    alignItems: 'center',
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  modalSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  otpInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 16,
  },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  btnCancel: {
    flex: 1, height: 48, borderRadius: radii.pill,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { ...typography.bodyBold, color: colors.textSecondary },
  btnConfirm: {
    flex: 2, height: 48, borderRadius: radii.pill,
    backgroundColor: '#1E8E3E',
    alignItems: 'center', justifyContent: 'center',
  },
  btnConfirmText: { ...typography.bodyBold, color: colors.white },
});
