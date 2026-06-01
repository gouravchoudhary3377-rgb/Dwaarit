import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';

import { api, Order, OrderDriverLocation } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { StatusBadge } from '@/src/components/StatusBadge';

// Driver simulation constants
const TOTAL_DURATION_SEC = 20 * 60; // 20 minutes
const START_LAT = 32.377656849132926;
const START_LNG = 75.52759248737019;

// Approx destination ~ a few km away from start (used as fallback if address has no coords)
// We'll attempt to geocode the order address client-side via Nominatim; fallback below.
const FALLBACK_DEST_LAT = 32.34568;
const FALLBACK_DEST_LNG = 75.55621;

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

function PhoneIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.98.36 1.94.7 2.86a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.22-1.27a2 2 0 0 1 2.11-.45c.92.34 1.88.57 2.86.7A2 2 0 0 1 22 16.92Z"
        stroke={colors.white}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatETA(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Arriving now';
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  if (m >= 1) return `${m} min ${s.toString().padStart(2, '0')} sec`;
  return `${s} sec`;
}

// Build the Leaflet HTML page injected into the WebView.
function buildMapHTML(opts: {
  startLat: number;
  startLng: number;
  destLat: number;
  destLng: number;
  durationSec: number;
  initialProgress: number; // 0..1
  searchQuery: string; // Nominatim query string for geocoding
}): string {
  const {
    startLat,
    startLng,
    destLat,
    destLng,
    durationSec,
    initialProgress,
    searchQuery,
  } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Live Tracking</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eaf1ee; }
    .driver-marker {
      width: 44px; height: 44px;
      background: #FF6A00;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 6px 14px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      transform: translate(-22px,-22px);
    }
    .pin {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      transform: translate(-16px,-32px);
    }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var start = [${startLat}, ${startLng}];
      var dest = [${destLat}, ${destLng}];
      var durationSec = ${durationSec};
      var initialProgress = ${initialProgress};
      var searchQuery = ${JSON.stringify(searchQuery)};

      var map = L.map('map', { zoomControl: true, attributionControl: true }).setView(start, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OSM'
      }).addTo(map);

      var startIcon = L.divIcon({ className: '', html: '<div class="pin">🏬</div>', iconSize: [32,32] });
      var destIcon  = L.divIcon({ className: '', html: '<div class="pin">📍</div>', iconSize: [32,32] });
      var driverIcon = L.divIcon({ className: '', html: '<div class="driver-marker">🛵</div>', iconSize: [44,44] });

      var startMarker = L.marker(start, { icon: startIcon }).addTo(map).bindPopup('Pickup');
      var destMarker  = L.marker(dest,  { icon: destIcon  }).addTo(map).bindPopup('Delivery');
      var route       = L.polyline([start, dest], { color: '#FF6A00', weight: 4, opacity: 0.85, dashArray: '8 8' }).addTo(map);
      var traveled    = L.polyline([start], { color: '#0C831F', weight: 5, opacity: 0.95 }).addTo(map);
      var driver      = L.marker(start, { icon: driverIcon }).addTo(map);

      try { map.fitBounds(route.getBounds(), { padding: [60, 60] }); } catch (e) {}

      function interp(a, b, t) { return a + (b - a) * t; }

      function postProgress(p, lat, lng) {
        var payload = { type: 'progress', progress: p, lat: lat, lng: lng };
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function setProgress(p) {
        p = Math.max(0, Math.min(1, p));
        var lat = interp(start[0], dest[0], p);
        var lng = interp(start[1], dest[1], p);
        driver.setLatLng([lat, lng]);
        traveled.setLatLngs([start, [lat, lng]]);
        postProgress(p, lat, lng);
      }

      // Optional geocoding: try to find a better destination if searchQuery is non-empty.
      function tryGeocode() {
        if (!searchQuery) return;
        var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(searchQuery);
        fetch(url, { headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (Array.isArray(data) && data.length > 0) {
              var newDest = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
              if (!isNaN(newDest[0]) && !isNaN(newDest[1])) {
                dest = newDest;
                destMarker.setLatLng(dest);
                route.setLatLngs([start, dest]);
                try { map.fitBounds(route.getBounds(), { padding: [60, 60] }); } catch (e) {}
              }
            }
          })
          .catch(function () {});
      }
      tryGeocode();

      var progress = initialProgress;
      var startTs = Date.now() - (initialProgress * durationSec * 1000);
      setProgress(progress);

      // When live mode is enabled (real driver location available), we pause the simulation.
      var liveMode = false;

      var tick = setInterval(function () {
        if (liveMode) return;
        var elapsed = (Date.now() - startTs) / 1000;
        var p = elapsed / durationSec;
        if (p >= 1) {
          p = 1;
          setProgress(p);
          clearInterval(tick);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'arrived' }));
          }
          return;
        }
        setProgress(p);
      }, 1000);

      // Expose a recenter API
      window.recenter = function () {
        try { map.fitBounds(route.getBounds(), { padding: [60, 60] }); } catch (e) {}
      };

      // Expose a live-driver-location API. Once invoked, simulation pauses and
      // the driver marker / traveled-path follow the real coordinates.
      window.setLiveDriver = function (lat, lng) {
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        liveMode = true;
        driver.setLatLng([lat, lng]);
        traveled.setLatLngs([start, [lat, lng]]);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'live', lat: lat, lng: lng })
          );
        }
      };
    })();
    true;
  </script>
