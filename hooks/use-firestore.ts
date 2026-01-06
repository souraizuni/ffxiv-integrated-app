// ============================================
// Firestore 資料同步 Hook
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  saveGearsets,
  loadGearsets,
  saveCollectionData,
  loadCollectionData,
  saveSettings,
  loadSettings,
  GearsetData,
  CollectionData,
  UserSettings,
  isFirebaseConfigured,
} from '@/lib/firebase';

// ---- 配裝資料同步 ----

export function useFirestoreGearsets(user: User | null) {
  const [cloudGearsets, setCloudGearsets] = useState<GearsetData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // 載入雲端資料
  const loadFromCloud = useCallback(async () => {
    if (!user || !isFirebaseConfigured()) return null;

    setIsLoading(true);
    try {
      const data = await loadGearsets(user.uid);
      setCloudGearsets(data);
      if (data) {
        setLastSynced(new Date());
      }
      return data;
    } catch (error) {
      console.error('載入雲端配裝失敗:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 儲存至雲端
  const saveToCloud = useCallback(async (gearsets: GearsetData[]) => {
    if (!user || !isFirebaseConfigured()) return false;

    setIsLoading(true);
    try {
      await saveGearsets(user.uid, gearsets);
      setCloudGearsets(gearsets);
      setLastSynced(new Date());
      return true;
    } catch (error) {
      console.error('儲存雲端配裝失敗:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 使用者登入時自動載入
  useEffect(() => {
    if (user) {
      loadFromCloud();
    } else {
      setCloudGearsets(null);
      setLastSynced(null);
    }
  }, [user, loadFromCloud]);

  return {
    cloudGearsets,
    isLoading,
    lastSynced,
    loadFromCloud,
    saveToCloud,
  };
}

// ---- 收集資料同步 ----

export function useFirestoreCollection(user: User | null) {
  const [cloudData, setCloudData] = useState<CollectionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 載入雲端資料
  const loadFromCloud = useCallback(async () => {
    if (!user || !isFirebaseConfigured()) return null;

    setIsLoading(true);
    try {
      const data = await loadCollectionData(user.uid);
      setCloudData(data);
      return data;
    } catch (error) {
      console.error('載入雲端收集資料失敗:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 儲存至雲端
  const saveToCloud = useCallback(async (ownedItems: Record<string, number[]>, wishlist: string[]) => {
    if (!user || !isFirebaseConfigured()) return false;

    setIsLoading(true);
    try {
      await saveCollectionData(user.uid, { ownedItems, wishlist });
      return true;
    } catch (error) {
      console.error('儲存雲端收集資料失敗:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFromCloud();
    } else {
      setCloudData(null);
    }
  }, [user, loadFromCloud]);

  return {
    cloudData,
    isLoading,
    loadFromCloud,
    saveToCloud,
  };
}

// ---- 設定資料同步 ----

export function useFirestoreSettings(user: User | null) {
  const [cloudSettings, setCloudSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadFromCloud = useCallback(async () => {
    if (!user || !isFirebaseConfigured()) return null;

    setIsLoading(true);
    try {
      const data = await loadSettings(user.uid);
      setCloudSettings(data);
      return data;
    } catch (error) {
      console.error('載入雲端設定失敗:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const saveToCloud = useCallback(async (settings: Omit<UserSettings, 'updatedAt'>) => {
    if (!user || !isFirebaseConfigured()) return false;

    setIsLoading(true);
    try {
      await saveSettings(user.uid, settings);
      return true;
    } catch (error) {
      console.error('儲存雲端設定失敗:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFromCloud();
    } else {
      setCloudSettings(null);
    }
  }, [user, loadFromCloud]);

  return {
    cloudSettings,
    isLoading,
    loadFromCloud,
    saveToCloud,
  };
}
