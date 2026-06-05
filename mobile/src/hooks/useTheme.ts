import { useMemo } from 'react';
import { useThemeStore } from '../stores/themeStore';

// ── LIGHT — fond blanc, icônes sombres, accents verts ─────────────────────────
const LIGHT = {
  bg:              '#FFFFFF',
  surface:         '#FFFFFF',
  card:            '#F7F7F8',
  inputBg:         '#F2F2F4',

  text:            '#0A0A0B',
  textMuted:       '#4B5563',
  textSubtle:      '#6B7280',
  textPlaceholder: '#9CA3AF',

  border:          'rgba(0,0,0,0.15)',
  borderLight:     'rgba(0,0,0,0.08)',
  navBorder:       'rgba(0,0,0,0.12)',

  tabBg:           '#FFFFFF',
  tabActive:       '#00C26E',
  tabInactive:     '#3D3D4A',   // sombre sur blanc — contraste élevé

  primary:         '#00C26E',
  primaryLight:    '#1EE085',
  primaryBg:       '#E6FFF4',

  iconColor:       '#0A0A0B',   // icônes générales en mode clair
};

// ── DARK — fond noir, icônes blanches, accents verts ──────────────────────────
const DARK = {
  bg:              '#0B0B0B',
  surface:         '#111111',
  card:            '#161616',
  inputBg:         '#1C1C1C',

  text:            '#F5F5F5',
  textMuted:       '#A0A0AD',
  textSubtle:      '#6E6E7A',
  textPlaceholder: '#3A3A45',

  border:          'rgba(255,255,255,0.18)',
  borderLight:     'rgba(255,255,255,0.09)',
  navBorder:       'rgba(255,255,255,0.35)',

  tabBg:           '#0B0B0B',
  tabActive:       '#00C26E',
  tabInactive:     'rgba(255,255,255,0.65)',  // blanc visible sur fond noir

  primary:         '#00C26E',
  primaryLight:    '#1EE085',
  primaryBg:       '#001F12',

  iconColor:       '#F5F5F5',   // icônes générales en mode sombre
};

// Couleurs statiques (jamais altérées par le thème)
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