</body>
</html>`;
}

export default function OrderTrack() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_DURATION_SEC);
  const [riderInfo, setRiderInfo] = useState<OrderDriverLocation | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Persist a per-order start time so the simulation continues across refreshes.
  const simStartMsRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      const o = await api.get<Order>(`/orders/${id}`, token);
      setOrder(o);
    } catch (e) {
      console.warn('order load failed', e);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  // Poll live driver location/assignment for this order
  const loadRider = useCallback(async () => {
    if (!id || !token) return;
    try {
      const info = await api.get<OrderDriverLocation>(
        `/orders/${id}/driver-location`,
        token,
      );
      setRiderInfo(info);
    } catch (e) {
      // ignore polling errors; UI will just keep last good state
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(useCallback(() => { load(); loadRider(); }, [load, loadRider]));

  // Periodic polling for driver assignment + live location
  useEffect(() => {
    if (!order) return;
    // stop polling for terminal states
    if (['delivered', 'cancelled'].includes(order.status)) return;
    loadRider();
    const t = setInterval(loadRider, 5000);
    return () => clearInterval(t);
  }, [order, loadRider]);

  // When live location available, push it into the WebView so the marker tracks the real rider.
  useEffect(() => {
    if (!riderInfo || !('assigned' in riderInfo) || !riderInfo.assigned) return;
    const lat = riderInfo.location?.lat;
    const lng = riderInfo.location?.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const js = `window.setLiveDriver && window.setLiveDriver(${lat}, ${lng}); true;`;
      webViewRef.current?.injectJavaScript(js);
    }
  }, [riderInfo]);

  // Compute initial progress based on order created_at -> elapsed seconds
  const initialProgress = useMemo(() => {
    if (!order) return 0;
    const createdMs = new Date(order.created_at).getTime();
    if (!isFinite(createdMs)) return 0;
    const elapsed = (Date.now() - createdMs) / 1000;
    const p = elapsed / TOTAL_DURATION_SEC;
    return Math.max(0, Math.min(0.98, p));
  }, [order]);

  // Initialise simStart anchor when order arrives
  useEffect(() => {
    if (!order) return;
    const createdMs = new Date(order.created_at).getTime();
    simStartMsRef.current = isFinite(createdMs) ? createdMs : Date.now();
  }, [order]);

  // Local countdown timer (independent from webview; keeps the UI ticking smoothly)
  useEffect(() => {
    if (!order) return;
    const tick = () => {
      const startMs = simStartMsRef.current ?? Date.now();
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const left = Math.max(0, TOTAL_DURATION_SEC - elapsed);
      setSecondsLeft(left);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  const mapHtml = useMemo(() => {
    if (!order) return '';
    const a = order.address;
    const q = [a.line1, a.line2, a.city, a.pincode, 'India']
      .filter(Boolean)
      .join(', ');
    return buildMapHTML({
      startLat: START_LAT,
      startLng: START_LNG,
      destLat: FALLBACK_DEST_LAT,
      destLng: FALLBACK_DEST_LNG,
      durationSec: TOTAL_DURATION_SEC,
      initialProgress,
      searchQuery: q,
    });
  }, [order, initialProgress]);

  const assignedDriver =
    riderInfo && 'assigned' in riderInfo && riderInfo.assigned
      ? riderInfo.driver
      : null;
  const driverPhone = assignedDriver?.phone || '';

  const onCallDriver = useCallback(() => {
    if (!driverPhone) {
      Alert.alert(
        'Driver not assigned yet',
        'We will share contact details as soon as a rider accepts your order.',
      );
      return;
    }
    const tel = driverPhone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${tel}`).catch(() =>
      Alert.alert('Unable to call', 'Please try again later.'),
    );
  }, [driverPhone]);

  const onChatSupport = useCallback(() => {
    router.push('/profile/support' as any);
  }, []);

  const onRecenter = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.recenter && window.recenter(); true;');
  }, []);

  if (loading || !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: spacing.sm, color: colors.textSecondary }}>
          Loading live tracking…
        </Text>
      </View>
    );
  }

  const isLive = ['pending', 'accepted', 'out_for_delivery'].includes(order.status);
  const arrived = secondsLeft <= 0;
  const etaLabel = arrived
    ? 'Driver has arrived'
    : `Arriving in ${formatETA(secondsLeft)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <BackArrow />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Live tracking</Text>
          <Text style={styles.headerSub}>
            Order #{order.order_id.slice(-6).toUpperCase()}
          </Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {Platform.OS === 'web' ? (
          // On web, WebView is unsupported in expo-router preview; show an iframe-like fallback.
          <View style={[styles.mapInner, styles.center]}>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg }}>
              Live map tracking is available on the mobile app. Tap “Track live on map” inside the Dwaarit app on your phone.
            </Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapHtml }}
            style={styles.mapInner}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            startInLoadingState
            renderLoading={() => (
              <View style={[styles.mapInner, styles.center]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          />
        )}

        {/* Recenter floating btn */}
        <Pressable style={styles.recenterBtn} onPress={onRecenter} hitSlop={10}>
          <Text style={styles.recenterIcon}>⊙</Text>
        </Pressable>
      </View>

      {/* Bottom info sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.etaPill}>
          <View style={[styles.etaDot, arrived && { backgroundColor: colors.success }]} />
          <Text style={styles.etaPillText}>{etaLabel}</Text>
        </View>

        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {assignedDriver?.name ? assignedDriver.name.trim().charAt(0).toUpperCase() : '🛵'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {assignedDriver ? (
              <>
                <Text style={styles.driverName} numberOfLines={1}>
                  {assignedDriver.name || 'Delivery partner'} · Delivery partner
                </Text>
                <Text style={styles.driverMeta} numberOfLines={1}>
                  {(assignedDriver.vehicle || 'Two-wheeler')}
                  {driverPhone ? ` · ${driverPhone}` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.driverName}>Finding a rider for you…</Text>
                <Text style={styles.driverMeta}>
                  We&apos;ll share rider details as soon as one accepts.
                </Text>
              </>
            )}
          </View>
          <Pressable
            style={[styles.callBtn, !driverPhone && styles.callBtnDisabled]}
            onPress={onCallDriver}
            hitSlop={10}
          >
            <PhoneIcon />
          </Pressable>
        </View>

        <View style={styles.addrBox}>
          <Text style={styles.addrLabel}>Delivering to</Text>
          <Text style={styles.addrName}>{order.address.full_name}</Text>
          <Text style={styles.addrLines}>
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ''}
            {`\n${order.address.city} ${order.address.pincode}`}
          </Text>
        </View>

        {!isLive ? (
          <View style={styles.endedBox}>
            <Text style={styles.endedText}>
              This order is not active anymore. Tracking is shown for reference only.
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.supportBtn} onPress={onChatSupport} android_ripple={{ color: colors.primarySoft }}>
          <ChatIcon />
          <Text style={styles.supportText}>Chat with support</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    zIndex: 5,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  mapWrap: { flex: 1, backgroundColor: '#eaf1ee', overflow: 'hidden' },
  mapInner: { flex: 1, backgroundColor: '#eaf1ee' },

  recenterBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.soft,
  },
  recenterIcon: { fontSize: 22, color: colors.primary, fontWeight: '800' },

  sheet: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadow.strong,
    gap: spacing.sm,
  },

  etaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  etaDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  etaPillText: {
    ...typography.captionBold,
    color: colors.primary,
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.bodyBold, color: colors.primary },
  driverName: { ...typography.bodyBold, color: colors.textPrimary },
  driverMeta: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  callBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.85,
  },

  addrBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm,
    borderRadius: radii.md,
    gap: 2,
  },
  addrLabel: { ...typography.tiny, color: colors.textSecondary, textTransform: 'uppercase' },
  addrName: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 4 },
  addrLines: { ...typography.caption, color: colors.textPrimary, marginTop: 2, lineHeight: 20 },

  endedBox: {
    backgroundColor: '#FEF7E0',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  endedText: { ...typography.caption, color: '#8B6F00' },

  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  supportText: { ...typography.bodyBold, color: colors.primary },
});
