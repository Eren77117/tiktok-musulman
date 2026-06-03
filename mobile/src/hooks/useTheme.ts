import { useMemo } from 'react';
import { useThemeStore } from '../stores/themeStore';

// Full color palette for light & dark
const LIGHT = {
  bg:           '#FAF8F3',
  surface:      '#FFFFFF',
  card:         '#FFFFFF',
  inputBg:      '#F4F1EB',
  text:         '#1C1C1E',
  textMuted:    '#6B7280',
  textSubtle:   '#9CA3AF',
  textPlaceholder: '#B0A99A',
  border:       '#EAE7DE',
  borderLight:  '#F0EDE5',
  tabBg:        '#FFFFFF',
  tabActive:    '#2D7A4F',
  tabInactive:  '#9CA3AF',
  navBorder:    '#F0EDE5',
  primary:      '#2D7A4F',
  primaryLight: '#4CAF7A',
  primaryBg:    '#EBF5EE',
};

const DARK = {
  bg:           '#0F1A13',
  surface:      '#18291E',
  card:         '#1E3326',
  inputBg:      '#243B2A',
  text:         '#F0EDE5',
  textMuted:    '#9BA8A0',
  textSubtle:   '#6B7A72',
  textPlaceholder: '#5A6B60',
  border:       '#2A4035',
  borderLight:  '#243B2A',
  tabBg:        '#18291E',
  tabActive:    '#4CAF7A',
  tabInactive:  '#5A6B60',
  navBorder:    '#2A4035',
  primary:      '#2D7A4F',
  primaryLight: '#4CAF7A',
  primaryBg:    '#1A3025',
};

// Shared static colors
const STATIC = {
  white:    '#FFFFFF',
  black:    '#000000',
  error:    '#EF4444',
  like:     '#FF3B5C',
  gold:     '#C9A84C',
  success:  '#2D7A4F',
};

export type AppTheme = typeof LIGHT & typeof STATIC & { isDark: boolean };

export function useTheme(): AppTheme {
  const { isDark } = useThemeStore();
  return useMemo(() => ({
    isDark,
    ...(isDark ? DARK : LIGHT),
    ...STATIC,
  }), [isDark]);
}

// For screens that need to react to theme changes
export function useIsDark(): boolean {
  return useThemeStore(s => s.isDark);
}
