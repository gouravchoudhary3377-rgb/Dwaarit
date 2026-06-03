// Flynkit design tokens — keep in sync with /app/design_guidelines.json
import { Platform } from 'react-native';

export const colors = {
  primary: '#FF5A00',
  primaryDark: '#E04F00',
  primarySoft: '#FFF1E6',
  background: '#FFFFFF',
  surface: '#F7F7F7',
  surfaceAlt: '#FAFAFA',
  textPrimary: '#1A1512',
  textSecondary: '#736F6D',
  textMuted: '#A6A19E',
  border: '#EAEAEA',
  borderStrong: '#D8D5D2',
  error: '#FF3B30',
  success: '#34C759',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const shadow = {
  card: Platform.select({
    web: { boxShadow: '0 8px 16px rgba(0,0,0,0.06)' } as any,
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  }) as any,
  soft: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } as any,
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  }) as any,
  strong: Platform.select({
    web: { boxShadow: '0 8px 16px rgba(255,90,0,0.18)' } as any,
    default: {
      shadowColor: '#FF5A00',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }) as any,
} as const;

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
  bodyLg: { fontSize: 18, fontWeight: '500' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  captionBold: { fontSize: 14, fontWeight: '600' as const },
  tiny: { fontSize: 12, fontWeight: '500' as const },
} as const;
