/**
 * AuthGate component.
 * Wraps screens that require authentication.
 * When a guest hits a protected screen, shows a friendly sign-in prompt
 * instead of silently redirecting (which would lose their cart/navigation context).
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

const LOGO =
  'https://static.prod-images.emergentagent.com/jobs/bdde9f90-cad7-4873-bec0-5782f2227a6f/images/1892eaf7d4a9ba405904399fa6c44397c6fce95b70715824f34db564c27d7f72.png';

function LockIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 11V8a7 7 0 1 1 14 0v3M3 11h18v11H3V11z"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 16v2" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type Props = {
  /** What the user needs to be authenticated for (shown in the prompt) */
  reason: string;
  children: React.ReactNode;
};

/**
 * Renders `children` when the user is authenticated.
 * Shows a sign-in prompt otherwise — no hard redirect so back navigation works.
 */
export function AuthGate({ reason, children }: Props) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Image source={{ uri: LOGO }} style={styles.logo} contentFit="contain" />

      <View style={styles.iconWrap}>
        <LockIcon />
      </View>

      <Text style={styles.title}>Sign in required</Text>
      <Text style={styles.sub}>{reason}</Text>

      <View style={styles.buttons}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.secondaryBtnText}>Create an account</Text>
        </Pressable>

        <Pressable
          style={styles.ghostBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.ghostBtnText}>← Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  logo: { width: 140, height: 70, marginBottom: spacing.sm },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  buttons: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.soft,
  },
  primaryBtnText: { ...typography.bodyBold, color: colors.white },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { ...typography.bodyBold, color: colors.primary },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { ...typography.body, color: colors.textSecondary },
});
