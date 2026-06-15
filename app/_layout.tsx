import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { DataProvider } from '@/providers/DataProvider';
import { PaymentProvider } from '@/providers/PaymentProvider';
import { AlertProvider } from '@/providers/AlertProvider';
import { OfflineSyncProvider } from '@/providers/OfflineSyncProvider';
import { Colors } from '@/constants/colors';
import { View, ActivityIndicator, StyleSheet, LogBox, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { HeaderRight } from '@/components/HeaderRight';
import { registerForNotifications, registerPushToken } from '@/utils/notifications';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';

// Suppress known Expo Router warning — it internally configures linking
// and the duplicate-linking guard fires as a false positive in dev mode.
LogBox.ignoreLogs([
  'Looks like you have configured linking in multiple places',
]);

SplashScreen.preventAutoHideAsync();

import { queryClient } from '@/lib/queryClient';

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

  // On mobile, detectSessionInUrl is false so the Supabase SDK never sees the
  // recovery token that arrives in the deep-link hash fragment. We must parse
  // it ourselves and call setSession(), which then fires PASSWORD_RECOVERY.
  useEffect(() => {
    const processRecoveryUrl = async (url: string | null) => {
      if (!url) return;
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;
      const params = new URLSearchParams(url.slice(hashIndex + 1));
      const type = params.get('type');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (type === 'recovery' && accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };

    // Cold start: app was launched by tapping the email link
    Linking.getInitialURL().then(processRecoveryUrl);

    // Warm start: app was already open when the link was tapped
    const linkSub = Linking.addEventListener('url', (e) => processRecoveryUrl(e.url));

    // Navigate to reset screen when Supabase fires the PASSWORD_RECOVERY event
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    return () => {
      linkSub.remove();
      authSub.unsubscribe();
    };
  }, [router]);

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

  // Track whether a navigation is already in-flight to avoid
  // double-firing during the same auth transition.
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (!isInitialized || !fontsLoaded) return;

    const inTabsGroup = segmentKey.startsWith('(tabs)');
    const inAdminGroup = segmentKey.startsWith('admin');
    const onLoginPage = segmentKey.startsWith('login');

    // Admin group handles its own auth via WebGuard
    if (inAdminGroup) {
      navigatingRef.current = false;
      return;
    }

    // On web, always route into the admin group
    if (Platform.OS === 'web') {
      const needsRedirect = !inAdminGroup;
      if (needsRedirect && !navigatingRef.current) {
        navigatingRef.current = true;
        const target = isAuthenticated ? '/admin/dashboard' : '/admin/login';
        setTimeout(() => {
          router.replace(target as any);
          navigatingRef.current = false;
        }, 100);
      }
      return;
    }

    const shouldGoToTabs = isAuthenticated && !inTabsGroup;
    const shouldGoToLogin = !isAuthenticated && !onLoginPage;

    if (!shouldGoToTabs && !shouldGoToLogin) {
      navigatingRef.current = false;
      return;
    }
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    // Delay navigation so Fabric finishes the current mount batch.
    const timer = setTimeout(() => {
      if (shouldGoToTabs) {
        router.replace('/(tabs)/');
      } else if (shouldGoToLogin) {
        router.replace('/login');
      }
      navigatingRef.current = false;
    }, 100);
    return () => { clearTimeout(timer); navigatingRef.current = false; };
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
        },
        headerRight: renderHeaderRight,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
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
