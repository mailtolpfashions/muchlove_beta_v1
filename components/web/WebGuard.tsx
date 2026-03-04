/**
 * Auth + admin route guard for the web admin panel.
 * Wraps all admin routes — single point of enforcement.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/colors';
import { WebTypo } from '@/constants/web';

interface Props {
  children: React.ReactNode;
}

export function WebGuard({ children }: Props) {
  const { isAuthenticated, isAdmin, isInitialized, isLoading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to admin login (hook is always called — Rules of Hooks)
  React.useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      router.replace('/admin/login' as any);
    }
  }, [isInitialized, isLoading, isAuthenticated]);

  if (!isInitialized || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.subtitle}>
          This panel is restricted to admin accounts only.
        </Text>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/login' as any)}
        >
          <Text style={styles.backButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: WebTypo.body,
    color: Colors.textSecondary,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: WebTypo.h2,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: WebTypo.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: WebTypo.button,
    fontWeight: '600',
  },
});
