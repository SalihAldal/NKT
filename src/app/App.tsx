import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useSettingsStore } from '@/store/settingsStore';
import { adService } from '@/services/ads';
import { notificationService } from '@/services/notifications';
import { validateProductionConfig } from '@config/environment';
import { useAppVersionGate } from '@/hooks/useAppVersionGate';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

function AppProviders({ children }: { children: React.ReactNode }) {
  const { blocked } = useAppVersionGate();
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    const init = async () => {
      try {
        validateProductionConfig();
      } catch (err) {
        console.error('[NKT] Config validation failed:', err);
      }
      await Promise.all([loadSettings(), adService.initialize(), notificationService.initialize()]);
      await SplashScreen.hideAsync();
    };
    init();
  }, [loadSettings]);

  if (blocked) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </QueryClientProvider>
  );
}
