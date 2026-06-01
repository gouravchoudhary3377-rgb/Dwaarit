import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { api, Invoice, Order } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { StatusBadge, Status } from '@/src/components/StatusBadge';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 19l-7-7 7-7" stroke={colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12l5 5L20 7"
        stroke={filled ? colors.white : colors.textMuted}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const FLOW: Array<{ key: Status; label: string; hint: string }> = [
  { key: 'pending', label: 'Order placed', hint: 'We received your order' },
  { key: 'accepted', label: 'Accepted', hint: 'Packing your groceries' },
  { key: 'out_for_delivery', label: 'Out for delivery', hint: 'On the way to you' },
  { key: 'delivered', label: 'Delivered', hint: 'Enjoy your fresh groceries!' },
];

function rankOf(status: Status): number {
  const idx = FLOW.findIndex((f) => f.key === status);
  return idx === -1 ? 0 : idx;
}

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      const o = await api.get<Order>(`/orders/${id}`, token);
      setOrder(o);
    } catch (e) {
      console.warn('order load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 8, left: spacing.md }]} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>Order not found.</Text>
      </View>
    );
  }

  const cancelled = order.status === 'cancelled';
  const currentRank = rankOf(order.status);
  const subtotal = order.subtotal ?? order.items.reduce((s, it) => s + it.subtotal, 0);
  const deliveryFee = order.delivery_fee ?? 0;
  const walletApplied = order.wallet_applied ?? 0;
  const payable = order.payable ?? order.total;
  const isLive = ['pending', 'accepted', 'out_for_delivery'].includes(order.status);

  const onDownloadInvoice = async () => {
    try {
      const inv = await api.get<Invoice>(`/orders/${order.order_id}/invoice`, token);
      const html = buildInvoiceHTML(inv);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print?.(), 400);
        }
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share invoice' });
      } else {
        Alert.alert('Invoice saved', uri);
      }
    } catch (e: any) {
      Alert.alert('Invoice failed', e?.message || 'Could not generate invoice');
    }
  };

  const onTrackLive = () => router.push({ pathname: '/order/[id]/track', params: { id: order.order_id } });

  const paymentLabel = (() => {
    switch (order.payment_method) {
      case 'cod': return 'Cash on Delivery';
      case 'wallet': return 'Wallet';
      case 'razorpay': return 'Razorpay';
      case 'card': return 'Card';
      default: return String(order.payment_method || '—');
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtnInline} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Order #{order.order_id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.headerSub}>
            Placed {new Date(order.created_at).toLocaleString()}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Status timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{cancelled ? 'Order cancelled' : 'Order status'}</Text>
          {cancelled ? (
            <View style={styles.cancelBox}>
              <Text style={styles.cancelText}>
                This order was cancelled. If this wasn't you, please contact support.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {FLOW.map((step, idx) => {
                const reached = idx <= currentRank;
                const active = idx === currentRank;
                const isLast = idx === FLOW.length - 1;
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          reached ? styles.timelineDotActive : styles.timelineDotIdle,
                          active && styles.timelineDotPulse,
                        ]}
                      >
                        <CheckIcon filled={reached} />
                      </View>
                      {!isLast ? (
                        <View
                          style={[
                            styles.timelineConnector,
                            idx < currentRank ? styles.timelineConnectorActive : null,
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={styles.timelineText}>
                      <Text style={[styles.stepLabel, reached && styles.stepLabelReached]}>
                        {step.label}
                      </Text>
                      <Text style={styles.stepHint}>{step.hint}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.countPill}>{order.items.length}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            {order.items.map((it) => (
              <View key={it.product_id} style={styles.itemRow}>
                <Image source={{ uri: it.image_url }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.itemMeta}>
                    {it.quantity} × {formatINR(it.price)} · {it.unit}
                  </Text>
                </View>
                <Text style={styles.itemSubtotal}>{formatINR(it.subtotal)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Delivery address */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery address</Text>
          <View style={styles.addrBox}>
            <Text style={styles.addrName}>{order.address.full_name}</Text>
            <Text style={styles.addrPhone}>{order.address.phone}</Text>
            <Text style={styles.addrLines}>
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ''}
              {`\n${order.address.city} ${order.address.pincode}`}
            </Text>
          </View>
          {order.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Payment summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment summary</Text>
          <View style={styles.payRow}>
            <Text style={styles.payK}>Subtotal</Text>
            <Text style={styles.payV}>{formatINR(subtotal)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payK}>Delivery fee</Text>
            <Text style={styles.payVfree}>{deliveryFee === 0 ? 'FREE' : formatINR(deliveryFee)}</Text>
          </View>
          {walletApplied > 0 ? (
            <View style={styles.payRow}>
              <Text style={styles.payK}>Wallet applied</Text>
              <Text style={styles.payVwallet}>− {formatINR(walletApplied)}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.payRow}>
            <Text style={styles.totalK}>{walletApplied > 0 ? 'Payable' : 'Total'}</Text>
            <Text style={styles.totalV}>{formatINR(payable)}</Text>
          </View>
          <View style={styles.payMethodRow}>
            <Text style={styles.payMethodLabel}>Payment method</Text>
            <View style={styles.payMethodPill}>
              <Text style={styles.payMethodText}>{paymentLabel}</Text>
            </View>
          </View>
          {order.payment_status ? (
            <View style={styles.payMethodRow}>
              <Text style={styles.payMethodLabel}>Payment status</Text>
              <View style={[styles.payMethodPill, payStatusStyle(order.payment_status).pill]}>
                <Text style={[styles.payMethodText, payStatusStyle(order.payment_status).text]}>
                  {order.payment_status.toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* CTAs */}
        <View style={{ gap: spacing.sm }}>
          {isLive ? (
            <Pressable onPress={onTrackLive} style={[styles.cta, styles.ctaPrimary]} android_ripple={{ color: '#ffffff22' }}>
              <Text style={styles.ctaPrimaryText}>Track live on map</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onDownloadInvoice} style={[styles.cta, styles.ctaSecondary]} android_ripple={{ color: colors.primarySoft }}>
            <Text style={styles.ctaSecondaryText}>Download invoice</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function payStatusStyle(s: string) {
  switch (s) {
    case 'paid':
      return { pill: { backgroundColor: '#E6F4EA' }, text: { color: '#137333' } };
    case 'failed':
      return { pill: { backgroundColor: '#FCE8E6' }, text: { color: '#C5221F' } };
    case 'cod':
      return { pill: { backgroundColor: '#FEF7E0' }, text: { color: '#8B6F00' } };
    default:
      return { pill: { backgroundColor: colors.surfaceAlt }, text: { color: colors.textSecondary } };
  }
}

function buildInvoiceHTML(inv: Invoice): string {
  const fmt = (n: number) => '₹ ' + (Number(n) || 0).toFixed(2);
  const rows = inv.items
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.name)}<div class="muted">${it.unit}</div></td>
        <td class="num">${it.quantity}</td>
        <td class="num">${fmt(it.price)}</td>
        <td class="num">${fmt(it.subtotal)}</td>
      </tr>`,
    )
    .join('');
  const a = inv.address || ({} as any);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(inv.invoice_no)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#202020;padding:32px}
  h1{color:#0C831F;margin:0 0 4px} .row{display:flex;justify-content:space-between;margin-bottom:24px}
  .muted{color:#666;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{padding:8px;border-bottom:1px solid #eee;text-align:left;font-size:13px}
  th{background:#f8f8f8;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  .num{text-align:right;white-space:nowrap}
  .totals{margin-top:16px;width:280px;margin-left:auto}
  .totals .r{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid #202020;margin-top:8px;padding-top:8px;font-weight:700;color:#0C831F;font-size:18px}
  .pill{display:inline-block;background:#E6F4EA;color:#137333;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700}
</style></head>
<body>
  <div class="row">
    <div>
      <h1>Dwaarit</h1>
      <div class="muted">Fresh groceries · 10-min delivery</div>
    </div>
    <div style="text-align:right">
      <div><strong>Invoice ${escapeHtml(inv.invoice_no)}</strong></div>
      <div class="muted">${new Date(inv.date).toLocaleString()}</div>
      <div class="pill">${escapeHtml(inv.status.toUpperCase())}</div>
    </div>
  </div>

  <div class="row">
    <div>
      <div class="muted">Billed to</div>
      <div><strong>${escapeHtml(inv.customer.name || a.full_name || '')}</strong></div>
      <div class="muted">${escapeHtml(inv.customer.email || '')}</div>
      <div class="muted" style="margin-top:6px">
        ${escapeHtml(a.line1 || '')}${a.line2 ? ', ' + escapeHtml(a.line2) : ''}<br/>
        ${escapeHtml(a.city || '')} ${escapeHtml(a.pincode || '')}
      </div>
    </div>
    <div style="text-align:right">
      <div class="muted">Payment</div>
      <div><strong>${escapeHtml(String(inv.payment_method || '').toUpperCase())}</strong></div>
      <div class="muted">${escapeHtml(String(inv.payment_status || ''))}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="r"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
    <div class="r"><span>Delivery fee</span><span>${inv.delivery_fee ? fmt(inv.delivery_fee) : 'FREE'}</span></div>
    ${inv.wallet_applied ? `<div class="r"><span>Wallet applied</span><span>− ${fmt(inv.wallet_applied)}</span></div>` : ''}
    <div class="r grand"><span>Payable</span><span>${fmt(inv.payable)}</span></div>
  </div>

  <div class="muted" style="margin-top:32px;text-align:center">Thank you for shopping with Dwaarit · This is a system-generated invoice</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute', zIndex: 10,
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  backBtnInline: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadow.soft,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  countPill: {
    ...typography.tiny,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },

  // Timeline
  timeline: { paddingTop: spacing.xs },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineDotIdle: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  timelineDotPulse: { ...shadow.strong },
  timelineConnector: {
    width: 2, flex: 1, minHeight: 24,
    backgroundColor: colors.border, marginTop: 2,
  },
  timelineConnectorActive: { backgroundColor: colors.primary },
  timelineText: { flex: 1, paddingBottom: spacing.md, paddingTop: 3 },
  stepLabel: { ...typography.captionBold, color: colors.textMuted },
  stepLabelReached: { color: colors.textPrimary },
  stepHint: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  // Cancelled
  cancelBox: {
    backgroundColor: '#FCE8E6',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  cancelText: { ...typography.caption, color: '#C5221F' },

  // Items
  itemRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  itemImg: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surface },
  itemName: { ...typography.captionBold, color: colors.textPrimary },
  itemMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  itemSubtotal: { ...typography.bodyBold, color: colors.textPrimary },

  // Address
  addrBox: { backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radii.md, gap: 2 },
  addrName: { ...typography.bodyBold, color: colors.textPrimary },
  addrPhone: { ...typography.caption, color: colors.textSecondary },
  addrLines: { ...typography.caption, color: colors.textPrimary, marginTop: 4, lineHeight: 20 },
  notesBox: { marginTop: spacing.xs },
  notesLabel: { ...typography.tiny, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  notesText: { ...typography.caption, color: colors.textPrimary },

  // Payment
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  payK: { ...typography.body, color: colors.textSecondary },
  payV: { ...typography.bodyBold, color: colors.textPrimary },
  payVfree: { ...typography.bodyBold, color: colors.success },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  totalK: { ...typography.bodyBold, color: colors.textPrimary },
  totalV: { ...typography.h3, color: colors.primary },
  payMethodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  payMethodLabel: { ...typography.caption, color: colors.textSecondary },
  payMethodPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill,
  },
  payMethodText: { ...typography.tiny, fontWeight: '700', color: colors.primary },
});
