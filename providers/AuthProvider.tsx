import React, { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { initializeDatabase } from '@/utils/database';
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
      createdAt: data.created_at,
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();

        // Check for existing Supabase Auth session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.user) {
          setSession(existingSession);
          const profile = await fetchProfile(existingSession.user.id, existingSession.user.email ?? '');
          if (profile) setUser(profile);
        }
      } catch (e) {
        console.log('Auth init error:', e);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    init();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          const profile = await fetchProfile(newSession.user.id, newSession.user.email ?? '');
          setUser(profile);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const profile = await fetchProfile(data.user.id, data.user.email ?? '');
        if (profile) {
          setUser(profile);
          return { success: true };
        }
        return { success: false, error: 'Profile not found. Please contact admin.' };
      }

      return { success: false, error: 'Login failed. Please try again.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Login failed. Please try again.' };
    }
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> => {
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

      // If email confirmation is required, user won't have a session yet
      if (data.user && !data.session) {
        return { success: true, needsVerification: true };
      }

      // If auto-confirmed (e.g. Supabase settings), user is signed in
      if (data.user && data.session) {
        const profile = await fetchProfile(data.user.id, data.user.email ?? '');
        if (profile) setUser(profile);
        return { success: true };
      }

      return { success: false, error: 'Sign up failed. Please try again.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Sign up failed. Please try again.' };
    }
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (e) {
      console.log('Logout error:', e);
    }
  }, []);

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
