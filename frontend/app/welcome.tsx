/**
 * Onboarding Screen — Full-screen cover image, buttons overlaid at bottom
 * Professional Blinkit / Flink / Foodora style
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

const POSTER =
  'https://drive.google.com/uc?export=view&id=1ibOgf9s8WjejMg1UE81szcVJWvNDI1Le';

const CORAL = '#E8735A';

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>

      {/* Full-screen image — cover, touches all edges, no margins */}
      <Image
        source={{ uri: POSTER }}
        style={styles.poster}
        contentFit="cover"
        contentPosition="top center"
      />

      {/* Absolute bottom overlay — buttons only */}
      <View style={[
        styles.overlay,
        { bottom: Math.max(insets.bottom + 20, 40) },
      ]}>
        {/* Get Started */}
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.88 }]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </Pressable>

        {/* Have an account? Log In */}
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && { opacity: 0.88 }]}
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

    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen container — no margins, no padding, no restrictions
  root: {
    flex: 1,
    backgroundColor: '#F7EFE8',
  },

  // Image fills every pixel of the screen
  poster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },

  // Buttons overlaid at bottom — no card, no wrapper
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    gap: 14,
  },

  btn: {
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnPrimary: {
    backgroundColor: CORAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

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
