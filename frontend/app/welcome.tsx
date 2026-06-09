import React, { useEffect, useRef } from 'react';
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

const HERO_IMG =
  'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/ybcapic4_IMG_5488.PNG';

const { width: W, height: H } = Dimensions.get('window');

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 8 }]}>
      <Animated.View style={[styles.inner, { opacity: fade, transform: [{ translateY: slide }] }]}>

        {/* ─── TOP: Headline + Subtitle ─── */}
        <View style={styles.topBlock}>
          <Text style={styles.headline}>{'FROM STORE TO\nDOOR IN MINUTES.'}</Text>
          <Text style={styles.subtitle}>
            Fresh groceries, daily essentials and household products delivered right to your doorstep.
          </Text>
        </View>

        {/* ─── MIDDLE: Hero Image ─── */}
        <View style={styles.heroBlock}>
          {/* Shadow plane */}
          <View style={styles.shadow} />
          <Image
            source={{ uri: HERO_IMG }}
            style={styles.heroImg}
            contentFit="contain"
            contentPosition="center"
            transition={400}
          />
        </View>

        {/* ─── BOTTOM: Buttons ─── */}
        <View style={styles.bottomBlock}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.88 }]}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.88 }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.btnSecondaryText}>Have an account? Log In</Text>
          </Pressable>

          <Pressable
            style={styles.btnGhost}
            onPress={() => router.replace('/(tabs)/home')}
            hitSlop={12}
          >
            <Text style={styles.btnGhostText}>Browse as Guest</Text>
          </Pressable>
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF4E8',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },

  /* ── Top 20% ── */
  topBlock: {
    flex: 2,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    gap: 10,
  },
  headline: {
    fontSize: 46,
    fontWeight: '900',
    color: '#1F2937',
    lineHeight: 52,
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 22,
  },

  /* ── Middle 50% ── */
  heroBlock: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: {
    width: '100%',
    height: H * 0.44,
    maxHeight: 380,
  },
  shadow: {
    position: 'absolute',
    bottom: '8%',
    width: '60%',
    height: 16,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.10)',
    alignSelf: 'center',
  },

  /* ── Bottom 30% ── */
  bottomBlock: {
    flex: 3,
    justifyContent: 'flex-end',
    gap: 12,
    paddingBottom: 8,
  },

  btn: {
    height: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnPrimary: {
    backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF6B00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF6B00',
    letterSpacing: 0.3,
  },

  btnGhost: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9CA3AF',
  },
});
