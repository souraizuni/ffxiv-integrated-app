// ============================================
// Firebase 認證功能
// ============================================

'use client';

import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './config';

// 使用 Google 登入（優先使用 Popup，若被封鎖則改用 Redirect）
export async function signInWithGoogle(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    console.warn('Firebase Auth 未初始化');
    return null;
  }

  try {
    // 先嘗試 popup 登入
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: unknown) {
    // 若 popup 被封鎖，改用 redirect
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string };
      if (firebaseError.code === 'auth/popup-blocked' || firebaseError.code === 'auth/popup-closed-by-user') {
        console.log('Popup 被封鎖，改用 redirect 登入...');
        await signInWithRedirect(auth, googleProvider);
        return null; // redirect 後頁面會重新載入
      }
    }
    console.error('Google 登入失敗:', error);
    throw error;
  }
}

// 處理 Redirect 登入結果（頁面載入時呼叫）
export async function handleRedirectResult(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Redirect 登入結果處理失敗:', error);
    return null;
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
