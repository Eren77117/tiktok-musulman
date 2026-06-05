import { Dimensions, Platform } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── BRAND COLORS ─────────────────────────────────────────────────────────────
export const COLORS = {
  // Primary — neon green (modern, premium)
  primary:      '#00C26E',
  primaryLight: '#1EE085',
  primaryDark:  '#009954',
  primaryBg:    '#E6FFF4',
  primaryBgDark:'#001F12',

  // Accent
  gold:    '#F5C542',
  goldBg:  '#FFFBEA',

  // Backgrounds (light mode)
  bg:      '#FFFFFF',
  surface: '#FFFFFF',
  card:    '#F7F7F8',
  inputBg: '#F2F2F4',

  // Backgrounds (dark mode)
  bgDark:      '#0B0B0B',
  surfaceDark: '#111111',
  cardDark:    '#121212',
  inputBgDark: '#1A1A1A',

  // Text
  text:            '#0A0A0B',
  textMuted:       '#6B7280',
  textSubtle:      '#9CA3AF',
  textPlaceholder: '#C0C4CC',

  // Text dark
  textDark:       '#F5F5F5',
  textMutedDark:  '#8A8A95',

  // Borders
  border:      '#EBEBED',
  borderDark:  '#1E1E1E',
  borderLight: '#F4F4F6',

  // Semantic
  like:    '#FF3B5C',
  likeBg:  '#FFF0F3',
  success: '#00C26E',
  warning: '#F59E0B',
  error:   '#EF4444',

  // Misc
  white:       '#FFFFFF',
  black:       '#000000',
  overlay:     'rgba(0,0,0,0.5)',
  overlayLight:'rgba(0,0,0,0.15)',
  transparent: 'transparent',

  // Tab bar
  tabActive:   '#00C26E',
  tabInactive: '#9CA3AF',
};

// ─── SPACING ──────────────────────────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 999,
};

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
export const FONT = {
  family: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
  size: {
    xs:      11,
    sm:      13,
    base:    15,
    md:      16,
    lg:      18,
    xl:      20,
    xxl:     24,
    xxxl:    28,
    display: 34,
  },
  weight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    heavy:    '800' as const,
  },
};

// ─── SHADOWS ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  green: {
    shadowColor: '#00C26E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  greenSm: {
    shadowColor: '#00C26E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://tiktok-backend-production-2cd7.up.railway.app/api';
export const WS_URL = 'https://tiktok-backend-production-2cd7.up.railway.app';
