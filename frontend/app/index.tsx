import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

export default function Gate() {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Unauthenticated → Welcome / Landing screen
      router.replace('/welcome');
    } else if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'store_manager') {
      router.replace('/admin/orders');
    } else if (user.role === 'rider') {
      router.replace('/rider/dashboard');
    } else {
      router.replace('/(tabs)/home');
    }
  }, [loading, user]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF5500', alignItems: 'center', justifyContent: 'center' },
});
