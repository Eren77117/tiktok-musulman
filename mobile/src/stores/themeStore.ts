import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggleTheme: () => void;
  syncSystem: () => void;
  loadTheme: () => Promise<void>;
}

const THEME_KEY = 'nour_theme_mode';

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return Appearance.getColorScheme() === 'dark';
  return mode === 'dark';
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'system',
  isDark: Appearance.getColorScheme() === 'dark',

  setMode: async (m: ThemeMode) => {
    set({ mode: m, isDark: resolveIsDark(m) });
    await AsyncStorage.setItem(THEME_KEY, m);
  },

  toggleTheme: () => {
    const { mode } = get();
    get().setMode(mode === 'dark' ? 'light' : 'dark');
  },

  syncSystem: () => {
    if (get().mode === 'system') {
      set({ isDark: Appearance.getColorScheme() === 'dark' });
    }
  },

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY) as ThemeMode | null;
      const m: ThemeMode = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
      set({ mode: m, isDark: resolveIsDark(m) });
    } catch {}
  },
}));
