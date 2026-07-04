import React, { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radii, spacing, typography } from '@/src/theme';

const HERO_IMAGE =
  'https://drive.google.com/uc?export=view&id=1ibOgf9s8WjejMg1UE81szcVJWvNDI1Le';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_H * 0.38;

export default function Signup() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    setErr(null);
    if (!name || !email || !password) { setErr('All fields are required'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setErr(e?.message ?? 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Hero */}
      <View style={[styles.heroWrap, { height: HERO_HEIGHT }]}>
        <Image source={{ uri: HERO_IMAGE }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.taglineWrap}>
          <Text style={styles.tagline}>From Store to Door</Text>
          <Text style={styles.taglineSub}>in minutes</Text>
        </View>
      </View>

      {/* Form card */}
      <ScrollView
        style={styles.card}
        contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.sub}>Join Flynkit and get groceries delivered in minutes.</Text>

        <View style={styles.form}>
          <TextField label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 characters" />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <PrimaryButton title={loading ? 'Creating account…' : 'Create Account'} onPress={onSignup} loading={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable hitSlop={8}><Text style={styles.footerLink}>Sign In</Text></Pressable>
          </Link>
        </View>

        <Pressable onPress={() => router.replace('/(tabs)/home')} style={styles.guestBtn}>
          <Text style={styles.guestBtnText}>Continue as Guest →</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF5500' },

  heroWrap: { width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  taglineWrap: { position: 'absolute', left: 24, bottom: 28, right: 24 },
  tagline: { fontSize: 30, fontWeight: '900', color: colors.white, letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  taglineSub: { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.92)', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  card: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
  cardContent: { padding: spacing.lg, gap: spacing.md },

  heading: { ...typography.h2, color: colors.textPrimary },
  sub: { ...typography.body, color: colors.textSecondary },

  form: { gap: spacing.md },
  err: { color: colors.error, ...typography.caption },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.sm },
  footerText: { color: colors.textSecondary, ...typography.body },
  footerLink: { color: colors.primary, ...typography.bodyBold },
  guestBtn: { alignItems: 'center', paddingVertical: 8 },
  guestBtnText: { ...typography.body, color: colors.textMuted },
});
