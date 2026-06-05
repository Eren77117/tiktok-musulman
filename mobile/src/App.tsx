import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNavigator } from './navigation';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/ui/SplashScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/onboarding/OnboardingScreen';
import { api } from './api/client';

// ── QueryClient global — stale 30s, retry 2× ────────────────────────────────
// Exported so cache can be cleared on logout from anywhere
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

// ── Boot prefetch — charge tout en parallèle au lancement ───────────────────
// Met les résultats dans React Query cache → écrans s'ouvrent instantanément
async function bootPrefetch() {
  try {
    const [feed, threads, conversations, unread, me] = await Promise.allSettled([
      // 3 premières vidéos (Pour toi)
      api.get('/posts/feed', { params: { limit: 5 } }),
      // 10 premiers fils
      api.get('/threads', { params: { limit: 10 } }),
      // liste conversations
      api.get('/messages/conversations'),
      // badge notifications
      api.get('/notifications/unread-count'),
      // profil
      api.get('/auth/me'),
    ]);

    // Injecte dans le cache React Query — zéro appel réseau au premier rendu
    if (feed.status === 'fulfilled') {
      queryClient.setQueryData(['feed'], {
        pages: [feed.value.data],
        pageParams: [null],
      });
    }
    if (threads.status === 'fulfilled') {
      queryClient.setQueryData(['threads'], {
        pages: [threads.value.data],
        pageParams: [null],
      });
    }
    if (conversations.status === 'fulfilled') {
      queryClient.setQueryData(['conversations'], conversations.value.data);
    }
    if (unread.status === 'fulfilled') {
      queryClient.setQueryData(['notif-unread'], unread.value.data);
    }
    if (me.status === 'fulfilled') {
      queryClient.setQueryData(['me'], me.value.data);
    }
  } catch {
    // Silencieux — l'app fonctionne normalement si prefetch échoue
  }
}

function AppRoot() {
  const { loadMe, user } = useAuthStore();
  const { loadTheme, syncSystem } = useThemeStore();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [booted, setBooted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      await loadMe();
      await loadTheme();
      const v = await AsyncStorage.getItem(ONBOARDING_KEY);
      setOnboarded(!!v);
    })();

    const sub = Appearance.addChangeListener(() => syncSystem());
    return () => sub.remove();
  }, []);

  // Isolation cache par compte — vide tout au changement d'utilisateur
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (currentId === prevUserIdRef.current) return;
    // L'utilisateur a changé (login, logout, switch de compte)
    queryClient.clear();
    prevUserIdRef.current = currentId;
    if (currentId !== null) {
      // Nouveau compte — relancer le prefetch
      setBooted(false);
    }
  }, [user?.id]);

  // Lance le prefetch dès que l'user est connu (authentifié)
  useEffect(() => {
    if (user && !booted) {
      setBooted(true);
      bootPrefetch();
    }
  }, [user, booted]);

  return (
    <>
      {onboarded === null ? null : !onboarded
        ? <OnboardingScreen onDone={() => setOnboarded(true)} />
        : <AppNavigator />
      }
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AppRoot />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
