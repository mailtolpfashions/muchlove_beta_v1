import React, { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { initializeDatabase, withTimeout } from '@/utils/database';
import { unregisterPushToken } from '@/utils/notifications';
import type { Session } from '@supabase/supabase-js';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

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

        // Check for existing Supabase Auth session.
        // Use a generous timeout — AsyncStorage can be slow on some devices,
        // especially after caching a lot of offline data.
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
          // Timeout: don't sign out — just proceed without session.
          // The user can still log in manually. This avoids clearing
          // a valid session just because AsyncStorage was slow.
          console.log('Session retrieval slow, proceeding without session:', timeoutErr?.message);
          return;
        }

        if (cancelled) return;

        // If the stored refresh token is invalid/expired, sign out and clear stale session
        if (sessionError) {
          console.log('Session retrieval error (clearing stale session):', sessionError.message);
          try { await supabase.auth.signOut(); } catch (_) {}
          return;
        }

        if (existingSession?.user) {
          let profile: User | null = null;
          try {
            profile = await withTimeout(
              fetchProfile(existingSession.user.id, existingSession.user.email ?? ''),
              8000,
              'Profile fetch',
            );
          } catch (profileErr: any) {
            // Profile fetch failed/timed out — still set session so user isn't locked out.
            // They'll see data when connectivity improves.
            console.log('Profile fetch slow, setting session without profile:', profileErr?.message);
            setSession(existingSession);
            return;
          }
          if (cancelled) return;
          if (profile && profile.approved) {
            setSession(existingSession);
            setUser(profile);
          } else {
            // Not approved – sign them out silently
            try { await supabase.auth.signOut(); } catch (_) {}
          }
        }
      } catch (e: any) {
        console.log('Auth init error:', e?.message || e);
        // Don't sign out on unexpected errors — just let user proceed to login
        // This prevents clearing valid sessions due to transient issues
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
  }, [fetchProfile]);

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
    try {
      if (uid) await unregisterPushToken(uid);
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Logout error:', e);
    }
  }, [user?.id]);

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
