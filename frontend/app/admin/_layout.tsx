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

function TicketIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M14 6v12" stroke={color} strokeWidth={2} strokeDasharray="2 2" />
    </Svg>
  );
}

function BikeIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M5.5 18a3 3 0 100-6 3 3 0 000 6zM18.5 18a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth={2} />
      <Path d="M8 15h4l3-6h3M12 9l-2-4h-3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'store_manager') {
    return <Redirect href="/store/dashboard" />;
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
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
        name="products"
        options={{ title: 'Products', tabBarIcon: ({ color }) => <BoxesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="tickets"
        options={{ title: 'Support', tabBarIcon: ({ color }) => <TicketIcon color={color} /> }}
      />
      <Tabs.Screen
        name="drivers"
        options={{ title: 'Drivers', tabBarIcon: ({ color }) => <BikeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
      {/* Hidden screens — reachable only via router.push, not via tab bar */}
      <Tabs.Screen name="add-product" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="coupons" options={{ href: null }} />
      <Tabs.Screen name="banners" options={{ href: null }} />
      <Tabs.Screen name="wallet-adjustments" options={{ href: null }} />
      <Tabs.Screen name="ticket/[id]" options={{ href: null }} />
    </Tabs>
  );
}
