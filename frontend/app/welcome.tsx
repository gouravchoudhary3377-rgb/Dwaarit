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

const POSTER =
  'https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/ncaapl5x_new%20flynk.png';

const CORAL = '#E8735A';

const { width: W, height: H } = Dimensions.get('window');
// Image is square (1080×1080). Fill full screen width and keep 1:1 ratio.
const IMG_H = W;

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>

      {/* ─── Poster image: full width, no cropping ─── */}
      <Image
        source={{ uri: POSTER }}
        style={styles.poster}
        contentFit="fill"
        transition={300}
      />

      {/* ─── Buttons: fill remaining space below the image ─── */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5E2D0', // matches image peach background
  },

  poster: {
    width: W,
    height: IMG_H,    // exactly screen width (1:1 image)
  },

  // Remaining screen space below the image — fill it with buttons
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
  btnPrimary: {
    backgroundColor: CORAL,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 7,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: CORAL,
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: CORAL,
  },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: CORAL,
  },
});
