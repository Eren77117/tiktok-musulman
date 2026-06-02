import { create } from 'zustand';
import { api } from '../api/client';

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!['ADMIN', 'MODERATOR'].includes(data.user.role)) {
      throw new Error('Access denied. Admin or moderator account required.');
    }
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ user: data.user });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null });
  },

  loadMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (['ADMIN', 'MODERATOR'].includes(data.role)) {
        set({ user: data, loading: false });
      } else {
        localStorage.clear();
        set({ user: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
