import { Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const API_BASE_URL = 'https://tiktok-backend-production-2cd7.up.railway.app/api';
export const WS_URL = 'https://tiktok-backend-production-2cd7.up.railway.app';

export const COLORS = {
  bg: '#000000',
  bgCard: '#111111',
  bgInput: '#1a1a1a',
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  text: '#ffffff',
  textMuted: '#9ca3af',
  textSubtle: '#4b5563',
  border: '#1f2937',
  red: '#ef4444',
  green: '#22c55e',
  overlay: 'rgba(0,0,0,0.6)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};
