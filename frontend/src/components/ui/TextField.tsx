import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radii, typography } from '@/src/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  testID?: string;
};

export function TextField({ label, error, style, testID, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        testID={testID}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          !!error && styles.errored,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...typography.captionBold, color: colors.textSecondary },
  input: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: { borderColor: colors.primary, backgroundColor: '#fff' },
  errored: { borderColor: colors.error },
  error: { color: colors.error, ...typography.caption },
});
