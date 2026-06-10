/**
 * Onboarding / Welcome Screen
 * ───────────────────────────────────
 * Image:   width 100%, height 78% of screen, resizeMode contain
 * Buttons: remaining 22% of screen
 * BG:      #F7EFE8
 */
import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The uploaded onboarding poster — displayed as-is, no modification
const POSTER =
  'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/1e4x9p6b_new%20new.png';

const CORAL  = '#E8735A';
const BG     = '#F7EFE8';

const { height: H } = Dimensions.get('window');

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20 }]}>

      {/* ── Image: 78% of screen height, centered, contain ── */}
      <View style={styles.imageSection}>
        <Image
          source={{ uri: POSTER }}
          style={styles.poster}
          contentFit="contain"
          contentPosition="center"
        />
      </View>

      {/* ── Buttons: 22% of screen height ── */}
      <View style={[styles.buttonsSection, { paddingBottom: Math.max(insets.bottom, 30) }]}>
        {/* Button 1: Get Started */}
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.88 }]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </Pressable>

        {/* Button 2: Have an account? Log In */}
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.88 }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.btnSecondaryText}>Have an account? Log In</Text>
        </Pressable>

        {/* Button 3: Browse as Guest */}
        <Pressable
          style={styles.btnGhost}
          onPress={() => router.replace('/(tabs)/home')}
          hitSlop={12}
        >
          <Text style={styles.btnGhostText}>Browse as Guest</Text>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingLeft: 0,
    paddingRight: 0,
  },

  // Image occupies 78% of screen height
  imageSection: {
    width: '100%',
    height: H * 0.78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    width: '100%',
    height: '100%',
  },

  // Buttons occupy 22% of screen height
  buttonsSection: {
    height: H * 0.22,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 0,
  },

  btn: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  // Primary — coral filled
  btnPrimary: {
    backgroundColor: CORAL,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Secondary — white with coral border
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: CORAL,
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '600',
    color: CORAL,
    letterSpacing: 0.2,
  },

  // Ghost — text only, height 28
  btnGhost: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: CORAL,
  },
});
