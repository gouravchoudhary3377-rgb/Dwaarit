import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_IMG =
  'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/xh7f9s9r_E581B53F-0AA5-4BD5-B599-09652EE9A8D6.PNG';

const { height: SCREEN_H } = Dimensions.get('window');

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.inner,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {/* ── Top: Headline + Subtitle ── */}
        <View style={styles.textBlock}>
          <Text style={styles.headline}>
            From Store to{'\n'}Door in Minutes.
          </Text>
          <Text style={styles.subtitle}>
            Fresh groceries, daily essentials and household products delivered
            straight to your doorstep.
          </Text>
        </View>

        {/* ── Center: Hero Image ── */}
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: HERO_IMG }}
            style={styles.heroImage}
            contentFit="contain"
            transition={300}
          />
          {/* Subtle shadow plane */}
          <View style={styles.heroShadow} />
        </View>

        {/* ── Bottom: Buttons ── */}
        <View style={styles.actions}>
          {/* Get Started */}
          <Pressable
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && styles.btnPrimaryPressed,
            ]}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </Pressable>

          {/* Have an account? Log In */}
          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnSecondaryPressed,
            ]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.btnSecondaryText}>Have an account? Log In</Text>
          </Pressable>

          {/* Browse as Guest */}
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
    justifyContent: 'space-between',
  },

  // ── Text block ──
  textBlock: {
    gap: 12,
  },
  headline: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1F2937',
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 24,
    maxWidth: 320,
  },

  // ── Hero ──
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginVertical: 8,
  },
  heroImage: {
    width: '100%',
    height: SCREEN_H * 0.36,
    // subtle drop shadow via container styling
  },
  heroShadow: {
    width: '60%',
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 50,
    marginTop: -8,
    alignSelf: 'center',
    // blur emulated via opacity + rounded shape
  },

  // ── Buttons ──
  actions: {
    gap: 12,
  },

  // Primary — filled orange
  btnPrimary: {
    backgroundColor: '#FF6B00',
    borderRadius: 28,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryPressed: {
    backgroundColor: '#E55F00',
    shadowOpacity: 0.2,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Secondary — white with orange border
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  btnSecondaryPressed: {
    backgroundColor: '#FFF4E8',
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF6B00',
    letterSpacing: 0.2,
  },

  // Ghost — dark text
  btnGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  btnGhostText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
