// ============================================
// 收集追蹤 Hooks
// ============================================

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { CollectedItem, CollectionProgress } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// ---- 取得使用者收集清單 ----
export function useCollectedItems(userId: string | null) {
  const supabase: SupabaseClient = createClient();

  const fetcher = async () => {
    if (!userId || !supabase) return [];
    
    const { data, error } = await supabase
      .from('collected_items')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data as CollectedItem[];
  };

  const { data, error, isLoading, mutate } = useSWR(
    userId && isSupabaseConfigured() ? `collected-items-${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // 新增收集項目
  const addItem = useCallback(
    async (itemId: number, isHQ: boolean = false, notes?: string) => {
      if (!userId) return;

      const supabase: SupabaseClient = createClient();
      if (!supabase) return;
      
      const { error } = await supabase.from('collected_items').insert({
        user_id: userId,
        item_id: itemId,
        is_hq: isHQ,
        notes,
      });

      if (error) throw error;
      mutate();
    },
    [userId, mutate]
  );

  // 移除收集項目
  const removeItem = useCallback(
    async (itemId: number) => {
      if (!userId) return;

      const supabase: SupabaseClient = createClient();
      if (!supabase) return;
      
      const { error } = await supabase
        .from('collected_items')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId);

      if (error) throw error;
      mutate();
    },
    [userId, mutate]
  );

  // 切換收集狀態
  const toggleItem = useCallback(
    async (itemId: number, isHQ: boolean = false) => {
      const isCollected = data?.some((item) => item.itemId === itemId);
      if (isCollected) {
        await removeItem(itemId);
      } else {
        await addItem(itemId, isHQ);
      }
    },
    [data, addItem, removeItem]
  );

  // 檢查是否已收集
  const isCollected = useCallback(
    (itemId: number) => {
      return data?.some((item) => item.itemId === itemId) ?? false;
    },
    [data]
  );

  return {
    items: data || [],
    isLoading,
    error,
    addItem,
    removeItem,
    toggleItem,
    isCollected,
    refresh: mutate,
  };
}

// ---- 計算收集進度 ----
export function useCollectionProgress(
  userId: string | null,
  categoryId: string,
  totalItemIds: number[]
) {
  const { items, isLoading } = useCollectedItems(userId);

  const collectedInCategory = items.filter((item) =>
    totalItemIds.includes(item.itemId)
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
