import React, { useState, useEffect, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { initializeDatabase, withTimeout } from '@/utils/database';
import { unregisterPushToken } from '@/utils/notifications';
import type { Session } from '@supabase/supabase-js';

const CACHED_PROFILE_KEY = '@cached_profile';
const PROFILE_RECHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const recheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Save profile to AsyncStorage for instant restore on next launch */
  const cacheProfile = useCallback(async (profile: User) => {
    try {
      await AsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
    } catch { /* best effort */ }
  }, []);

  /** Clear cached profile (on logout) */
  const clearCachedProfile = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CACHED_PROFILE_KEY);
    } catch { /* best effort */ }
  }, []);

  /** Load cached profile for instant app launch */
  const loadCachedProfile = useCallback(async (): Promise<User | null> => {
    try {
      const json = await AsyncStorage.getItem(CACHED_PROFILE_KEY);
      if (json) return JSON.parse(json) as User;
    } catch { /* best effort */ }
    return null;
  }, []);

  /** Fetch the profile row for a given auth user ID */
  const fetchProfile = useCallback(async (authUserId: string, email: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email ?? email,
      name: data.name,
      role: data.role,
      approved: data.approved ?? false,
      createdAt: data.created_at,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Handle invalid refresh token during token refresh
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.log('Token refresh failed, signing out');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          return;
        }

        // Skip profile fetch for SIGNED_IN — login() already handles it.
        // This avoids a double-fetch that blocks signInWithPassword return.
        if (event === 'SIGNED_IN') {
          return;
        }

        if (newSession?.user) {
          const profile = await fetchProfile(newSession.user.id, newSession.user.email ?? '');
          if (profile && profile.approved) {
            setSession(newSession);
            setUser(profile);
          } else {
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      }
    );

    const init = async () => {
      try {
        // Run seeding in background — don't block auth init
        initializeDatabase().catch(() => {});

        // ── 1. Instant restore: load cached profile for zero-delay launch ──
        const cached = await loadCachedProfile();
        if (!cancelled && cached) {
          setUser(cached);
          // Don't set isInitialized yet — we'll verify in background
        }

        // ── 2. Get the real session from Supabase Auth ──
        let existingSession: Session | null = null;
        let sessionError: any = null;

        try {
          const result = await withTimeout(
            supabase.auth.getSession(),
            15000,
            'Session retrieval',
          );
          existingSession = result.data?.session ?? null;
          sessionError = result.error;
        } catch (timeoutErr: any) {
          // Timeout: if we have a cached profile, let user continue.
          // Otherwise they'll see the login screen.
          console.log('Session retrieval slow, proceeding with cached profile:', timeoutErr?.message);
          if (cached) {
            // Keep using cached profile
          }
          return;
        }

        if (cancelled) return;

        // If the stored refresh token is invalid/expired, sign out and clear stale session
        if (sessionError) {
          console.log('Session retrieval error (clearing stale session):', sessionError.message);
          try { await supabase.auth.signOut(); } catch (_) {}
          setUser(null);
          await clearCachedProfile();
          return;
        }

        if (existingSession?.user) {
          setSession(existingSession);

          // ── 3. Background profile refresh ──
          let profile: User | null = null;
          try {
            profile = await withTimeout(
              fetchProfile(existingSession.user.id, existingSession.user.email ?? ''),
              8000,
              'Profile fetch',
            );
          } catch (profileErr: any) {
            // Profile fetch failed/timed out — keep cached profile so user isn't locked out.
            console.log('Profile fetch slow, keeping cached profile:', profileErr?.message);
            return;
          }
          if (cancelled) return;

          if (profile && profile.approved) {
            setUser(profile);
            await cacheProfile(profile);
          } else {
            // Account locked or not approved — sign out immediately
            setUser(null);
            setSession(null);
            await clearCachedProfile();
            try { await supabase.auth.signOut(); } catch (_) {}
          }
        } else if (!existingSession) {
          // No session at all — clear cached profile too
          setUser(null);
          await clearCachedProfile();
        }
      } catch (e: any) {
        console.log('Auth init error:', e?.message || e);
        // Don't sign out on unexpected errors — just let user proceed
        // with cached profile if available
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };
    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile, loadCachedProfile, cacheProfile, clearCachedProfile]);

  // ── 5-minute profile re-check: detect account lock / role change ──
  useEffect(() => {
    // Clear previous interval
    if (recheckIntervalRef.current) {
      clearInterval(recheckIntervalRef.current);
      recheckIntervalRef.current = null;
    }

    if (!session?.user || !user) return;

    recheckIntervalRef.current = setInterval(async () => {
      try {
        const profile = await fetchProfile(session.user.id, session.user.email ?? '');
        if (!profile || !profile.approved) {
          // Account has been locked by admin / fraud system
          console.log('Account locked detected during periodic re-check');
          setUser(null);
          setSession(null);
          await clearCachedProfile();
          try { await supabase.auth.signOut(); } catch (_) {}
        } else {
          // Update profile with latest data (role changes, etc.)
          setUser(profile);
          await cacheProfile(profile);
        }
      } catch {
        // Network error during re-check — ignore, keep current session
      }
    }, PROFILE_RECHECK_INTERVAL);

    return () => {
      if (recheckIntervalRef.current) {
        clearInterval(recheckIntervalRef.current);
        recheckIntervalRef.current = null;
      }
    };
  }, [session?.user?.id, user?.id, fetchProfile, cacheProfile, clearCachedProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string; pendingApproval?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        const profile = await fetchProfile(data.user.id, data.user.email ?? '');
        if (!profile) {
          await supabase.auth.signOut();
          return { success: false, error: 'Profile not found. Please contact admin.' };
        }
        if (!profile.approved) {
          await supabase.auth.signOut();
          return { success: false, pendingApproval: true, error: 'Your account is pending approval. Please wait for the admin to approve your account.' };
        }
        setSession(data.session);
        setUser(profile);
        await cacheProfile(profile);
        return { success: true };
      }

      return { success: false, error: 'Login failed. Please try again.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Login failed. Please try again.' };
    }
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string; needsApproval?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Always sign out after signup – they need admin approval first
        await supabase.auth.signOut();
        return { success: true, needsApproval: true };
      }

      return { success: false, error: 'Sign up failed. Please try again.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Sign up failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    // Unregister push token so this device stops receiving notifications
    const uid = user?.id;
    // Clear local state first so the UI navigates to login immediately
    setUser(null);
    setSession(null);
    await clearCachedProfile();
    try {
      if (uid) await unregisterPushToken(uid);
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Logout error:', e);
    }
  }, [user?.id, clearCachedProfile]);

  /** Refresh profile from DB (call after role changes, etc.) */
  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id, session.user.email ?? '');
      if (profile) setUser(profile);
    }
  }, [session, fetchProfile]);

  return {
    user,
    session,
    isLoading,
    isInitialized,
    isAuthenticated: !!user && !!session,
    isAdmin: user?.role === 'admin',
    login,
    signUp,
    logout,
    refreshProfile,
  };
});
