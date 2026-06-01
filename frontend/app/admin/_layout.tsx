import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';

import { OrdersIcon, ProfileIcon } from '@/src/components/icons/TabIcons';
import { colors, typography } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';

function BoxesIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 32 32" fill="none">
      <Rect x={4} y={6} width={11} height={9} rx={2} stroke={color} strokeWidth={2.4} />
      <Rect x={17} y={6} width={11} height={9} rx={2} stroke={color} strokeWidth={2.4} />
      <Rect x={10} y={17} width={12} height={9} rx={2} stroke={color} strokeWidth={2.4} />
      <Path d="M9.5 10.5h1M22.5 10.5h1M15.5 21.5h1" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'admin') return <Redirect href="/(tabs)/home" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { ...typography.tiny, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ color }) => <OrdersIcon color={color} /> }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: 'Products', tabBarIcon: ({ color }) => <BoxesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
