import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, radii, shadow, spacing, typography } from '@/src/theme';

export type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
};

type ToastApi = {
  show: (message: string, opts?: { kind?: ToastKind; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so calls before mount don't crash
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>((message, opts) => {
    const id = ++idRef.current;
    const kind: ToastKind = opts?.kind ?? 'info';
    const duration = opts?.duration ?? 2600;
    setItems((prev) => [...prev, { id, kind, message, duration }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, d) => show(m, { kind: 'success', duration: d }),
      error: (m, d) => show(m, { kind: 'error', duration: d }),
      info: (m, d) => show(m, { kind: 'info', duration: d }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.viewport, { bottom: insets.bottom + spacing.lg }]}>
      {items.map((t) => (
        <ToastBubble key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const translate = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translate, { toValue: 20, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onDismiss(item.id));
    }, item.duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const palette = paletteFor(item.kind);

  return (
    <Animated.View
      style={[
        styles.bubble,
        { backgroundColor: palette.bg, borderColor: palette.border, transform: [{ translateY: translate }], opacity },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
        <KindIcon kind={item.kind} color={palette.iconColor} />
      </View>
      <Text numberOfLines={3} style={[styles.message, { color: palette.text }]}>
        {item.message}
      </Text>
      <Pressable onPress={() => onDismiss(item.id)} hitSlop={10} style={styles.close}>
        <Text style={[styles.closeTxt, { color: palette.text }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

function paletteFor(kind: ToastKind) {
  if (kind === 'success') {
    return {
      bg: '#0F3D2C',
      border: '#14573E',
      iconBg: 'rgba(52,199,89,0.18)',
      iconColor: '#34C759',
      text: '#ECFDF5',
    };
  }
  if (kind === 'error') {
    return {
      bg: '#3A1414',
      border: '#5A1F1F',
      iconBg: 'rgba(255,59,48,0.18)',
      iconColor: '#FF6B5E',
      text: '#FFE5E2',
    };
  }
  return {
    bg: '#1A1512',
    border: '#2E2723',
    iconBg: 'rgba(255,90,0,0.18)',
    iconColor: colors.primary,
    text: '#FFFFFF',
  };
}

function KindIcon({ kind, color }: { kind: ToastKind; color: string }) {
  if (kind === 'success') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12.5l4 4 10-10" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (kind === 'error') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 8v5" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M12 16.5h.01" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 8.5h.01" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M11 12h2v5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 9999,
    elevation: 9999,
    ...(Platform.OS === 'web' ? ({ pointerEvents: 'box-none' } as any) : null),
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 480,
    width: '100%',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    ...typography.captionBold,
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 22, lineHeight: 22, fontWeight: '600' },
});
