// ============================================
// Firestore 資料操作
// ============================================

'use client';

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from './config';

// ---- 使用者資料 ----

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 儲存/更新使用者資料
export async function saveUserData(userData: Partial<UserData> & { uid: string }): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const userRef = doc(db, 'users', userData.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    await updateDoc(userRef, {
      ...userData,
      updatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(userRef, {
      ...userData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
}

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

export interface UserGearsets {
  gearsets: GearsetData[];
  updatedAt: Timestamp;
}

// 儲存配裝資料
export async function saveGearsets(userId: string, gearsets: GearsetData[]): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const gearsetsRef = doc(db, 'users', userId, 'data', 'gearsets');
  await setDoc(gearsetsRef, {
    gearsets,
    updatedAt: Timestamp.now(),
  });
}

// 載入配裝資料
export async function loadGearsets(userId: string): Promise<GearsetData[] | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const gearsetsRef = doc(db, 'users', userId, 'data', 'gearsets');
  const snapshot = await getDoc(gearsetsRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as UserGearsets;
    return data.gearsets;
  }
  return null;
}

// ---- 收集資料 ----

export interface CollectionData {
  ownedItems: Record<string, number[]>; // { "Mounts": [1, 2, 3], "Minions": [4, 5] }
  wishlist: string[]; // ["Mounts:1", "Minions:4"]
  updatedAt: Timestamp;
}

// 儲存收集資料
export async function saveCollectionData(userId: string, data: Omit<CollectionData, 'updatedAt'>): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const collectionRef = doc(db, 'users', userId, 'data', 'collections');
  await setDoc(collectionRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// 載入收集資料
export async function loadCollectionData(userId: string): Promise<CollectionData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const collectionRef = doc(db, 'users', userId, 'data', 'collections');
  const snapshot = await getDoc(collectionRef);

  if (snapshot.exists()) {
    return snapshot.data() as CollectionData;
  }
  return null;
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
  updatedAt: Timestamp;
}

// 儲存設定
export async function saveSettings(userId: string, settings: Omit<UserSettings, 'updatedAt'>): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const settingsRef = doc(db, 'users', userId, 'data', 'settings');
  await setDoc(settingsRef, {
    ...settings,
    updatedAt: Timestamp.now(),
  });
}

// 載入設定
export async function loadSettings(userId: string): Promise<UserSettings | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  const settingsRef = doc(db, 'users', userId, 'data', 'settings');
  const snapshot = await getDoc(settingsRef);

  if (snapshot.exists()) {
    return snapshot.data() as UserSettings;
  }
  return null;
}

// 重新匯出設定檢查函式
export { isFirebaseConfigured };
