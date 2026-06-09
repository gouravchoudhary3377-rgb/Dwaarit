import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type BrandingConfig = {
  welcome: {
    poster_url: string;
    bg_color: string;
    accent_color: string;
    btn1_text: string;
    btn2_text: string;
    btn3_text: string;
  };
  login: {
    hero_url: string;
    accent_color: string;
  };
};

export default function AdminBranding() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [config, setConfig] = useState<BrandingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<'welcome' | 'login'>('welcome');

  useEffect(() => {
    api.get<BrandingConfig>('/branding', null)
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function onSave() {
    if (!config || !token) return;
    setSaving(true);
    try {
      const updated = await api.put<BrandingConfig>('/admin/branding', config, token);
      setConfig(updated);
      Alert.alert('Saved!', 'Changes are now live on the app.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function setW(key: keyof BrandingConfig['welcome'], val: string) {
    if (!config) return;
    setConfig({ ...config, welcome: { ...config.welcome, [key]: val } });
  }

  function setL(key: keyof BrandingConfig['login'], val: string) {
    if (!config) return;
    setConfig({ ...config, login: { ...config.login, [key]: val } });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!config) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.root, { paddingTop: insets.top + spacing.md }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Page Branding</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Tab selector */}
        <View style={styles.tabs}>
          {(['welcome', 'login'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setPreview(t)}
              style={[styles.tab, preview === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, preview === t && styles.tabTextActive]}>
                {t === 'welcome' ? '🏠 Opening Screen' : '🔐 Login Screen'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ─── WELCOME SCREEN EDITOR ─── */}
        {preview === 'welcome' && (
          <>
            <SectionCard title="Opening Screen">
              {/* Image preview */}
              {config.welcome.poster_url ? (
                <View style={styles.previewWrap}>
                  <Image
                    source={{ uri: config.welcome.poster_url }}
                    style={styles.previewImg}
                    contentFit="contain"
                  />
                </View>
              ) : null}

              <Field label="🖼 Poster / Hero Image URL">
                <TextInput
                  style={styles.input}
                  value={config.welcome.poster_url}
                  onChangeText={(v) => setW('poster_url', v)}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  multiline
                  numberOfLines={2}
                />
                <Text style={styles.hint}>Paste any image URL. The image will be displayed full-width.</Text>
              </Field>

              <Field label="🎨 Background Color">
                <View style={styles.colorRow}>
                  <View style={[styles.colorDot, { backgroundColor: config.welcome.bg_color }]} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={config.welcome.bg_color}
                    onChangeText={(v) => setW('bg_color', v)}
                    placeholder="#F5E2D0"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              </Field>

              <Field label="🔶 Button / Accent Color">
                <View style={styles.colorRow}>
                  <View style={[styles.colorDot, { backgroundColor: config.welcome.accent_color }]} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={config.welcome.accent_color}
                    onChangeText={(v) => setW('accent_color', v)}
                    placeholder="#E8735A"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>
              </Field>

              <Field label='Button 1 Text ("Get Started")'>
                <TextInput
                  style={styles.input}
                  value={config.welcome.btn1_text}
                  onChangeText={(v) => setW('btn1_text', v)}
                  placeholder="Get Started"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label='Button 2 Text ("Log In")'>
                <TextInput
                  style={styles.input}
                  value={config.welcome.btn2_text}
                  onChangeText={(v) => setW('btn2_text', v)}
                  placeholder="Have an account? Log In"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label='Button 3 Text ("Guest")'>
                <TextInput
                  style={styles.input}
                  value={config.welcome.btn3_text}
                  onChangeText={(v) => setW('btn3_text', v)}
                  placeholder="Browse as Guest"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>
            </SectionCard>
          </>
        )}

        {/* ─── LOGIN SCREEN EDITOR ─── */}
        {preview === 'login' && (
          <SectionCard title="Login Screen">
            {config.login.hero_url ? (
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: config.login.hero_url }}
                  style={styles.previewImg}
                  contentFit="contain"
                />
              </View>
            ) : null}

            <Field label="🖼 Hero Image URL">
              <TextInput
                style={styles.input}
                value={config.login.hero_url}
                onChangeText={(v) => setL('hero_url', v)}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                multiline
                numberOfLines={2}
              />
              <Text style={styles.hint}>This image appears at the top of the login screen.</Text>
            </Field>

            <Field label="🔶 Accent Color">
              <View style={styles.colorRow}>
                <View style={[styles.colorDot, { backgroundColor: config.login.accent_color }]} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={config.login.accent_color}
                  onChangeText={(v) => setL('accent_color', v)}
                  placeholder="#E8735A"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </Field>
          </SectionCard>
        )}

        {/* Save button */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>💾 Save & Publish</Text>
          }
        </Pressable>

        <Text style={styles.liveNote}>Changes are applied instantly across the app.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { ...typography.body, color: colors.primary },
  pageTitle: { ...typography.h3, color: colors.textPrimary },

  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.lg, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white, ...shadow.soft },
  tabText: { ...typography.captionBold, color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md, ...shadow.soft },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },

  previewWrap: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  previewImg: { width: '100%', height: 200 },

  field: { gap: 6 },
  fieldLabel: { ...typography.captionBold, color: colors.textSecondary },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  hint: { ...typography.tiny, color: colors.textMuted, marginTop: 3 },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colorDot: { width: 36, height: 36, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  saveBtnText: { ...typography.bodyBold, color: colors.white, fontSize: 17 },
  liveNote: { ...typography.tiny, color: colors.textMuted, textAlign: 'center', marginTop: -spacing.sm },
});
