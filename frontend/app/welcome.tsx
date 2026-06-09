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

// Hero: the Flynkit grocery bag
const HERO_IMG =
  'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/htqs25bj_E581B53F-0AA5-4BD5-B599-09652EE9A8D6.PNG';

// Brand coral — matches the reference mockup
const CORAL = '#E8735A';
const BG    = '#FFF0EA'; // warm light peach

const { width: W, height: H } = Dimensions.get('window');

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 8 }]}>
      <Animated.View style={[styles.inner, { opacity: fade, transform: [{ translateY: slide }] }]}>

        {/* ─── TOP: Headline + Subtitle ─── */}
        <View style={styles.topBlock}>
          {/* Headline — "MINUTES." gets the coral accent */}
          <Text style={styles.headlineDark}>{'FROM STORE\nTO DOOR IN'}</Text>
          <Text style={styles.headlineCoral}>MINUTES.</Text>
          <Text style={styles.subtitle}>
            {'Fresh groceries, daily essentials and\nhousehold products delivered right\nto your doorstep.'}
          </Text>
        </View>

        {/* ─── MIDDLE: Hero image ─── */}
        <View style={styles.heroBlock}>
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
    backgroundColor: BG,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },

  /* ── Top block */
  topBlock: {
    flex: 2,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    gap: 4,
  },
  headlineDark: {
    fontSize: 46,
    fontWeight: '900',
    color: '#1A1A1A',
    lineHeight: 52,
    letterSpacing: -1,
  },
  headlineCoral: {
    fontSize: 46,
    fontWeight: '900',
    color: CORAL,
    lineHeight: 52,
    letterSpacing: -1,
    marginTop: -4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#555555',
    lineHeight: 22,
    marginTop: 6,
  },

  /* ── Hero */
  heroBlock: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: {
    width: '100%',
    height: H * 0.44,
    maxHeight: 390,
  },
  shadow: {
    position: 'absolute',
    bottom: '8%',
    width: '55%',
    height: 14,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.09)',
    alignSelf: 'center',
  },

  /* ── Buttons */
  bottomBlock: {
    flex: 3,
    justifyContent: 'flex-end',
    gap: 12,
    paddingBottom: 8,
  },
  btn: {
    height: 56,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: CORAL,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: CORAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '600',
    color: CORAL,
    letterSpacing: 0.2,
  },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '500',
    color: CORAL,
  },
});
