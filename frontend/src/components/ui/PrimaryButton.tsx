import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle, View } from 'react-native';
import { colors, radii, typography } from '@/src/theme';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  testID?: string;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
};

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  testID,
  style,
  leftIcon,
}: Props) {
  const isDisabled = disabled || loading;
  const stylesArr = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'ghost' && styles.ghost,
    isDisabled && styles.disabled,
    style,
  ];
  const labelStyle = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'secondary' && styles.labelSecondary,
    variant === 'ghost' && styles.labelGhost,
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [...stylesArr, pressed && !isDisabled && styles.pressed]}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <View style={styles.row}>
          {leftIcon}
          <Text style={labelStyle}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label: { ...typography.bodyBold },
  labelPrimary: { color: colors.white },
  labelSecondary: { color: colors.primary },
  labelGhost: { color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
