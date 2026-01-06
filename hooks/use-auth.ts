// ============================================
// Firebase Auth Hook
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  signInWithGoogle, 
  signOut, 
  onAuthChange, 
  isFirebaseConfigured,
  handleRedirectResult,
} from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isConfigured: isFirebaseConfigured(),
  });

  useEffect(() => {
    if (!state.isConfigured) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // 處理 redirect 登入結果（若使用者從 Google 登入頁面返回）
    handleRedirectResult().then((user) => {
      if (user) {
        setState({
          user,
          isLoading: false,
          isConfigured: true,
        });
      }
    });

    const unsubscribe = onAuthChange((user) => {
      setState({
        user,
        isLoading: false,
        isConfigured: true,
      });
    });

    return unsubscribe;
  }, [state.isConfigured]);

  const login = useCallback(async () => {
    if (!state.isConfigured) {
      console.warn('Firebase 未設定');
      return null;
    }

    try {
      const user = await signInWithGoogle();
      return user;
    } catch (error) {
      console.error('登入失敗:', error);
      throw error;
    }
  }, [state.isConfigured]);

  const logout = useCallback(async () => {
    if (!state.isConfigured) return;

    try {
      await signOut();
    } catch (error) {
      console.error('登出失敗:', error);
      throw error;
    }
  }, [state.isConfigured]);

  return {
    user: state.user,
    isLoading: state.isLoading,
    isConfigured: state.isConfigured,
    isLoggedIn: !!state.user,
    login,
    logout,
  };
}
