import { Dimensions, Platform } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── BRAND COLORS ─────────────────────────────────────────────────────────────
export const COLORS = {
  // Primary — deep Islamic green
  primary: '#2D7A4F',
  primaryLight: '#4CAF7A',
  primaryDark: '#1E5235',
  primaryBg: '#EBF5EE',
  primaryBgDark: '#1A3025',

  // Accent — warm gold / sand
  gold: '#C9A84C',
  goldLight: '#E8D5A3',
  goldBg: '#FDF8EC',

  // Backgrounds (light mode)
  bg: '#FAF8F3',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  inputBg: '#F4F1EB',

  // Backgrounds (dark mode)
  bgDark: '#0F1A13',
  surfaceDark: '#18291E',
  cardDark: '#1E3326',
  inputBgDark: '#243B2A',

  // Text (light mode)
  text: '#1C1C1E',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  textPlaceholder: '#B0A99A',

  // Text (dark mode)
  textDark: '#F5F3EE',
  textMutedDark: '#9BA8A0',

  // Borders
  border: '#EAE7DE',
  borderDark: '#2A4035',
  borderLight: '#F0EDE5',

  // Semantic
  like: '#E05252',
  likeBg: '#FEF2F2',
  success: '#2D7A4F',
  warning: '#F59E0B',
  error: '#EF4444',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  overlayLight: 'rgba(0,0,0,0.15)',
  transparent: 'transparent',

  // Tab bar
  tabActive: '#2D7A4F',
  tabInactive: '#9CA3AF',
};

// ─── SPACING ──────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
export const FONT = {
  family: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    display: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

// ─── SHADOWS ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  green: {
    shadowColor: '#2D7A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://tiktok-backend-production-2cd7.up.railway.app/api';
export const WS_URL = 'https://tiktok-backend-production-2cd7.up.railway.app';
