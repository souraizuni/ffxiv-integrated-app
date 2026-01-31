// ============================================
// Firestore 資料操作
// ============================================

'use client';

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './config';

// ---- 配裝資料 ----

export interface GearsetData {
  id: number;
  name?: string;
  value: {
    level: number;
    craftsmanship: number;
    control: number;
    cp: number;
  };
  compatibleJobs: string[];
}

// ---- 收集資料 ----

export interface CollectionData {
  ownedItems: Record<string, number[]>; // { "Mounts": [1, 2, 3], "Minions": [4, 5] }
  wishlist: string[]; // ["Mounts:1", "Minions:4"]
}

// ---- 設定資料 ----

export interface UserSettings {
  server?: string;
  dataCenter?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  crafterStats?: {
    job: string;
    level: number;
    craftsmanship: number;
    control: number;
    cp: number;
    specialist: boolean;
  };
}

// ---- 使用者雲端資料（儲存在單一文件中）----

export interface UserCloudData {
  gearsets?: GearsetData[];
  collections?: CollectionData;
  settings?: UserSettings;
  updatedAt?: Timestamp;
}

// 儲存配裝資料（使用單一文件，與 ffxiv-best-craft 相同）
export async function saveGearsets(userId: string, gearsets: GearsetData[]): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    gearsets,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// 載入配裝資料
export async function loadGearsets(userId: string): Promise<GearsetData[] | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as UserCloudData;
    return data.gearsets || null;
  }
  return null;
}

// 儲存收集資料
export async function saveCollectionData(userId: string, data: CollectionData): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    collections: data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// 載入收集資料
export async function loadCollectionData(userId: string): Promise<CollectionData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as UserCloudData;
    return data.collections || null;
  }
  return null;
}

// 儲存設定
export async function saveSettings(userId: string, settings: UserSettings): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// 載入設定
export async function loadSettings(userId: string): Promise<UserSettings | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as UserCloudData;
    return data.settings || null;
  }
  return null;
}

// 重新匯出設定檢查函式
export { isFirebaseConfigured };
