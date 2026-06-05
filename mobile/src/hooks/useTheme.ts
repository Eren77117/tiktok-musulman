import { useMemo } from 'react';
import { useThemeStore } from '../stores/themeStore';

// ── LIGHT — white, clean, premium ─────────────────────────────────────────────
const LIGHT = {
  bg:              '#FFFFFF',
  surface:         '#FFFFFF',
  card:            '#F7F7F8',
  inputBg:         '#F2F2F4',
  text:            '#0A0A0B',
  textMuted:       '#6B7280',
  textSubtle:      '#9CA3AF',
  textPlaceholder: '#C0C4CC',
  border:          '#EBEBED',
  borderLight:     '#F4F4F6',
  tabBg:           '#FFFFFF',
  tabActive:       '#00C26E',
  tabInactive:     '#9CA3AF',
  navBorder:       '#F0F0F2',
  primary:         '#00C26E',
  primaryLight:    '#1EE085',
  primaryBg:       '#E6FFF4',
};

// ── DARK — deep black + neon green (premium, futuristic) ──────────────────────
const DARK = {
  bg:              '#0B0B0B',
  surface:         '#111111',
  card:            '#121212',
  inputBg:         '#1A1A1A',
  text:            '#F5F5F5',
  textMuted:       '#8A8A95',
  textSubtle:      '#555560',
  textPlaceholder: '#3A3A45',
  border:          '#1E1E1E',
  borderLight:     '#181818',
  tabBg:           '#0B0B0B',
  tabActive:       '#00C26E',
  tabInactive:     '#555560',
  navBorder:       '#181818',
  primary:         '#00C26E',
  primaryLight:    '#1EE085',
  primaryBg:       '#001F12',
};

// Shared static colors (never change between themes)
const STATIC = {
  white:   '#FFFFFF',
  black:   '#000000',
  error:   '#EF4444',
  like:    '#FF3B5C',
  gold:    '#F5C542',
  success: '#00C26E',
  neon:    '#00C26E',
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

export function useIsDark(): boolean {
  return useThemeStore(s => s.isDark);
}
