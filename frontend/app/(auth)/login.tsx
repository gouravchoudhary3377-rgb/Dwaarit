import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { DwaaritMark } from '@/src/components/icons/TabIcons';
import { colors, radii, spacing, typography } from '@/src/theme';

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.2 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.2 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z"/>
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.7 39.7 16.3 44 24 44z"/>
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.3 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </Svg>
  );
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('demo@dwaarit.com');
  const [password, setPassword] = useState('Demo@123');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  function landingForRole(role?: string) {
    if (role === 'store_manager') return '/store/dashboard';
    if (role === 'admin' || role === 'super_admin') return '/admin/orders';
    if (role === 'rider') return '/rider/dashboard';
    return '/(tabs)/home';
  }

  async function onSubmit() {
    setErr(null);
    if (!email || !password) {
      setErr('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setErr(null);
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) router.replace(landingForRole(u.role) as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <DwaaritMark color={colors.primary} size={64} />
          <Text style={styles.brand}>Dwaarit</Text>
        </View>
        <Text style={styles.h1}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue your grocery run.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            testID="login-email-input"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            testID="login-password-input"
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <PrimaryButton title="Sign In" onPress={onSubmit} loading={loading} testID="login-btn" />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <PrimaryButton
            title="Continue with Google"
            onPress={onGoogle}
            variant="ghost"
            loading={gLoading}
            leftIcon={<GoogleG />}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Dwaarit?</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { ...typography.h2, color: colors.textPrimary },
  h1: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.md },
  err: { color: colors.error, ...typography.caption },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, ...typography.tiny },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  footerText: { color: colors.textSecondary, ...typography.body },
  footerLink: { color: colors.primary, ...typography.bodyBold },
});
