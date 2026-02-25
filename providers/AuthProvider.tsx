import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { User } from '@/types';
import { hashPassword } from '@/utils/hash';
import { initializeDatabase } from '@/utils/database';
import * as supabaseDb from '@/utils/supabaseDb';


const AUTH_KEY = '@crm_current_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        const stored = await AsyncStorage.getItem(AUTH_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as User;
          const fresh = await supabaseDb.users.findByUsername(parsed.username);
          if (fresh) {
            setUser(fresh);
          }
        }
      } catch (e) {
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const found = await supabaseDb.users.findByUsername(username);
      if (!found) {
        console.log('Login failed: User not found');
        return { success: false, error: 'User not found' };
      }
      const hashed = await hashPassword(password);
      if (hashed !== found.passwordHash) {
        console.log('Login failed: Invalid password');
        return { success: false, error: 'Invalid password' };
      }
      setUser(found);
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(found));
      return { success: true };
    } catch (e) {
      console.log('Login failed with error:', e);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem(AUTH_KEY);
    } catch (e) {
    }
  }, []);

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
  };
});
