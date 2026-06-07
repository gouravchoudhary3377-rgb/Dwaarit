import React, { useEffect, useRef, useState } from 'react';
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
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { sendFirebaseOtp, type PhoneConfirmation } from '@/src/lib/firebaseAuth';
import { colors, radii, spacing, typography } from '@/src/theme';

const LOGO_URI =
  'https://static.prod-images.emergentagent.com/jobs/bdde9f90-cad7-4873-bec0-5782f2227a6f/images/1892eaf7d4a9ba405904399fa6c44397c6fce95b70715824f34db564c27d7f72.png';

function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.2 29.3 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.2 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.7 39.7 16.3 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.3 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

type Tab = 'phone' | 'email';

/** Strip spaces/dashes and validate 10-digit Indian mobile */
function parseIndianMobile(raw: string): string | null {
  let m = raw.trim().replace(/[\s-]/g, '');
  if (m.startsWith('+91')) m = m.slice(3);
  else if (m.startsWith('91') && m.length === 12) m = m.slice(2);
  return /^[6-9]\d{9}$/.test(m) ? m : null;
}

export default function Login() {
  const { signIn, signInWithGoogle, signInWithFirebase } = useAuth();
  const [tab, setTab] = useState<Tab>('phone');

  // ----- Email state -----
  const [email, setEmail] = useState('demo@dwaarit.com');
  const [password, setPassword] = useState('Demo@123');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  // ----- Firebase Phone state -----
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const confirmationRef = useRef<PhoneConfirmation | null>(null);

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

  // ---- Email / Password login ----
  async function onEmailLogin() {
    setEmailErr(null);
    if (!email || !password) { setEmailErr('Email and password are required'); return; }
    setEmailLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) {
      setEmailErr(e?.message ?? 'Login failed');
    } finally { setEmailLoading(false); }
  }

  async function onGoogle() {
    setEmailErr(null);
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) router.replace(landingForRole(u.role) as any);
    } catch (e: any) {
      setEmailErr(e?.message ?? 'Google sign-in failed');
    } finally { setGLoading(false); }
  }

  // ---- Firebase Phone Auth ----
  async function onSendOtp() {
    setPhoneErr(null);
    const parsed = parseIndianMobile(mobile);
    if (!parsed) {
      setPhoneErr('Enter a valid 10-digit Indian mobile number (starts with 6-9)');
      return;
    }
    if (Platform.OS === 'web') {
      setPhoneErr('Firebase Phone Auth is only available on the mobile app. Please use the Flynkit app on your device.');
      return;
    }
    setSendingOtp(true);
    try {
      const confirmation = await sendFirebaseOtp(`+91${parsed}`);
      confirmationRef.current = confirmation;
      setStep('otp');
      setResendIn(30);
    } catch (e: any) {
      setPhoneErr(e?.message ?? 'Failed to send OTP');
    } finally { setSendingOtp(false); }
  }

  async function onVerifyOtp() {
    setPhoneErr(null);
    if (otp.length !== 6) { setPhoneErr('Enter the 6-digit OTP'); return; }
    if (!confirmationRef.current) { setPhoneErr('Session expired — resend OTP'); return; }
    setVerifying(true);
    try {
      const firebaseIdToken = await confirmationRef.current.confirm(otp);
      const u = await signInWithFirebase(firebaseIdToken);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) {
      const msg = e?.message ?? 'Verification failed';
      // Firebase error codes
      if (msg.includes('invalid-verification-code') || msg.includes('invalid-verification')) {
        setPhoneErr('Incorrect OTP. Please check and try again.');
      } else if (msg.includes('session-expired') || msg.includes('code-expired')) {
        setPhoneErr('OTP expired. Please request a new one.');
        setStep('phone');
      } else {
        setPhoneErr(msg);
      }
    } finally { setVerifying(false); }
  }

  function onResend() {
    setOtp('');
    setStep('phone');
    confirmationRef.current = null;
  }

  function onChangeTab(t: Tab) {
    setTab(t);
    setPhoneErr(null);
    setEmailErr(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.brandRow}>
          <Image source={{ uri: LOGO_URI }} style={styles.logoImg} contentFit="contain" />
        </View>

        <Text style={styles.h1}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue your grocery run.</Text>

        {/* Tab toggle */}
        <View style={styles.tabs}>
          <Pressable onPress={() => onChangeTab('phone')} style={[styles.tab, tab === 'phone' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>📱 Phone</Text>
          </Pressable>
          <Pressable onPress={() => onChangeTab('email')} style={[styles.tab, tab === 'email' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>✉️ Email</Text>
          </Pressable>
        </View>

        {/* ===== PHONE TAB ===== */}
        {tab === 'phone' && (
          <View style={styles.form}>
            {step === 'phone' ? (
              <>
                {/* Web notice */}
                {Platform.OS === 'web' && (
                  <View style={styles.webNotice}>
                    <Text style={styles.webNoticeText}>
                      📲 Firebase Phone Auth requires the Flynkit mobile app.{"\n"}Download it on iOS or Android to sign in with your phone.
                    </Text>
                  </View>
                )}

                {/* Phone input */}
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    value={mobile}
                    onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '').slice(0, 10)); setPhoneErr(null); }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                    testID="mobile-input"
                  />
                </View>

                {phoneErr ? <Text style={styles.err}>{phoneErr}</Text> : null}

                <PrimaryButton
                  title={sendingOtp ? 'Sending OTP…' : 'Send OTP'}
                  onPress={onSendOtp}
                  loading={sendingOtp}
                  disabled={Platform.OS === 'web'}
                  testID="send-otp-btn"
                />
              </>
            ) : (
              /* OTP step */
              <>
                <View style={styles.otpHeader}>
                  <View>
                    <Text style={styles.otpTitle}>OTP sent to +91 {mobile}</Text>
                    <Text style={styles.otpSub}>Delivered via Firebase</Text>
                  </View>
                  <Pressable onPress={onResend} hitSlop={8}>
                    <Text style={styles.changeLink}>Change</Text>
                  </Pressable>
                </View>

                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setPhoneErr(null); }}
                  placeholder="• • • • • •"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                  testID="otp-input"
                />

                {phoneErr ? <Text style={styles.err}>{phoneErr}</Text> : null}

                <PrimaryButton
                  title={verifying ? 'Verifying…' : 'Verify & Login'}
                  onPress={onVerifyOtp}
                  loading={verifying}
                  testID="verify-otp-btn"
                />

                <Pressable
                  onPress={resendIn > 0 ? undefined : onResend}
                  disabled={resendIn > 0}
                  style={styles.resendRow}
                >
                  <Text style={[styles.resendText, resendIn > 0 && { color: colors.textMuted }]}>
                    {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* ===== EMAIL TAB ===== */}
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
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  tabActive: {
    backgroundColor: colors.white,
    ...({ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 } as any),
  },
  tabText: { ...typography.captionBold, color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  form: { gap: spacing.md, marginTop: spacing.sm },
  err: { color: colors.error, ...typography.caption },

  // Web notice
  webNotice: {
    backgroundColor: '#FFF8E1',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FFD600',
  },
  webNoticeText: { ...typography.caption, color: '#7B5800', textAlign: 'center', lineHeight: 20 },

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
  otpSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  changeLink: { ...typography.captionBold, color: colors.primary },
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
