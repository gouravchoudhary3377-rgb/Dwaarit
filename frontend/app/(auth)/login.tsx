import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/api/client';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { colors, radii, spacing, typography } from '@/src/theme';

const LOGO_URI = 'https://static.prod-images.emergentagent.com/jobs/bdde9f90-cad7-4873-bec0-5782f2227a6f/images/1892eaf7d4a9ba405904399fa6c44397c6fce95b70715824f34db564c27d7f72.png';

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

type Tab = 'email' | 'mobile';

export default function Login() {
  const { signIn, signInWithGoogle, signInWithMobile } = useAuth();
  const [tab, setTab] = useState<Tab>('mobile');

  // Email login state
  const [email, setEmail] = useState('demo@dwaarit.com');
  const [password, setPassword] = useState('Demo@123');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  // Mobile OTP state
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [mobileErr, setMobileErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function landingForRole(role?: string) {
    if (role === 'store_manager') return '/store/dashboard';
    if (role === 'admin' || role === 'super_admin') return '/admin/orders';
    if (role === 'rider') return '/rider/dashboard';
    return '/(tabs)/home';
  }

  // ---- Email login ----
  async function onEmailLogin() {
    setEmailErr(null);
    if (!email || !password) { setEmailErr('Email and password are required'); return; }
    setEmailLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) {
      setEmailErr(e?.message ?? 'Login failed');
    } finally {
      setEmailLoading(false);
    }
  }

  async function onGoogle() {
    setEmailErr(null);
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) router.replace(landingForRole(u.role) as any);
    } catch (e: any) {
      setEmailErr(e?.message ?? 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  }

  // ---- Mobile OTP login ----
  async function onSendOtp() {
    setMobileErr(null);
    if (!/^\d{10}$/.test(mobile)) {
      setMobileErr('Enter a valid 10-digit mobile number');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await api.post<any>('/auth/mobile/send-otp', { mobile });
      setOtpSent(true);
      setResendIn(30);
      setDevOtp(res?.dev_otp || null);
    } catch (e: any) {
      setMobileErr(e?.message ?? 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  }

  async function onVerifyOtp() {
    setMobileErr(null);
    if (!/^\d{6}$/.test(otp)) {
      setMobileErr('Enter the 6-digit OTP');
      return;
    }
    setVerifyingOtp(true);
    try {
      const u = await signInWithMobile(mobile, otp);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) {
      setMobileErr(e?.message ?? 'Invalid OTP');
    } finally {
      setVerifyingOtp(false);
    }
  }

  function onChangeTab(t: Tab) {
    setTab(t);
    setEmailErr(null);
    setMobileErr(null);
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
        {/* Logo */}
        <View style={styles.brandRow}>
          <Image source={{ uri: LOGO_URI }} style={styles.logoImg} contentFit="contain" />
        </View>

        <Text style={styles.h1}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue your grocery run.</Text>

        {/* Tab toggle */}
        <View style={styles.tabs}>
          <Pressable
            onPress={() => onChangeTab('mobile')}
            style={[styles.tab, tab === 'mobile' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'mobile' && styles.tabTextActive]}>📱 Mobile OTP</Text>
          </Pressable>
          <Pressable
            onPress={() => onChangeTab('email')}
            style={[styles.tab, tab === 'email' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>✉️ Email</Text>
          </Pressable>
        </View>

        {/* Mobile OTP tab */}
        {tab === 'mobile' && (
          <View style={styles.form}>
            {!otpSent ? (
              <>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    value={mobile}
                    onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '').slice(0, 10)); setMobileErr(null); }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    testID="mobile-input"
                  />
                </View>
                {mobileErr ? <Text style={styles.err}>{mobileErr}</Text> : null}
                <PrimaryButton
                  title={sendingOtp ? 'Sending OTP…' : 'Send OTP'}
                  onPress={onSendOtp}
                  loading={sendingOtp}
                  testID="send-otp-btn"
                />
              </>
            ) : (
              <>
                <View style={styles.otpHeader}>
                  <Text style={styles.otpTitle}>OTP sent to +91 {mobile}</Text>
                  <Pressable onPress={() => { setOtpSent(false); setOtp(''); setDevOtp(null); }} hitSlop={8}>
                    <Text style={styles.changeLink}>Change</Text>
                  </Pressable>
                </View>

                {devOtp ? (
                  <View style={styles.devOtpBox}>
                    <Text style={styles.devOtpLabel}>Dev mode OTP:</Text>
                    <Text style={styles.devOtpVal}>{devOtp}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setMobileErr(null); }}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                  testID="otp-input"
                />

                {mobileErr ? <Text style={styles.err}>{mobileErr}</Text> : null}

                <PrimaryButton
                  title={verifyingOtp ? 'Verifying…' : 'Verify & Login'}
                  onPress={onVerifyOtp}
                  loading={verifyingOtp}
                  testID="verify-otp-btn"
                />

                <Pressable
                  onPress={resendIn > 0 ? undefined : onSendOtp}
                  style={styles.resendRow}
                  disabled={resendIn > 0}
                >
                  <Text style={[styles.resendText, resendIn > 0 && { color: colors.textMuted }]}>
                    {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Email tab */}
        {tab === 'email' && (
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
            {emailErr ? <Text style={styles.err}>{emailErr}</Text> : null}
            <PrimaryButton title="Sign In" onPress={onEmailLogin} loading={emailLoading} testID="login-btn" />

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
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Flynkit?</Text>
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
  brandRow: { alignItems: 'center', marginBottom: spacing.sm },
  logoImg: { width: 220, height: 130 },
  h1: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { ...typography.body, color: colors.textSecondary },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 4,
    marginTop: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.white, ...({ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 } as any) },
  tabText: { ...typography.captionBold, color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  form: { gap: spacing.md, marginTop: spacing.sm },
  err: { color: colors.error, ...typography.caption },

  // Phone input
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  countryCodeText: { ...typography.bodyBold, color: colors.textPrimary },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    ...typography.body,
    color: colors.textPrimary,
    letterSpacing: 1,
  },

  // OTP step
  otpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otpTitle: { ...typography.bodyBold, color: colors.textPrimary },
  changeLink: { ...typography.captionBold, color: colors.primary },
  devOtpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF9E6',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFD600',
  },
  devOtpLabel: { ...typography.caption, color: '#7B5800' },
  devOtpVal: { ...typography.h2, color: '#E65100', letterSpacing: 6 },
  otpInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '900' as const,
    color: colors.textPrimary,
    letterSpacing: 12,
    textAlign: 'center',
    backgroundColor: colors.white,
  },
  resendRow: { alignItems: 'center', paddingVertical: 4 },
  resendText: { ...typography.captionBold, color: colors.primary },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, ...typography.tiny },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg },
  footerText: { color: colors.textSecondary, ...typography.body },
  footerLink: { color: colors.primary, ...typography.bodyBold },
});
