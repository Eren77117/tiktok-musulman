import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance } from 'react-native';
import { AppNavigator } from './navigation';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { ErrorBoundary } from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 2, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

function AppRoot() {
  const { loadMe } = useAuthStore();
  const { loadTheme, syncSystem } = useThemeStore();

  useEffect(() => {
    loadMe();
    loadTheme();
    // Listen for system theme changes
    const sub = Appearance.addChangeListener(() => syncSystem());
    return () => sub.remove();
  }, []);

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
