import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  isDark: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  loadTheme: () => Promise<void>;
}

const THEME_KEY = 'nour_theme';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  isDark: false,

  setTheme: async (t: Theme) => {
    set({ theme: t, isDark: t === 'dark' });
    await AsyncStorage.setItem(THEME_KEY, t);
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY) as Theme | null;
      if (saved) set({ theme: saved, isDark: saved === 'dark' });
    } catch {}
  },
}));
