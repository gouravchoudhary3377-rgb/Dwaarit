/**
 * Onboarding Screen
 * Full-screen Blinkit / Flink style — image covers 100% of device screen,
 * buttons absolutely positioned at the bottom.
 * Works on iPhone 17 Pro Max, 16, 15, and all Android devices.
 */
import React from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Google Drive direct image URL
// Using lh3.googleusercontent.com — reliable, no auth required, no CORS
const POSTER = 'https://lh3.googleusercontent.com/d/1ibOgf9s8WjejMg1UE81szcVJWvNDI1Le';

const CORAL = '#E8735A';

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Extend image behind status bar */}
      <StatusBar translucent backgroundColor="transparent" />

      {/* Full-screen image — absolutely fills every pixel */}
      <Image
        source={{ uri: POSTER }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top center"
        transition={200}
      />

      {/* Absolute bottom overlay — ONLY buttons, no card */}
      <View
        style={[
          styles.overlay,
          { bottom: Math.max(insets.bottom, 40) },
        ]}
      >
        {/* Button 1 — Get Started */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pressed && { opacity: 0.86 },
          ]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </Pressable>

        {/* Button 2 — Log In */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed && { opacity: 0.86 },
          ]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.btnSecondaryText}>Have an account? Log In</Text>
        </Pressable>

        {/* Button 3 — Guest */}
        <Pressable
          style={styles.btnGhost}
          onPress={() => router.replace('/(tabs)/home')}
          hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
        >
          <Text style={styles.btnGhostText}>Browse as Guest</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Root — flex: 1, zero padding/margin, no restrictions */
  root: {
    flex: 1,
    margin: 0,
    padding: 0,
    backgroundColor: '#F5E2D0',
  },

  /** Buttons overlay — absolutely at bottom, no background, no card */
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    gap: 14,
  },

  /** Shared button base */
  btn: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Get Started — coral filled */
  btnPrimary: {
    backgroundColor: CORAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /** Log In — white + coral border */
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: CORAL,
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: '600',
    color: CORAL,
    letterSpacing: 0.2,
  },

  /** Browse as Guest — text only, height 24 */
  btnGhost: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: CORAL,
  },
});
