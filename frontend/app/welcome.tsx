import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/src/api/client';

type WelcomeConfig = {
  poster_url: string;
  bg_color: string;
  accent_color: string;
  btn1_text: string;
  btn2_text: string;
  btn3_text: string;
};

// Fallback defaults if API is unreachable
const DEFAULTS: WelcomeConfig = {
  poster_url:
    'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/ncaapl5x_new%20flynk.png',
  bg_color: '#F5E2D0',
  accent_color: '#E8735A',
  btn1_text: 'Get Started',
  btn2_text: 'Have an account? Log In',
  btn3_text: 'Browse as Guest',
};

const { width: W, height: H } = Dimensions.get('window');

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const fade   = useRef(new Animated.Value(0)).current;
  const [cfg, setCfg] = useState<WelcomeConfig>(DEFAULTS);

  useEffect(() => {
    // Load branding config from backend
    api.get<{ welcome: WelcomeConfig }>('/branding', null)
      .then((data) => { if (data?.welcome) setCfg({ ...DEFAULTS, ...data.welcome }); })
      .catch(() => { /* keep defaults */ })
      .finally(() => {
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
  }, []);

  const CORAL = cfg.accent_color || DEFAULTS.accent_color;

  return (
    <Animated.View style={[styles.root, { backgroundColor: cfg.bg_color, opacity: fade }]}>

      {/* Full-width poster image — unchanged */}
      <Image
        source={{ uri: cfg.poster_url }}
        style={styles.poster}
        contentFit="fill"
        transition={300}
      />

      {/* Buttons in remaining space */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.btn, { backgroundColor: CORAL, opacity: pressed ? 0.88 : 1 }, styles.btnShadow]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnPrimaryText}>{cfg.btn1_text}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, { borderColor: CORAL, opacity: pressed ? 0.88 : 1 }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={[styles.btnSecondaryText, { color: CORAL }]}>{cfg.btn2_text}</Text>
        </Pressable>

        <Pressable
          style={styles.btnGhost}
          onPress={() => router.replace('/(tabs)/home')}
          hitSlop={12}
        >
          <Text style={[styles.btnGhostText, { color: CORAL }]}>{cfg.btn3_text}</Text>
        </Pressable>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  poster: {
    width: W,
    height: W,   // 1:1 image
  },

  actions: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },

  btn: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnShadow: {
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 7,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1.5 },
  btnSecondaryText: { fontSize: 16, fontWeight: '600' },
  btnGhost: { alignItems: 'center', paddingVertical: 8 },
  btnGhostText: { fontSize: 14, fontWeight: '500' },
});
