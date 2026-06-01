import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/src/theme';

export type Status = 'pending' | 'accepted' | 'out_for_delivery' | 'delivered' | 'cancelled';

const LABEL: Record<Status, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PALETTE: Record<Status, { bg: string; fg: string }> = {
  pending: { bg: '#FFF1E6', fg: '#E04F00' },
  accepted: { bg: '#E6F1FF', fg: '#1769E0' },
  out_for_delivery: { bg: '#FFF8DB', fg: '#9A6B00' },
  delivered: { bg: '#E7F8EC', fg: '#1E8E3E' },
  cancelled: { bg: '#FCE8E6', fg: '#C5221F' },
};

export function StatusBadge({ status }: { status: Status }) {
  const p = PALETTE[status];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.text, { color: p.fg }]}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: { ...typography.tiny, fontWeight: '700' },
});
