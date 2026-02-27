import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { DataProvider } from '@/providers/DataProvider';
import { PaymentProvider } from '@/providers/PaymentProvider';
import { AlertProvider } from '@/providers/AlertProvider';
import { OfflineSyncProvider } from '@/providers/OfflineSyncProvider';
import { Colors } from '@/constants/colors';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { HeaderRight } from '@/components/HeaderRight';
import OfflineBanner from '@/components/OfflineBanner';
import { registerForNotifications, registerPushToken } from '@/utils/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,        // 10 min — realtime sync keeps data fresh
      gcTime: 30 * 60 * 1000,           // 30 min — keep cache longer for offline
      retry: 2,                          // retry failed fetches twice
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,       // realtime sync handles updates
      refetchOnReconnect: true,          // refetch when network comes back
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading, isInitialized, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const segmentKey = segments.join('/');
  const [fontsLoaded] = useFonts({
    'Billabong': require('../assets/fonts/Billabong.ttf'),
  });

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      registerForNotifications().then((granted) => {
        if (granted) registerPushToken(user.id);
      });
    }
  }, [isAuthenticated, user?.id]);

  // Hide splash when ready, OR after 6s safety timeout so the app never
  // gets stuck on the splash screen even if init hangs.
  useEffect(() => {
    if (isInitialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized, fontsLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInitialized || !fontsLoaded) return;

    const inTabsGroup = segmentKey.startsWith('(tabs)');
    const onLoginPage = segmentKey.startsWith('login');

    if (isAuthenticated && !inTabsGroup) {
      router.replace('/(tabs)/');
    } else if (!isAuthenticated && !onLoginPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, segmentKey, fontsLoaded]);

  const renderHeaderRight = useCallback(() => <HeaderRight />, []);

  if (isLoading || !isInitialized || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
    <OfflineBanner />
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.headerText,
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: 0.3,
        },
        headerRight: renderHeaderRight,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <OfflineSyncProvider>
            <PaymentProvider>
              <AlertProvider>
                <SafeAreaProvider>
                  <GestureHandlerRootView style={styles.flex}>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </SafeAreaProvider>
              </AlertProvider>
            </PaymentProvider>
          </OfflineSyncProvider>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
