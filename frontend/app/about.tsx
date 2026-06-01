import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type SectionKey = 'about' | 'privacy' | 'terms' | 'contact';

const SECTIONS: { key: SectionKey; title: string; subtitle: string }[] = [
  { key: 'about', title: 'About Dwaarit', subtitle: 'Groceries in 10 minutes. Always fresh.' },
  { key: 'privacy', title: 'Privacy Policy', subtitle: 'How we collect, use & protect your data' },
  { key: 'terms', title: 'Terms of Service', subtitle: 'The rules that govern your use of Dwaarit' },
  { key: 'contact', title: 'Contact Us', subtitle: 'Reach out — we usually reply within an hour' },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<SectionKey>('about');

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <BackIcon color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>About Dwaarit</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Section selector tabs */}
        <View style={styles.tabsRow}>
          {SECTIONS.map((s) => {
            const isActive = active === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setActive(s.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                  {s.title.replace('About Dwaarit', 'About').replace('Privacy Policy', 'Privacy').replace('Terms of Service', 'Terms').replace('Contact Us', 'Contact')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {active === 'about' && <AboutSection />}
        {active === 'privacy' && <PrivacySection />}
        {active === 'terms' && <TermsSection />}
        {active === 'contact' && <ContactSection />}

        <Text style={styles.footerNote}>© {new Date().getFullYear()} Dwaarit. Made with care in India.</Text>
      </ScrollView>
    </View>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function AboutSection() {
  return (
    <>
      <Card>
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <Text style={styles.brandLogoText}>D</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>Dwaarit</Text>
            <Text style={styles.brandTagline}>Groceries in minutes, every time.</Text>
          </View>
        </View>
        <P>
          Dwaarit is your neighbourhood quick-commerce app for daily essentials. From farm-fresh produce to packaged staples,
          we deliver hand-picked groceries to your doorstep in 10 minutes — at honest prices.
        </P>
      </Card>

      <Card title="Our mission">
        <P>
          To make daily grocery shopping effortless for every Indian household. We obsess over speed, freshness, fair pricing,
          and a delightful in-app experience so you can spend less time on chores and more on what matters.
        </P>
      </Card>

      <Card title="Why people love Dwaarit">
        <Bullet>10-minute delivery from our nearest dark store, 7 days a week.</Bullet>
        <Bullet>Over 5,000 daily essentials — fruits, vegetables, dairy, snacks, household & personal care.</Bullet>
        <Bullet>100% freshness guarantee — if it&apos;s not fresh, we refund instantly.</Bullet>
        <Bullet>Honest, transparent pricing with no hidden charges at checkout.</Bullet>
        <Bullet>Friendly 24×7 in-app AI support that escalates to a human when needed.</Bullet>
      </Card>

      <Card title="App version">
        <Text style={styles.kv}><Text style={styles.kvKey}>Version  </Text>1.0.0</Text>
        <Text style={styles.kv}><Text style={styles.kvKey}>Build    </Text>2025.06.01</Text>
      </Card>
    </>
  );
}

function PrivacySection() {
  return (
    <>
      <Card title="Privacy Policy">
        <Text style={styles.muted}>Last updated: June 2025</Text>
        <P>
          At Dwaarit, we respect your privacy and are committed to protecting your personal information. This policy explains
          what we collect, why we collect it, and the choices you have.
        </P>
      </Card>

      <Card title="Information we collect">
        <Bullet><Text style={styles.bold}>Account details</Text> — name, mobile number, email, and password when you sign up.</Bullet>
        <Bullet><Text style={styles.bold}>Delivery addresses</Text> — addresses you save, and your approximate location to find the nearest dark store.</Bullet>
        <Bullet><Text style={styles.bold}>Order history</Text> — items you've bought, prices, payment method, and delivery status.</Bullet>
        <Bullet><Text style={styles.bold}>Device & usage</Text> — device model, OS, app version, in-app actions and errors to improve the experience.</Bullet>
      </Card>

      <Card title="How we use your data">
        <Bullet>Process orders and deliver them to the right address.</Bullet>
        <Bullet>Personalise recommendations and show what's relevant to you.</Bullet>
        <Bullet>Send you transactional updates about your orders, payments and refunds.</Bullet>
        <Bullet>Detect fraud, abuse, and keep the platform safe.</Bullet>
        <Bullet>Comply with applicable laws and respond to lawful requests.</Bullet>
      </Card>

      <Card title="Sharing & disclosure">
        <P>
          We share data only with the partners required to fulfil your order — delivery partners, payment processors, and
          customer-support tools. We do <Text style={styles.bold}>not</Text> sell your personal information to third parties.
        </P>
      </Card>

      <Card title="Your choices">
        <Bullet>Update your name, email and addresses anytime from Profile.</Bullet>
        <Bullet>Request account deletion by writing to support@dwaarit.com.</Bullet>
        <Bullet>Opt out of promotional notifications from your device settings.</Bullet>
      </Card>

      <Card title="Data security">
        <P>
          We use industry-standard safeguards including encrypted connections (HTTPS/TLS), hashed passwords and least-privilege
          access for our team. No system is perfectly secure, so please use a strong unique password and keep your device safe.
        </P>
      </Card>

      <Card title="Children">
        <P>Dwaarit is intended for users aged 18 and above. We do not knowingly collect personal data from minors.</P>
      </Card>

      <Card title="Contact our DPO">
        <P>For privacy-related questions, write to <Text style={styles.bold}>privacy@dwaarit.com</Text>. We respond within 7 working days.</P>
      </Card>
    </>
  );
}

function TermsSection() {
  return (
    <>
      <Card title="Terms of Service">
        <Text style={styles.muted}>Last updated: June 2025</Text>
        <P>
          By creating an account or placing an order on Dwaarit, you agree to be bound by these Terms of Service. Please read
          them carefully.
        </P>
      </Card>

      <Card title="Your account">
        <Bullet>You must be at least 18 years old to use Dwaarit.</Bullet>
        <Bullet>Provide accurate information when signing up and keep it up to date.</Bullet>
        <Bullet>You are responsible for all activity that happens under your account.</Bullet>
      </Card>

      <Card title="Orders & delivery">
        <Bullet>All orders are subject to product availability at your nearest dark store.</Bullet>
        <Bullet>Delivery time estimates (e.g. “10 minutes”) are indicative and may vary with weather, traffic and demand.</Bullet>
        <Bullet>You must be present at the delivery address or designate someone to receive the order.</Bullet>
        <Bullet>If an item is out of stock, we'll either substitute it (only with your consent) or refund it to your original payment method.</Bullet>
      </Card>

      <Card title="Pricing, payments & refunds">
        <Bullet>All prices are inclusive of applicable taxes unless stated otherwise.</Bullet>
        <Bullet>We support UPI, cards, wallets and cash on delivery (where available).</Bullet>
        <Bullet>Refunds for returned, missing or damaged items are processed within 5–7 working days to your original method or Dwaarit Wallet.</Bullet>
      </Card>

      <Card title="Cancellations & returns">
        <Bullet>You can cancel free of charge before the order is packed.</Bullet>
        <Bullet>For perishables, returns are accepted only if the item is damaged, spoiled or wrong — please raise the request within 24 hours of delivery.</Bullet>
      </Card>

      <Card title="Acceptable use">
        <Bullet>Do not misuse the app, attempt to reverse-engineer it, or interfere with its operation.</Bullet>
        <Bullet>Do not place fraudulent orders or use stolen payment methods.</Bullet>
        <Bullet>Be respectful to our delivery and support partners — abuse may result in account suspension.</Bullet>
      </Card>

      <Card title="Limitation of liability">
        <P>
          To the extent permitted by law, Dwaarit is not liable for indirect, incidental, or consequential damages arising from
          your use of the app. Our total liability for any claim is limited to the value of the order in question.
        </P>
      </Card>

      <Card title="Changes">
        <P>We may update these terms from time to time. We'll notify you in-app for material changes.</P>
      </Card>

      <Card title="Governing law">
        <P>These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Bengaluru, Karnataka.</P>
      </Card>
    </>
  );
}

function ContactSection() {
  return (
    <>
      <Card title="We're here to help">
        <P>Reach out anytime — our in-app AI assistant replies instantly and our human team takes over when needed.</P>
      </Card>
      <Card title="Email">
        <Text style={styles.bold}>support@dwaarit.com</Text>
        <Text style={styles.muted}>For order issues, refunds, and general queries.</Text>
      </Card>
      <Card title="Privacy">
        <Text style={styles.bold}>privacy@dwaarit.com</Text>
        <Text style={styles.muted}>For data, privacy and account deletion requests.</Text>
      </Card>
      <Card title="Registered address">
        <P>Dwaarit Retail Pvt. Ltd.\n4th Floor, Embassy Tech Square,\nBengaluru, Karnataka 560103, India.</P>
      </Card>
    </>
  );
}

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.bodyBold, color: colors.textPrimary },

  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: { ...typography.captionBold, color: colors.textSecondary },
  tabTextActive: { color: colors.white },

  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 8 },
  paragraph: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  muted: { ...typography.tiny, color: colors.textMuted, marginBottom: 8 },
  bold: { fontWeight: '700', color: colors.textPrimary },
  kv: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  kvKey: { color: colors.textPrimary, fontWeight: '600' },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 9 },
  bulletText: { flex: 1, ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  brandLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: { color: colors.white, fontWeight: '800', fontSize: 24 },
  brandName: { ...typography.h3, color: colors.textPrimary },
  brandTagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  footerNote: { ...typography.tiny, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
