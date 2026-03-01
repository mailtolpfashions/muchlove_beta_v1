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
  /** True only when the user explicitly taps "Logout". Prevents any
   *  background event from accidentally clearing UI state. */
  const explicitLogoutRef = useRef(false);

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
        console.log('[Auth] onAuthStateChange:', event, !!newSession);

        // ── TOKEN_REFRESHED ──
        // Success → silently update session, keep user as-is.
        // Failure → only log out if the user explicitly triggered it.
        if (event === 'TOKEN_REFRESHED') {
          if (newSession) {
            setSession(newSession);
          }
          // If no session, don't kick user out — the cached profile
          // keeps the UI logged in. The 5-min recheck will catch
          // truly dead sessions eventually.
          return;
        }

        // ── SIGNED_IN ── login() already handles user + session,
        // so skip to avoid a double profile fetch.
        if (event === 'SIGNED_IN') {
          return;
        }

        // ── SIGNED_OUT ── only honour it when we triggered it.
        if (event === 'SIGNED_OUT') {
          if (explicitLogoutRef.current) {
            console.log('[Auth] Explicit logout — clearing state');
            setSession(null);
            setUser(null);
            await clearCachedProfile();
            explicitLogoutRef.current = false;
          }
          // Ignore SIGNED_OUT from background token failures.
          return;
        }

        // ── INITIAL_SESSION / USER_UPDATED / PASSWORD_RECOVERY ──
        // Only update if we actually have a session + approved profile.
        if (newSession?.user) {
          const profile = await fetchProfile(newSession.user.id, newSession.user.email ?? '');
          if (profile && profile.approved) {
            setSession(newSession);
            setUser(profile);
            await cacheProfile(profile);
          }
          // If profile not approved, don't clear — cached state stays.
        }
      }
    );

    const init = async () => {
      try {
        // Run seeding in background — don't block auth init
        initializeDatabase().catch(() => {});

        // ── 1. Instant restore: load cached profile for zero-delay launch ──
        //    Like FB/Instagram — if we have a cached profile, the user is
        //    "logged in" immediately. Everything else happens silently.
        const cached = await loadCachedProfile();
        if (!cancelled && cached) {
          setUser(cached);
        }

        // ── 2. Try to get the real session from Supabase ──
        let existingSession: Session | null = null;
        try {
          const result = await withTimeout(
            supabase.auth.getSession(),
            15000,
            'Session retrieval',
          );
          existingSession = result.data?.session ?? null;
          // Ignore sessionError — if we have a cache, user stays in.
          // Token will auto-refresh via onAuthStateChange.
        } catch {
          // Timeout or network error — keep cached profile
          console.log('[Auth] Session retrieval failed, keeping cached profile');
        }

        if (cancelled) return;

        if (existingSession?.user) {
          setSession(existingSession);

          // Background profile refresh — never blocks, never kicks out
          try {
            const profile = await withTimeout(
              fetchProfile(existingSession.user.id, existingSession.user.email ?? ''),
              8000,
              'Profile fetch',
            );
            if (!cancelled && profile && profile.approved) {
              setUser(profile);
              await cacheProfile(profile);
            }
            // If profile is locked/unapproved, let the 5-min recheck
            // handle it — don't flash to login on cold start.
          } catch {
            // Profile fetch timed out — keep cached profile
            console.log('[Auth] Profile fetch failed, keeping cached profile');
          }
        }
        // If no session AND no cache → user truly never logged in → login screen.
        // If no session BUT cache exists → keep showing app (token will refresh).
      } catch (e: any) {
        console.log('[Auth] Init error:', e?.message || e);
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
    // Mark as explicit so onAuthStateChange honours the SIGNED_OUT event
    explicitLogoutRef.current = true;
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

  /** Send a password-reset email via Supabase */
  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to send reset email.' };
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    signUp,
    logout,
    refreshProfile,
    resetPassword,
  };
});
