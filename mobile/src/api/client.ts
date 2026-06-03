import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../constants';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,   // 30s — Railway cold starts can be slow
  headers: { 'Content-Type': 'application/json' },
});

const KEYCHAIN_SERVICE = 'tiktok_musulman_auth';

export async function saveTokens(access: string, refresh: string) {
  await Keychain.setGenericPassword('tokens', JSON.stringify({ access, refresh }), {
    service: KEYCHAIN_SERVICE,
  });
}

export async function getTokens(): Promise<{ access: string; refresh: string } | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!creds) return null;
    return JSON.parse(creds.password);
  } catch {
    return null;
  }
}

export async function clearTokens() {
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {}
}

api.interceptors.request.use(async (config) => {
  const tokens = await getTokens();
  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
      error.message = 'Délai dépassé. Vérifie ta connexion internet.';
      return Promise.reject(error);
    }
    if (!error.response) {
      error.message = 'Erreur réseau. Vérifie ta connexion internet.';
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      const tokens = await getTokens();
      if (tokens?.refresh && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: tokens.refresh,
          }, { timeout: 10000 });
          await saveTokens(data.access_token, data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api.request(error.config);
        } catch {
          await clearTokens();
        }
      }
    }
    return Promise.reject(error);
  },
);
