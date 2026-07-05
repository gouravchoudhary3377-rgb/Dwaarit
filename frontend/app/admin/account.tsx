import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';

import { useAuth } from '@/src/context/AuthContext';
import { profileApi } from '@/src/api/profile';
import { api, ApiError } from '@/src/api/client';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

const LOGO = 'https://lh3.googleusercontent.com/d/1eFN1jd-SBnKn0S2l4OLJpyyST0kVZ8X2';

function ChevronIcon({ color = colors.textMuted }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Section = 'profile' | 'password' | 'mobile' | null;

export default function AdminAccount() {
  const insets = useSafeAreaInsets();
  const { user, token, refresh, signOut } = useAuth();
  const [open, setOpen] = useState<Section>(null);

  // Name edit
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Mobile
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(!!user?.mobile_verified);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    setName(user?.name || '');
    setMobile(user?.mobile || '');
    setOtpVerified(!!user?.mobile_verified);
  }, [user]);

  function toggleSection(s: Section) {
    setOpen((prev) => (prev === s ? null : s));
  }

  // ---- Save name ----
  async function onSaveName() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (!token) return;
    setSavingName(true);
    try {
      await profileApi.update(token, { name: name.trim() });
      await refresh();
      Alert.alert('Saved', 'Name updated successfully.');
      setOpen(null);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not update name');
    } finally {
      setSavingName(false);
    }
  }

  // ---- Change password ----
  async function onChangePassword() {
    if (!currentPw || !newPw || !confirmPw) { Alert.alert('All fields required'); return; }
    if (newPw.length < 6) { Alert.alert('Weak password', 'New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { Alert.alert('Mismatch', 'New passwords do not match.'); return; }
    if (!token) return;
    setSavingPw(true);
    try {
      await api.post('/profile/change-password', { current_password: currentPw, new_password: newPw }, token);
      Alert.alert('Password changed', 'Your password has been updated.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setOpen(null);
    } catch (e: any) {
      const msg = (e instanceof ApiError ? e.data?.detail : null) || e?.message || 'Failed to change password';
      Alert.alert('Error', msg);
    } finally {
      setSavingPw(false);
    }
  }

  // ---- Mobile OTP ----
  async function onSendOtp() {
    if (!/^\d{10}$/.test(mobile)) { Alert.alert('Invalid number', 'Enter a valid 10-digit mobile number.'); return; }
    if (!token) return;
    setSendingOtp(true);
    try {
      const res = await profileApi.sendMobileOtp(token, mobile);
      setOtpSent(true); setOtpVerified(false); setResendIn(30);
      const devOtp = (res as any)?.dev_otp;
      Alert.alert('OTP Sent', devOtp ? `Dev OTP: ${devOtp}` : 'OTP sent to your mobile.');
    } catch (e: any) { Alert.alert('Failed', e?.message || 'Could not send OTP'); }
    finally { setSendingOtp(false); }
  }

  async function onVerifyOtp() {
    if (!/^\d{6}$/.test(otp)) { Alert.alert('Invalid OTP', 'Enter 6-digit code.'); return; }
    if (!token) return;
    setVerifyingOtp(true);
    try {
      await profileApi.verifyMobileOtp(token, mobile, otp);
      setOtpVerified(true);
      await refresh();
      Alert.alert('Verified', 'Mobile number updated.');
      setOtp(''); setOtpSent(false); setOpen(null);
    } catch (e: any) { Alert.alert('Invalid OTP', e?.message || 'Verification failed'); }
    finally { setVerifyingOtp(false); }
  }

  async function onSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  }

  const isGoogle = user?.auth_provider === 'google';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.root, { paddingTop: insets.top + spacing.md }]}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Image source={{ uri: LOGO }} style={styles.logo} contentFit="contain" />
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user?.role?.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* Read-only info */}
        <View style={styles.card}>
          <InfoRow label="Email" value={user?.email || '—'} />
          <InfoRow label="Role" value={user?.role || '—'} />
          <InfoRow label="Sign-in" value={user?.auth_provider === 'google' ? 'Google' : 'Email & Password'} last />
        </View>

        {/* Edit Name */}
        <EditSection
          title="Display Name"
          current={user?.name || '—'}
          open={open === 'profile'}
          onToggle={() => toggleSection('profile')}
        >
          <Field label="Full Name">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
            />
          </Field>
          <PrimaryButton title={savingName ? 'Saving…' : 'Save Name'} onPress={onSaveName} loading={savingName} />
        </EditSection>

        {/* Change Password — not available for Google accounts */}
        {!isGoogle && (
          <EditSection
            title="Change Password"
            current="••••••••"
            open={open === 'password'}
            onToggle={() => toggleSection('password')}
          >
            <Field label="Current Password">
              <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholder="Current password" placeholderTextColor={colors.textMuted} />
            </Field>
            <Field label="New Password">
              <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Min 6 characters" placeholderTextColor={colors.textMuted} />
            </Field>
            <Field label="Confirm New Password">
              <TextInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholder="Repeat new password" placeholderTextColor={colors.textMuted} />
            </Field>
            <PrimaryButton title={savingPw ? 'Updating…' : 'Update Password'} onPress={onChangePassword} loading={savingPw} />
          </EditSection>
        )}

        {/* Mobile Number */}
        <EditSection
          title="Mobile Number"
          current={user?.mobile ? `+91 ${user.mobile}${otpVerified ? ' ✓' : ' (unverified)'}` : 'Not set'}
          open={open === 'mobile'}
          onToggle={() => toggleSection('mobile')}
        >
          <Field label="Mobile (10 digits)">
            <View style={styles.mobileRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={mobile}
                onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '').slice(0, 10)); setOtpSent(false); setOtpVerified(false); }}
                placeholder="10-digit number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </Field>
          {!otpSent ? (
            <PrimaryButton title={sendingOtp ? 'Sending…' : 'Send OTP'} onPress={onSendOtp} loading={sendingOtp} />
          ) : (
            <>
              <Field label="Enter OTP">
                <TextInput style={styles.input} value={otp} onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit OTP" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={6} />
              </Field>
              <View style={styles.otpBtnsRow}>
                <PrimaryButton title={verifyingOtp ? '…' : 'Verify'} onPress={onVerifyOtp} loading={verifyingOtp} style={{ flex: 1 }} />
                <Pressable style={styles.resendBtn} onPress={onSendOtp} disabled={resendIn > 0 || sendingOtp}>
                  <Text style={[styles.resendText, resendIn > 0 && { color: colors.textMuted }]}>
                    {resendIn > 0 ? `Resend ${resendIn}s` : 'Resend'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </EditSection>

        {/* Manage links */}
        <Text style={styles.sectionHeader}>MANAGE</Text>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <LinkRow label="Coupons" hint="Create, edit & toggle discount codes" onPress={() => router.push('/admin/coupons')} />
          <LinkRow label="Banners" hint="Manage home screen carousel" onPress={() => router.push('/admin/banners')} />
          <LinkRow label="🏪 Stores" hint="Add, edit & manage delivery stores" onPress={() => router.push('/admin/stores')} />
          <LinkRow label="Drivers" hint="Onboard & manage delivery partners" onPress={() => router.push('/admin/drivers')} />
          <LinkRow label="📦 Store Inventory" hint="Manage stock, price & availability per store" onPress={() => router.push('/admin/store-inventory')} />
          <LinkRow label="🎨 Page Branding" hint="Edit opening screen & login page" onPress={() => router.push('/admin/branding')} last />
        </View>

        <PrimaryButton title="Sign out" variant="secondary" onPress={onSignOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditSection({ title, current, open, onToggle, children }: {
  title: string; current: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.editHeader} android_ripple={{ color: colors.surface }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editTitle}>{title}</Text>
          <Text style={styles.editCurrent} numberOfLines={1}>{current}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <ChevronIcon color={open ? colors.primary : colors.textMuted} />
        </View>
      </Pressable>
      {open && <View style={styles.editBody}>{children}</View>}
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.infoKey}>{label}</Text>
      <Text style={styles.infoVal}>{value}</Text>
    </View>
  );
}

function LinkRow({ label, hint, onPress, last }: { label: string; hint?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, !last && styles.divider, pressed && { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        {!!hint && <Text style={styles.linkHint}>{hint}</Text>}
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  logo: { width: 90, height: 90, borderRadius: 14 },
  rolePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radii.pill,
  },
  roleText: { ...typography.tiny, color: colors.primary, fontWeight: '800', letterSpacing: 0.5 },

  sectionHeader: { ...typography.tiny, color: colors.textMuted, fontWeight: '700', letterSpacing: 1, marginLeft: 4, marginTop: spacing.sm },

  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, ...shadow.soft },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, alignItems: 'center' },
  infoKey: { ...typography.body, color: colors.textSecondary },
  infoVal: { ...typography.bodyBold, color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },

  editHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editTitle: { ...typography.bodyBold, color: colors.textPrimary },
  editCurrent: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  editBody: { marginTop: spacing.md, gap: spacing.sm },

  fieldWrap: { gap: 6 },
  fieldLabel: { ...typography.captionBold, color: colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 8,
    ...typography.body, color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  mobileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { ...typography.bodyBold, color: colors.textPrimary },
  otpBtnsRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  resendBtn: { paddingHorizontal: spacing.md, paddingVertical: 14 },
  resendText: { ...typography.captionBold, color: colors.primary },

  linkRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  linkLabel: { ...typography.bodyBold, color: colors.textPrimary },
  linkHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
});
