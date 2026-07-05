import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { TextField } from '@/src/components/ui/TextField';
import { sendFirebaseOtp, type PhoneConfirmation } from '@/src/lib/firebaseAuth';
import { colors, radii, spacing, typography } from '@/src/theme';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/d/1NipX0Vz47S0BF9Q7aiNBCnowq-vXaE3o';

const LOGO_URI =
  'https://lh3.googleusercontent.com/d/1eFN1jd-SBnKn0S2l4OLJpyyST0kVZ8X2';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_H * 0.42;

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

function parseIndianMobile(raw: string): string | null {
  let m = raw.trim().replace(/[\s-]/g, '');
  if (m.startsWith('+91')) m = m.slice(3);
  else if (m.startsWith('91') && m.length === 12) m = m.slice(2);
  return /^[6-9]\d{9}$/.test(m) ? m : null;
}

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, signInWithFirebase } = useAuth();
  // Mobile OTP tab — DISABLED (feature hidden, code preserved)
  // const [tab, setTab] = useState<Tab>('phone');
  const [tab, setTab] = useState<Tab>('email');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  // Phone state
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

  async function onEmailLogin() {
    setEmailErr(null);
    if (!email || !password) { setEmailErr('Email and password are required'); return; }
    setEmailLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(landingForRole(u?.role) as any);
    } catch (e: any) { setEmailErr(e?.message ?? 'Login failed'); }
    finally { setEmailLoading(false); }
  }

  async function onGoogle() {
    setGLoading(true);
    try {
      const u = await signInWithGoogle();
      if (u) router.replace(landingForRole(u.role) as any);
    } catch (e: any) { setEmailErr(e?.message ?? 'Google sign-in failed'); }
    finally { setGLoading(false); }
  }

  async function onSendOtp() {
    setPhoneErr(null);
    const parsed = parseIndianMobile(mobile);
    if (!parsed) { setPhoneErr('Enter a valid 10-digit Indian mobile number (starts with 6–9)'); return; }
    if (Platform.OS === 'web') {
      setPhoneErr('Firebase Phone Auth is only available on the mobile app.');
      return;
    }
    setSendingOtp(true);
    try {
      const confirmation = await sendFirebaseOtp(`+91${parsed}`);
      confirmationRef.current = confirmation;
      setStep('otp');
      setResendIn(30);
    } catch (e: any) { setPhoneErr(e?.message ?? 'Failed to send OTP'); }
    finally { setSendingOtp(false); }
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
      if (msg.includes('invalid-verification-code')) setPhoneErr('Incorrect OTP.');
      else if (msg.includes('session-expired') || msg.includes('code-expired')) { setPhoneErr('OTP expired.'); setStep('phone'); }
      else setPhoneErr(msg);
    } finally { setVerifying(false); }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Hero image — full width, top of screen */}
      <View style={[styles.heroWrap, { height: HERO_HEIGHT }]}>
        <Image
          source={{ uri: HERO_IMAGE }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Gradient scrim at bottom of hero */}
        <View style={styles.heroScrim} />
        {/* Tagline over image */}
        <View style={[styles.taglineWrap, { bottom: 28 }]}>
          <Text style={styles.tagline}>From Store to Door</Text>
          <Text style={styles.taglineSub}>in minutes</Text>
        </View>
      </View>

      {/* Form card — slides up over the hero */}
      <ScrollView
        style={styles.card}
        contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo at top of card */}
        <View style={styles.logoRow}>
          <Image source={{ uri: LOGO_URI }} style={styles.logoImg} contentFit="contain" />
        </View>

        {/* Tab toggle — HIDDEN while Phone OTP is disabled */}
        {/* To re-enable: remove the null below and restore the View */}
        {null && (
        <View style={styles.tabs}>
          <Pressable onPress={() => { setTab('phone'); setPhoneErr(null); }} style={[styles.tab, tab === 'phone' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>📱 Phone</Text>
          </Pressable>
          <Pressable onPress={() => { setTab('email'); setEmailErr(null); }} style={[styles.tab, tab === 'email' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>✉️ Email</Text>
          </Pressable>
        </View>
        )}

        {/* Phone tab */}
        {tab === 'phone' && (
          <View style={styles.form}>
            {step === 'phone' ? (
              <>
                {Platform.OS === 'web' && (
                  <View style={styles.webNotice}>
                    <Text style={styles.webNoticeText}>📲 Firebase Phone Auth requires the Flynkit mobile app.</Text>
                  </View>
                )}
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}><Text style={styles.countryCodeText}>🇮🇳 +91</Text></View>
                  <TextInput
                    style={styles.phoneInput}
                    value={mobile}
                    onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '').slice(0, 10)); setPhoneErr(null); }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                {phoneErr ? <Text style={styles.err}>{phoneErr}</Text> : null}
                <PrimaryButton title={sendingOtp ? 'Sending…' : 'Send OTP'} onPress={onSendOtp} loading={sendingOtp} disabled={Platform.OS === 'web'} />
              </>
            ) : (
              <>
                <View style={styles.otpHeader}>
                  <Text style={styles.otpTitle}>OTP sent to +91 {mobile}</Text>
                  <Pressable onPress={() => { setStep('phone'); setOtp(''); confirmationRef.current = null; }} hitSlop={8}>
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
                />
                {phoneErr ? <Text style={styles.err}>{phoneErr}</Text> : null}
                <PrimaryButton title={verifying ? 'Verifying…' : 'Verify & Login'} onPress={onVerifyOtp} loading={verifying} />
                <Pressable onPress={resendIn > 0 ? undefined : onSendOtp} disabled={resendIn > 0} style={styles.resendRow}>
                  <Text style={[styles.resendText, resendIn > 0 && { color: colors.textMuted }]}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Email tab */}
        {tab === 'email' && (
          <View style={styles.form}>
            <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            {emailErr ? <Text style={styles.err}>{emailErr}</Text> : null}
            <PrimaryButton title="Sign In" onPress={onEmailLogin} loading={emailLoading} />
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>
            <PrimaryButton title="Continue with Google" onPress={onGoogle} variant="ghost" loading={gLoading} leftIcon={<GoogleG />} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Flynkit?</Text>
          <Link href="/(auth)/signup" asChild>
            <Pressable hitSlop={8}><Text style={styles.footerLink}>Create account</Text></Pressable>
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

  // Hero
  heroWrap: { width: '100%', overflow: 'hidden' },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    background: undefined,
    backgroundColor: 'transparent',
    // gradient-like scrim from bottom
    borderBottomLeftRadius: 0,
    bottom: 0, left: 0, right: 0, height: 80,
    position: 'absolute',
    // Use a semi-transparent gradient via layered Views
  },
  taglineWrap: { position: 'absolute', left: 24, right: 24 },
  tagline: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  taglineSub: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  logoRow: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: 4 },
  logoImg: { width: 100, height: 100, borderRadius: 16 },

  // White card
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  cardContent: { padding: spacing.lg, gap: spacing.md },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.lg, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  tabActive: {
    backgroundColor: colors.white,
    ...({ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 } as any),
  },
  tabText: { ...typography.captionBold, color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  form: { gap: spacing.md },
  err: { color: colors.error, ...typography.caption },

  webNotice: { backgroundColor: '#FFF8E1', borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: '#FFD600' },
  webNoticeText: { ...typography.caption, color: '#7B5800', textAlign: 'center' },

  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.white, overflow: 'hidden' },
  countryCode: { paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 15 : 12, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface },
  countryCodeText: { ...typography.bodyBold, color: colors.textPrimary },
  phoneInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 15 : 12, ...typography.body, color: colors.textPrimary, letterSpacing: 1 },

  otpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otpTitle: { ...typography.bodyBold, color: colors.textPrimary },
  changeLink: { ...typography.captionBold, color: colors.primary },
  otpInput: { borderWidth: 2, borderColor: colors.primary, borderRadius: radii.lg, paddingVertical: 16, fontSize: 28, fontWeight: '900' as const, color: colors.textPrimary, letterSpacing: 12, textAlign: 'center', backgroundColor: colors.white },
  resendRow: { alignItems: 'center', paddingVertical: 4 },
  resendText: { ...typography.captionBold, color: colors.primary },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, ...typography.tiny },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.sm },
  footerText: { color: colors.textSecondary, ...typography.body },
  footerLink: { color: colors.primary, ...typography.bodyBold },
  guestBtn: { alignItems: 'center', paddingVertical: 8 },
  guestBtnText: { ...typography.body, color: colors.textMuted },
});
