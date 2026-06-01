import React from 'react';
import { Platform } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { colors, typography } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';

function DashIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM3 21h8v-6H3v6zM13 9h8V3h-8v6z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OrdersIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M14 2v6h6M8 13h8M8 17h5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function RidersIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Circle cx={5.5} cy={15} r={3} stroke={color} strokeWidth={2} />
      <Circle cx={18.5} cy={15} r={3} stroke={color} strokeWidth={2} />
      <Path
        d="M8 15h4l3-6h3M12 9l-2-4h-3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BoxesIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 32 32" fill="none">
      <Rect x={4} y={6} width={11} height={9} rx={2} stroke={color} strokeWidth={2.4} />
      <Rect x={17} y={6} width={11} height={9} rx={2} stroke={color} strokeWidth={2.4} />
      <Rect x={10} y={17} width={12} height={9} rx={2} stroke={color} strokeWidth={2.4} />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 21a8 8 0 0116 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function StoreLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'store_manager' && user.role !== 'super_admin' && user.role !== 'admin') {
    if (user.role === 'rider') return <Redirect href="/rider/dashboard" />;
    return <Redirect href="/(tabs)/home" />;
  }
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
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <DashIcon color={color} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ color }) => <OrdersIcon color={color} /> }}
      />
      <Tabs.Screen
        name="drivers"
        options={{ title: 'Riders', tabBarIcon: ({ color }) => <RidersIcon color={color} /> }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Inventory', tabBarIcon: ({ color }) => <BoxesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
      {/* Detail screens (not in tab bar) */}
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
    </Tabs>
  );
}
