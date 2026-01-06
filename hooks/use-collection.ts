// ============================================
// 收集追蹤 Hooks
// ============================================

import { useState, useCallback, useEffect } from 'react';
import { User } from 'firebase/auth';
import { saveCollectionData, loadCollectionData } from '@/lib/firebase/firestore';
import type { CollectionProgress } from '@/types';

// ---- 使用 Firestore 的收集項目 Hook ----
export function useCollectedItems(user: User | null) {
  const [items, setItems] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 從 Firestore 載入資料
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        // 未登入時使用本地儲存
        const stored = localStorage.getItem('ffxiv-collected-items');
        setItems(stored ? JSON.parse(stored) : []);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await loadCollectionData(user.uid);
        if (data) {
          // ownedItems 是 Record<string, number[]>，把所有 collection 合併為單一陣列
          const merged = Object.values(data.ownedItems || {}).flat();
          setItems(Array.from(new Set(merged)));
        }
      } catch (err) {
        setError(err as Error);
        console.error('載入收集資料失敗:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // 儲存到 Firestore
  const saveItems = useCallback(async (newItems: number[]) => {
    if (user) {
      try {
        // Firestore expects ownedItems as Record<string, number[]>
        await saveCollectionData(user.uid, {
          ownedItems: { All: newItems },
          wishlist: [],
        });
      } catch (err) {
        console.error('儲存收集資料失敗:', err);
      }
    }
    // 同時儲存到本地作為備份
    localStorage.setItem('ffxiv-collected-items', JSON.stringify(newItems));
  }, [user]);

  // 新增收集項目
  const addItem = useCallback(
    async (itemId: number) => {
      if (items.includes(itemId)) return;
      const newItems = [...items, itemId];
      setItems(newItems);
      await saveItems(newItems);
    },
    [items, saveItems]
  );

  // 移除收集項目
  const removeItem = useCallback(
    async (itemId: number) => {
      const newItems = items.filter((id) => id !== itemId);
      setItems(newItems);
      await saveItems(newItems);
    },
    [items, saveItems]
  );

  // 切換收集狀態
  const toggleItem = useCallback(
    async (itemId: number) => {
      if (items.includes(itemId)) {
        await removeItem(itemId);
      } else {
        await addItem(itemId);
      }
    },
    [items, addItem, removeItem]
  );

  // 檢查是否已收集
  const isCollected = useCallback(
    (itemId: number) => items.includes(itemId),
    [items]
  );

  // 重新載入
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await loadCollectionData(user.uid);
      if (data) {
        const merged = Object.values(data.ownedItems || {}).flat();
        setItems(Array.from(new Set(merged)));
      }
    } catch (err) {
      console.error('重新載入失敗:', err);
    }
  }, [user]);

  return {
    items,
    isLoading,
    error,
    addItem,
    removeItem,
    toggleItem,
    isCollected,
    refresh,
  };
}

// ---- 計算收集進度 ----
export function useCollectionProgress(
  user: User | null,
  categoryId: string,
  totalItemIds: number[]
) {
  const { items, isLoading } = useCollectedItems(user);

  const collectedInCategory = items.filter((itemId) =>
    totalItemIds.includes(itemId)
  );

  const progress: CollectionProgress = {
    categoryId,
    totalItems: totalItemIds.length,
    collectedItems: collectedInCategory.length,
    percentage:
      totalItemIds.length > 0
        ? Math.round((collectedInCategory.length / totalItemIds.length) * 100)
        : 0,
  };

  return {
    progress,
    isLoading,
  };
}

// ---- 本地儲存版本（不需要登入）----
export function useLocalCollectedItems() {
  const STORAGE_KEY = 'ffxiv-collected-items';

  const [items, setItems] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const addItem = useCallback((itemId: number) => {
    setItems((prev) => {
      if (prev.includes(itemId)) return prev;
      const next = [...prev, itemId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((itemId: number) => {
    setItems((prev) => {
      const next = prev.filter((id) => id !== itemId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleItem = useCallback(
    (itemId: number) => {
      if (items.includes(itemId)) {
        removeItem(itemId);
      } else {
        addItem(itemId);
      }
    },
    [items, addItem, removeItem]
  );

  const isCollected = useCallback(
    (itemId: number) => items.includes(itemId),
    [items]
  );

  return {
    items,
    addItem,
    removeItem,
    toggleItem,
    isCollected,
  };
}
