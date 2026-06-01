import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors, radii, spacing, typography } from '@/src/theme';

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (data: RazorpaySuccess) => void;
  onFailure: (reason: string) => void;

  // Razorpay order details (already created on backend)
  mode: 'live' | 'mock';
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
};

function buildCheckoutHtml(p: Props): string {
  const safe = (s: string | undefined) => (s ?? '').replace(/'/g, "\\'");
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Pay</title>
  <style>body{margin:0;font-family:-apple-system,Roboto,sans-serif;background:#FFF8F1;color:#1F2937;display:flex;align-items:center;justify-content:center;min-height:100vh;}.card{padding:24px 20px;text-align:center;}.btn{margin-top:16px;background:${safe(p.themeColor || '#F97316')};color:#fff;border:0;padding:14px 24px;border-radius:999px;font-size:16px;font-weight:700;}</style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
  <body><div class="card"><h2 style="margin:0 0 6px">${safe(p.name || 'Dwaarit Payment')}</h2><p style="margin:0;color:#6B7280;">${safe(p.description || 'Secure payment via Razorpay')}</p><button id="go" class="btn">Open Razorpay</button></div>
  <script>
  function send(msg){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }catch(e){} }
  function openCheckout(){
    var options = {
      key: '${safe(p.keyId)}',
      amount: ${p.amount},
      currency: '${safe(p.currency || 'INR')}',
      name: '${safe(p.name || 'Dwaarit')}',
      description: '${safe(p.description || 'Order Payment')}',
      order_id: '${safe(p.orderId)}',
      prefill: { name: '${safe(p.prefill?.name)}', email: '${safe(p.prefill?.email)}', contact: '${safe(p.prefill?.contact)}' },
      theme: { color: '${safe(p.themeColor || '#F97316')}' },
      modal: { ondismiss: function(){ send({type:'cancel'}); } },
      handler: function (response) { send({ type:'success', data: response }); }
    };
    try{
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp){ send({ type:'failure', error: (resp && resp.error && resp.error.description) || 'Payment failed' }); });
      rzp.open();
    }catch(err){ send({ type:'failure', error: String(err && err.message || err) }); }
  }
  document.getElementById('go').addEventListener('click', openCheckout);
  window.addEventListener('load', function(){ setTimeout(openCheckout, 300); });
  </script></body></html>`;
}

function buildMockHtml(p: Props): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Mock Pay</title>
  <style>
    body{margin:0;font-family:-apple-system,Roboto,sans-serif;background:#FFF8F1;color:#1F2937;}
    .wrap{padding:24px;max-width:480px;margin:0 auto;}
    h2{margin:0 0 4px}
    .muted{color:#6B7280;font-size:14px}
    .pill{display:inline-block;background:#FEF3C7;color:#92400E;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-top:8px}
    .card{background:#fff;border-radius:16px;padding:16px;margin-top:16px;box-shadow:0 4px 16px rgba(0,0,0,0.06)}
    .row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
    .btn{display:block;width:100%;text-align:center;border:0;padding:14px;border-radius:999px;font-size:16px;font-weight:700;margin-top:12px;cursor:pointer}
    .pay{background:#F97316;color:#fff}
    .fail{background:#fff;border:1.5px solid #E5E7EB;color:#374151}
    .cancel{background:transparent;color:#6B7280;margin-top:4px}
  </style></head><body><div class="wrap">
  <h2>${p.name || 'Dwaarit'} — Mock Payment</h2>
  <div class="muted">Razorpay keys are not configured on the server.</div>
  <div class="pill">TEST / MOCK MODE</div>
  <div class="card">
    <div class="row"><span>Order</span><strong>${p.orderId}</strong></div>
    <div class="row"><span>Amount</span><strong>₹${(p.amount/100).toFixed(2)}</strong></div>
    <div class="row"><span>Currency</span><strong>${p.currency || 'INR'}</strong></div>
    <button id="pay" class="btn pay">Simulate success</button>
    <button id="fail" class="btn fail">Simulate failure</button>
    <button id="cancel" class="btn cancel">Cancel</button>
  </div></div>
  <script>
  function send(msg){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }catch(e){} }
  function rid(p){ return p+Math.random().toString(36).slice(2,12); }
  document.getElementById('pay').onclick = function(){
    send({ type:'success', data:{
      razorpay_order_id: '${p.orderId}',
      razorpay_payment_id: rid('pay_mock_'),
      razorpay_signature: rid('sig_mock_')
    }});
  };
  document.getElementById('fail').onclick = function(){ send({ type:'failure', error:'User chose to fail (mock)' }); };
  document.getElementById('cancel').onclick = function(){ send({ type:'cancel' }); };
  </script></body></html>`;
}

export function RazorpayCheckout(props: Props) {
  const { visible, onClose, onSuccess, onFailure, mode } = props;

  const html = useMemo(
    () => (mode === 'mock' ? buildMockHtml(props) : buildCheckoutHtml(props)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, props.orderId, props.amount, props.keyId, props.currency, props.name, props.description],
  );

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data || '{}');
      if (msg.type === 'success' && msg.data) {
        onSuccess({
          razorpay_order_id: msg.data.razorpay_order_id,
          razorpay_payment_id: msg.data.razorpay_payment_id,
          razorpay_signature: msg.data.razorpay_signature,
        });
      } else if (msg.type === 'failure') {
        onFailure(msg.error || 'Payment failed');
      } else if (msg.type === 'cancel') {
        onClose();
      }
    } catch {
      onFailure('Unexpected response from payment gateway');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{mode === 'mock' ? 'Mock Razorpay' : 'Razorpay Checkout'}</Text>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="rzp-close">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading payment…</Text>
          </View>
        )}
        style={{ flex: 1, backgroundColor: colors.background }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  closeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  closeText: { ...typography.bodyBold, color: colors.textPrimary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: colors.textSecondary },
});
