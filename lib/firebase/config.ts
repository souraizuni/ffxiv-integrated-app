// ============================================
// Firebase 設定
// ============================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Firebase 設定 - 從環境變數讀取
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 檢查 Firebase 是否已設定
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
}

// Firebase App 實例
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;

// 初始化 Firebase
export function initializeFirebase(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase 尚未設定，請在 .env.local 中設定環境變數');
    return null;
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  // 初始化 Analytics（僅在瀏覽器環境）
  if (typeof window !== 'undefined' && app) {
    isSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app);
      }
    });
  }

  return app;
}

// 取得 Firebase Auth
export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  
  if (!auth) {
    const firebaseApp = initializeFirebase();
    if (firebaseApp) {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

// 取得 Firestore
export function getFirestoreDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  
  if (!db) {
    const firebaseApp = initializeFirebase();
    if (firebaseApp) {
      db = getFirestore(firebaseApp);
    }
  }
  return db;
}

// Google 登入 Provider
export const googleProvider = new GoogleAuthProvider();

// 取得 Analytics
export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}
