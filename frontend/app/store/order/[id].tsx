import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useToast } from '@/src/components/ui/Toast';
import { StoreApi, StoreDriver, StoreOrder } from '@/src/api/store';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';
import { useStoreToken } from '@/src/hooks/useStoreToken';

export default function StoreOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const token = useStoreToken();
  const toast = useToast();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [drivers, setDrivers] = useState<StoreDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const o = await StoreApi.getOrder(token, String(id));
      setOrder(o);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [token, id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = async () => {
    if (!token) return;
    setShowAssign(true);
    setDriversLoading(true);
    try {
      const list = await StoreApi.listDrivers(token);
      const approved = list.filter((d) => d.status === 'approved');
      setDrivers(approved);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load riders');
    } finally {
      setDriversLoading(false);
    }
  };

  const doAssign = async (driverId: string) => {
    if (!token || !order) return;
    try {
      setBusy(true);
      await StoreApi.assignRider(token, order.order_id, driverId);
      toast.success('Rider assigned');
      setShowAssign(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not assign rider');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!token || !order) return;
    try {
      setBusy(true);
      await StoreApi.acceptOrder(token, order.order_id);
      toast.success('Order accepted');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept');
    } finally {
      setBusy(false);
    }
  };

  const advance = async (next: string, label: string) => {
    if (!token || !order) return;
    try {
      setBusy(true);
      await StoreApi.setStatus(token, order.order_id, next);
      toast.success(label);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Text style={typography.bodyBold as any}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Order #{order.order_id.slice(-6).toUpperCase()}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={styles.card}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.statusVal}>{order.status.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.bodyText}>{order.address?.full_name}</Text>
          <Pressable
            onPress={() => order.address?.phone && Linking.openURL(`tel:${order.address.phone}`)}
          >
            <Text style={[styles.bodyText, { color: colors.primary }]}>📞 {order.address?.phone}</Text>
          </Pressable>
          <Text style={styles.address}>
            {order.address?.line1}
            {order.address?.line2 ? `, ${order.address.line2}` : ''}, {order.address?.city} - {order.address?.pincode}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Items ({order.items?.length || 0})</Text>
          {order.items?.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>
                {it.name}
              </Text>
              <Text style={styles.itemQty}>×{it.quantity}</Text>
              {typeof it.price === 'number' ? (
                <Text style={styles.itemPrice}>{formatINR(it.price * (it.quantity || 1))}</Text>
              ) : null}
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLbl}>Total</Text>
            <Text style={styles.totalVal}>{formatINR(order.payable ?? order.total)}</Text>
          </View>
          <Text style={styles.paymentMethod}>
            {(order.payment_method || 'cod').toUpperCase()}
          </Text>
        </View>

        {order.driver_name ? (
          <View style={styles.card}>
            <Text style={styles.label}>Assigned rider</Text>
            <Text style={styles.bodyText}>🛵 {order.driver_name}</Text>
            {order.driver_phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${order.driver_phone}`)}>
                <Text style={[styles.bodyText, { color: colors.primary }]}>📞 {order.driver_phone}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {order.status === 'pending' ? (
          <PrimaryBtn label={busy ? 'Accepting…' : 'Accept order'} onPress={accept} disabled={busy} />
        ) : null}
        {(order.status === 'confirmed' || order.status === 'accepted') ? (
          <PrimaryBtn label="Mark preparing" onPress={() => advance('preparing', 'Preparing')} disabled={busy} />
        ) : null}
        {(order.status === 'preparing' || order.status === 'confirmed') && !order.driver_id ? (
          <PrimaryBtn label="Assign rider" onPress={openAssign} disabled={busy} />
        ) : null}
        {order.status === 'out_for_delivery' && order.driver_id ? (
          <SecondaryBtn label="Re-assign rider" onPress={openAssign} disabled={busy} />
        ) : null}
      </View>

      <Modal visible={showAssign} transparent animationType="slide" onRequestClose={() => setShowAssign(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setShowAssign(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Pick a rider</Text>
            {driversLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : drivers.length === 0 ? (
              <Text style={styles.sheetEmpty}>No approved riders at your store.</Text>
            ) : (
              <FlatList
                data={drivers}
                keyExtractor={(d) => d.driver_id}
                style={{ maxHeight: 360 }}
                ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => doAssign(item.driver_id)}
                    style={({ pressed }) => [styles.driverRow, pressed && { opacity: 0.8 }]}
                  >
                    <View>
                      <Text style={styles.driverName}>{item.name}</Text>
                      <Text style={styles.driverMeta}>
                        {item.vehicle_type?.toUpperCase() || 'BIKE'}
                        {item.online ? ' • Online' : ' • Offline'}
                      </Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: item.online ? colors.success : colors.textMuted }]} />
                  </Pressable>
                )}
              />
            )}
            <Pressable onPress={() => setShowAssign(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryBtn, (pressed || disabled) && { opacity: 0.7 }]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}
function SecondaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondaryBtn, (pressed || disabled) && { opacity: 0.7 }]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.bodyBold, color: colors.textPrimary },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...(shadow as any).soft,
  },
  label: { ...typography.tiny, color: colors.textSecondary, letterSpacing: 0.4 },
  statusVal: { ...typography.h3, color: colors.primary, marginTop: 4 },
  bodyText: { ...typography.body, color: colors.textPrimary, marginTop: 4 },
  address: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  itemName: { flex: 1, ...typography.caption, color: colors.textPrimary },
  itemQty: { ...typography.captionBold, color: colors.textSecondary },
  itemPrice: { ...typography.captionBold, color: colors.textPrimary, minWidth: 70, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLbl: { ...typography.bodyBold, color: colors.textPrimary },
  totalVal: { ...typography.bodyBold, color: colors.primary },
  paymentMethod: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.xs },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.bodyBold, color: colors.white },
  secondaryBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: { ...typography.bodyBold, color: colors.primary },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetEmpty: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', padding: spacing.lg },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  driverName: { ...typography.bodyBold, color: colors.textPrimary },
  driverMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  cancelText: { ...typography.captionBold, color: colors.textPrimary },
});
