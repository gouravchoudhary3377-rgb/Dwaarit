import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/src/context/AuthContext';
import { profileApi } from '@/src/api/profile';
import { ApiError } from '@/src/api/client';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, token, refresh } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(!!user?.mobile_verified);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const mobileChanged = mobile !== (user?.mobile || '');

  function extractErr(e: unknown, fallback: string): string {
    if (e instanceof ApiError) return (e.data?.detail as string) || e.message || fallback;
    if (e instanceof Error) return e.message || fallback;
    return fallback;
  }

  const sendOtp = async () => {
    if (!token) return;
    if (!/^\d{10}$/.test(mobile)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await profileApi.sendMobileOtp(token, mobile);
      setOtpSent(true);
      setOtpVerified(false);
      setResendIn(30);
      const devOtp = (res as any)?.dev_otp;
      Alert.alert('OTP Sent', devOtp ? `Dev OTP: ${devOtp}` : 'A 6-digit OTP has been sent to your mobile.');
    } catch (e) {
      Alert.alert('Failed', extractErr(e, 'Could not send OTP. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!token) return;
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await profileApi.verifyMobileOtp(token, mobile, otp);
      setOtpVerified(true);
      await refresh();
      Alert.alert('Verified', 'Mobile number verified successfully.');
    } catch (e) {
      Alert.alert('Invalid OTP', extractErr(e, 'Verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (mobileChanged && !otpVerified) {
      Alert.alert('Verify Mobile', 'Please verify your new mobile number with OTP before saving.');
      return;
    }
    setSaving(true);
    try {
      const updates: { name?: string } = {};
      if (name.trim() !== (user?.name || '')) updates.name = name.trim();
      if (Object.keys(updates).length > 0) {
        await profileApi.update(token, updates);
      }
      await refresh();
      Alert.alert('Saved', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Update Failed', extractErr(e, 'Could not update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', color: '#1f2937' },
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputBox}>
            <Ionicons name="person-outline" size={18} color="#6b7280" />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9ca3af"
              maxLength={50}
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, styles.disabledBox]}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" />
            <Text style={styles.disabledText}>{user?.email || '—'}</Text>
          </View>
          <Text style={styles.hint}>Email cannot be changed.</Text>

          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.inputBox}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={(t) => {
                setMobile(t.replace(/[^0-9]/g, '').slice(0, 10));
                setOtpSent(false);
                if (t !== (user?.mobile || '')) setOtpVerified(false);
              }}
              placeholder="10-digit mobile"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={10}
            />
            {otpVerified && !mobileChanged && (
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            )}
          </View>

          {mobileChanged && !otpVerified && (
            <View style={styles.otpSection}>
              {!otpSent ? (
                <TouchableOpacity
                  style={[styles.otpBtn, loading && styles.btnDisabled]}
                  onPress={sendOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.otpBtnText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.label}>Enter OTP</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="keypad-outline" size={18} color="#6b7280" />
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.rowBtns}>
                    <TouchableOpacity
                      style={[styles.otpBtn, { flex: 1 }, loading && styles.btnDisabled]}
                      onPress={verifyOtp}
                      disabled={loading}
                    >
                      <Text style={styles.otpBtnText}>Verify OTP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.linkBtn]}
                      onPress={sendOtp}
                      disabled={resendIn > 0 || loading}
                    >
                      <Text style={[styles.linkText, resendIn > 0 && { color: '#9ca3af' }]}>
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingBottom: 40 },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#0c831f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 14, marginBottom: 8 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 6,
    backgroundColor: '#f9fafb',
    gap: 10,
  },
  disabledBox: { backgroundColor: '#f3f4f6' },
  disabledText: { flex: 1, color: '#6b7280', fontSize: 15 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: Platform.OS === 'android' ? 8 : 0 },
  prefix: { fontSize: 15, color: '#374151', fontWeight: '600' },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  otpSection: { marginTop: 6 },
  otpBtn: {
    backgroundColor: '#0c831f',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  otpBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  rowBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkBtn: { paddingVertical: 14, paddingHorizontal: 6 },
  linkText: { color: '#0c831f', fontWeight: '600', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#0c831f',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
