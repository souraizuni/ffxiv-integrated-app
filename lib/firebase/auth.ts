// ============================================
// Firebase 認證功能
// ============================================

'use client';

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './config';

// 使用 Google 登入
export async function signInWithGoogle(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    console.warn('Firebase Auth 未初始化');
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google 登入失敗:', error);
    throw error;
  }
}

// 登出
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;

  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('登出失敗:', error);
    throw error;
  }
}

// 監聽認證狀態變更
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

// 取得當前使用者
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser || null;
}

// 重新匯出設定檢查函式
export { isFirebaseConfigured };
