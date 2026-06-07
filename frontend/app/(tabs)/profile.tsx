import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

import { useAuth } from '@/src/context/AuthContext';
import { api, Order } from '@/src/api/client';
import { profileApi } from '@/src/api/profile';
import { AuthGate } from '@/src/components/AuthGate';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';
import { formatINR } from '@/src/utils/format';

const APP_VERSION = '1.0.0';

function avatarFor(seed: string) {
  // Deterministic, professional illustrated avatar (notionists-neutral style)
  // Falls back gracefully if network is offline.
  const s = encodeURIComponent(seed || 'guest');
  return `https://api.dicebear.com/9.x/notionists-neutral/png?seed=${s}&backgroundColor=ffe5d4,ffd5b4,fff1e6,e8f5e9&radius=50`;
}

/* -------------------- ICONS -------------------- */
const IC = {
  pencil: (c: string) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  chevron: (c: string) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  bag: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 7h12l-1 13H7L6 7zM9 7V5a3 3 0 016 0v2"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  pin: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-6.5-7-12a7 7 0 1114 0c0 5.5-7 12-7 12z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.4} stroke={c} strokeWidth={2} />
    </Svg>
  ),
  wallet: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7a2 2 0 012-2h12v4h2a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={17} cy={13} r={1.4} fill={c} />
    </Svg>
  ),
  gift: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10h18v4H3zM5 14v7h14v-7" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path
        d="M12 21V10M12 10s-3-1-3-4 3-3 3 0c0-3 3-3 3 0s-3 4-3 4z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  ),
  help: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path
        d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={17} r={1} fill={c} />
    </Svg>
  ),
  info: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path d="M12 11v6M12 7.5v.5" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  ),
  shield: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"
        stroke={c}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  doc: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  ),
  dashboard: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM3 21h8v-6H3v6zM13 9h8V3h-8v6z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  ),
  logout: (c: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M10 17l-5-5 5-5M5 12h12M14 4h5v16h-5" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

/* -------------------- COMPONENTS -------------------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  hint,
  onPress,
  isLast,
  destructive,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  hint?: string;
  onPress: () => void;
  isLast?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surface }}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && { backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, destructive && { color: colors.error }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {IC.chevron(destructive ? colors.error : colors.textMuted)}
    </Pressable>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* -------------------- SCREEN -------------------- */
export default function Profile() {
  return (
    <AuthGate reason="Sign in to view your profile, manage orders, wallet, and saved addresses.">
      <ProfileContent />
    </AuthGate>
  );
}

function ProfileContent() {
  const insets = useSafeAreaInsets();
  const { user, token, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const avatarUri = useMemo(() => {
    if (user?.picture) return user.picture;
    return avatarFor(user?.email || user?.user_id || 'guest');
  }, [user?.picture, user?.email, user?.user_id]);

  useEffect(() => {
    if (!token) return;
    api.get<Order[]>('/orders', token).then(setOrders).catch(() => setOrders([]));
    profileApi
      .walletSummary(token)
      .then((w) => setWalletBalance(w.balance || 0))
      .catch(() => setWalletBalance(0));
  }, [token]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const totalSpent = list
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + (o.total || 0), 0);
    return {
      orders: list.length,
      spent: totalSpent,
    };
  }, [orders]);

  const isAdmin = user?.role === 'admin';

  function notReady(name: string) {
    Alert.alert(name, `${name} is coming soon. Stay tuned!`);
  }

  async function onSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Brand header */}
      <View style={[styles.brandBar, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.brandTitle}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatarRing}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" transition={200} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name ?? 'Guest user'}
              </Text>
              {isAdmin && (
                <View style={styles.adminPill}>
                  <Text style={styles.adminPillText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
            <View style={styles.providerRow}>
              <View style={styles.providerDot} />
              <Text style={styles.providerText}>
                Signed in with {user?.auth_provider === 'google' ? 'Google' : 'Email'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/profile/edit')}
            style={styles.editBtn}
            hitSlop={8}
            accessibilityLabel="Edit profile"
          >
            {IC.pencil(colors.primary)}
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <StatBox label="Orders" value={String(stats.orders)} />
          <View style={styles.statDivider} />
          <StatBox label="Total spent" value={formatINR(stats.spent)} />
          <View style={styles.statDivider} />
          <StatBox label="Wallet" value={formatINR(walletBalance)} />
        </View>

        {/* Your Information */}
        <Section title="YOUR INFORMATION">
          <MenuRow
            icon={IC.bag(colors.primary)}
            iconBg={colors.primarySoft}
            iconColor={colors.primary}
            label="My Orders"
            hint={stats.orders ? `${stats.orders} order${stats.orders === 1 ? '' : 's'}` : 'No orders yet'}
            onPress={() => router.push('/orders')}
          />
          <MenuRow
            icon={IC.pin('#2E7D32')}
            iconBg="#E8F5E9"
            iconColor="#2E7D32"
            label="Saved Addresses"
            hint="Manage delivery locations"
            onPress={() => router.push('/location')}
          />
          <MenuRow
            icon={IC.wallet('#5C6BC0')}
            iconBg="#E8EAF6"
            iconColor="#5C6BC0"
            label="Wallet"
            hint={`${formatINR(walletBalance)} available`}
            onPress={() => router.push('/profile/wallet')}
            isLast
          />
        </Section>

        {/* Admin */}
        {isAdmin && (
          <Section title="ADMIN">
            <MenuRow
              icon={IC.dashboard(colors.primary)}
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="Admin Dashboard"
              hint="KPIs, revenue & top products"
              onPress={() => router.push('/admin/dashboard')}
            />
            <MenuRow
              icon={IC.bag(colors.primary)}
              iconBg={colors.primarySoft}
              iconColor={colors.primary}
              label="Manage Orders"
              hint="Update status & track fulfilment"
              onPress={() => router.push('/admin/orders')}
            />
            <MenuRow
              icon={IC.help('#00838F')}
              iconBg="#E0F7FA"
              iconColor="#00838F"
              label="Support Tickets"
              hint="Respond to customer queries"
              onPress={() => router.push('/admin/tickets')}
            />
            <MenuRow
              icon={IC.shield('#6A1B9A')}
              iconBg="#F3E5F5"
              iconColor="#6A1B9A"
              label="Users"
              hint="View & manage user accounts"
              onPress={() => router.push('/admin/users')}
            />
            <MenuRow
              icon={IC.wallet('#5C6BC0')}
              iconBg="#E8EAF6"
              iconColor="#5C6BC0"
              label="Wallet Adjustments"
              hint="Credit/debit user wallets"
              onPress={() => router.push('/admin/wallet-adjustments')}
              isLast
            />
          </Section>
        )}

        {/* Other Information */}
        <Section title="OTHER INFORMATION">
          <MenuRow
            icon={IC.help('#00838F')}
            iconBg="#E0F7FA"
            iconColor="#00838F"
            label="Help & Support"
            hint="Chat with our AI assistant"
            onPress={() => router.push('/support')}
          />
          <MenuRow
            icon={IC.info('#455A64')}
            iconBg="#ECEFF1"
            iconColor="#455A64"
            label="About Flynkit"
            hint="Privacy, Terms & Contact"
            onPress={() => router.push('/about')}
            isLast
          />
        </Section>

        {/* Sign out */}
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <MenuRow
            icon={IC.logout(colors.error)}
            iconBg="#FFEBEE"
            iconColor={colors.error}
            label="Sign out"
            onPress={onSignOut}
            isLast
            destructive
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Image
            source={{ uri: 'https://static.prod-images.emergentagent.com/jobs/bdde9f90-cad7-4873-bec0-5782f2227a6f/images/1892eaf7d4a9ba405904399fa6c44397c6fce95b70715824f34db564c27d7f72.png' }}
            style={styles.footerLogo}
            contentFit="contain"
          />
          <Text style={styles.footerVersion}>v{APP_VERSION} • Made with care</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  brandTitle: { ...typography.h1, color: colors.textPrimary },

  /* User card */
  userCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.soft,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
  adminPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  adminPillText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  providerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  providerText: { ...typography.tiny, color: colors.textMuted, fontWeight: '600' },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Stats */
  statsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.soft,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border, opacity: 0.6 },

  /* Sections */
  sectionTitle: {
    ...typography.tiny,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadow.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary },
  rowHint: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  /* Footer */
  footer: { alignItems: 'center', marginTop: spacing.xl, gap: 4 },
  footerLogo: { width: 140, height: 70 },
  footerBrand: {
    ...typography.h3,
    color: colors.primary,
    letterSpacing: 1,
    fontWeight: '800',
  },
  footerVersion: { ...typography.tiny, color: colors.textMuted },
});
