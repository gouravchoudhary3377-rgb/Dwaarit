import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme';

const LOGO_URI = 'https://static.prod-images.emergentagent.com/jobs/bdde9f90-cad7-4873-bec0-5782f2227a6f/images/1892eaf7d4a9ba405904399fa6c44397c6fce95b70715824f34db564c27d7f72.png';

export default function Signup() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);
    if (!name || !email || !password) { setErr('All fields are required'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const u = await signUp(email.trim(), password, name.trim());
      router.replace(u.role === 'admin' ? '/admin/orders' : '/(tabs)/home');
    } catch (e: any) {
      setErr(e?.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={{ uri: LOGO_URI }} style={styles.logoImg} contentFit="contain" />
        </View>
        <Text style={styles.h1}>Create your account</Text>
        <Text style={styles.sub}>Get fresh groceries delivered in minutes.</Text>

        <View style={styles.form}>
          <TextField label="Full name" value={name} onChangeText={setName} placeholder="Alex Carter" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Min 6 characters"
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <PrimaryButton title="Create Account" onPress={onSubmit} loading={loading} testID="signup-btn" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md },
  brandRow: { alignItems: 'center', marginBottom: spacing.sm },
  logoImg: { width: 180, height: 90 },
  brand: { ...typography.h2, color: colors.textPrimary },
  h1: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.md },
  err: { color: colors.error, ...typography.caption },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg },
  footerText: { color: colors.textSecondary, ...typography.body },
  footerLink: { color: colors.primary, ...typography.bodyBold },
});
