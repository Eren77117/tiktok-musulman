import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'nour_user_settings';

interface AppSettings {
  autoplay: boolean;
  muteByDefault: boolean;
}

interface SettingsStore extends AppSettings {
  setSetting: <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => void;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  autoplay: true,
  muteByDefault: false,

  setSetting: async (key, val) => {
    set({ [key]: val } as any);
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const current = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, [key]: val }));
    } catch {}
  },

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          autoplay: saved.autoplay ?? true,
          muteByDefault: saved.muteByDefault ?? false,
        });
      }
    } catch {}
  },
}));
