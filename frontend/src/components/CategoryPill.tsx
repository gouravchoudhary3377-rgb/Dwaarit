import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/theme';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function CategoryPill({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.active, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { ...typography.captionBold, color: colors.textSecondary },
  labelActive: { color: colors.white },
});
