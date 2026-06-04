import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNavigator } from './navigation';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/onboarding/OnboardingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 2, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

function AppRoot() {
  const { loadMe } = useAuthStore();
  const { loadTheme, syncSystem } = useThemeStore();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    loadMe();
    loadTheme();
    AsyncStorage.getItem(ONBOARDING_KEY).then(v => setOnboarded(!!v));
    const sub = Appearance.addChangeListener(() => syncSystem());
    return () => sub.remove();
  }, []);

  if (onboarded === null) return null; // Loading
  if (!onboarded) return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  return <AppNavigator />;
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
