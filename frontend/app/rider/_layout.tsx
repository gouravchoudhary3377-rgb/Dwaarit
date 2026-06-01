import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

export default function RiderLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'rider') {
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'store_manager') {
      return <Redirect href="/admin/orders" />;
    }
    return <Redirect href="/(tabs)/home" />;
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
