import { useMemo } from 'react';
import { useThemeStore } from '../stores/themeStore';

// ── LIGHT — clean & premium (cream + Islamic green) ───────────────────────────
const LIGHT = {
  bg:              '#F7F7F8',
  surface:         '#FFFFFF',
  card:            '#FFFFFF',
  inputBg:         '#F0F0F2',
  text:            '#0A0A0B',
  textMuted:       '#60646C',
  textSubtle:      '#9EA3AB',
  textPlaceholder: '#B8BCC4',
  border:          '#E8E8EC',
  borderLight:     '#F0F0F4',
  tabBg:           '#FFFFFF',
  tabActive:       '#2D7A4F',
  tabInactive:     '#9EA3AB',
  navBorder:       '#EBEBEF',
  primary:         '#2D7A4F',
  primaryLight:    '#4CAF7A',
  primaryBg:       '#EBF5EE',
};

// ── DARK — true black + green accent (TikTok-style) ───────────────────────────
const DARK = {
  bg:              '#0A0A0A',
  surface:         '#111111',
  card:            '#161616',
  inputBg:         '#1C1C1C',
  text:            '#F5F5F5',
  textMuted:       '#A0A0A8',
  textSubtle:      '#606068',
  textPlaceholder: '#484850',
  border:          '#222222',
  borderLight:     '#1A1A1A',
  tabBg:           '#0A0A0A',
  tabActive:       '#4CAF7A',
  tabInactive:     '#484850',
  navBorder:       '#1A1A1A',
  primary:         '#2D7A4F',
  primaryLight:    '#4CAF7A',
  primaryBg:       '#0F2018',
};

// Shared static colors
const STATIC = {
  white:   '#FFFFFF',
  black:   '#000000',
  error:   '#EF4444',
  like:    '#FF3B5C',
  gold:    '#C9A84C',
  success: '#2D7A4F',
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
