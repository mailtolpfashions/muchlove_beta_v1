import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
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
import { registerForNotifications } from '@/utils/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isAuthenticated, isLoading, isInitialized, isAdmin } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({
    'Billabong': require('../assets/fonts/Billabong.ttf'),
  });

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      registerForNotifications();
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isInitialized && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized, fontsLoaded]);

  useEffect(() => {
    if (!isInitialized || !fontsLoaded) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onLoginPage = segments[0] === 'login';

    if (isAuthenticated && !inTabsGroup) {
      router.replace('/(tabs)/');
    } else if (!isAuthenticated && !onLoginPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitialized, segments, fontsLoaded]);

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
        headerRight: () => <HeaderRight />,
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
                  <GestureHandlerRootView style={{ flex: 1 }}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
