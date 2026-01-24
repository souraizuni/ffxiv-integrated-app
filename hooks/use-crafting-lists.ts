// ============================================
// 製作清單 Hook - 管理多份製作清單
// ============================================

import { useState, useEffect, useCallback } from 'react';

// ---- 清單資料類型 ----
export interface CraftingList {
  id: string;
  name: string;
  items: CraftingListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CraftingListItem {
  id: string;
  itemId: number;
  itemName: string;
  iconUrl?: string;
  quantity: number;       // 需要的數量
  completed: number;      // 已完成的數量
  recipeId?: number;      // 配方 ID（如果有的話）
}

// 儲存的 key
const STORAGE_KEY = 'ffxiv-crafting-lists';

// ---- Hook ----
export function useCraftingLists() {
  const [lists, setLists] = useState<CraftingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // 載入清單
  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = () => {
    setIsLoading(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedLists = JSON.parse(saved) as CraftingList[];
        setLists(parsedLists);
        // 自動選擇第一個清單
        if (parsedLists.length > 0 && !selectedListId) {
          setSelectedListId(parsedLists[0].id);
        }
      }
    } catch (error) {
      console.error('載入清單失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLists = useCallback((updatedLists: CraftingList[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLists));
      setLists(updatedLists);
    } catch (error) {
      console.error('儲存清單失敗:', error);
    }
  }, []);

  // 取得目前選擇的清單
  const selectedList = lists.find(l => l.id === selectedListId) || null;

  // 建立新清單
  const createList = useCallback((name: string): CraftingList => {
    const newList: CraftingList = {
      id: `list-${Date.now()}`,
      name,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...lists, newList];
    saveLists(updated);
    setSelectedListId(newList.id);
    return newList;
  }, [lists, saveLists]);

  // 刪除清單
  const deleteList = useCallback((listId: string) => {
    const updated = lists.filter(l => l.id !== listId);
    saveLists(updated);
    if (selectedListId === listId) {
      setSelectedListId(updated.length > 0 ? updated[0].id : null);
    }
  }, [lists, saveLists, selectedListId]);

  // 重新命名清單
  const renameList = useCallback((listId: string, newName: string) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        return { ...list, name: newName, updatedAt: new Date().toISOString() };
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  // 新增物品到清單
  const addItem = useCallback((
    listId: string,
    itemId: number,
    itemName: string,
    iconUrl?: string,
    recipeId?: number
  ) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        // 檢查是否已存在
        const existingIndex = list.items.findIndex(i => i.itemId === itemId);
        if (existingIndex >= 0) {
          // 已存在，增加數量
          const newItems = [...list.items];
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: newItems[existingIndex].quantity + 1,
          };
          return { ...list, items: newItems, updatedAt: new Date().toISOString() };
        } else {
          // 新增物品
          const newItem: CraftingListItem = {
            id: `item-${Date.now()}-${itemId}`,
            itemId,
            itemName,
            iconUrl,
            quantity: 1,
            completed: 0,
            recipeId,
          };
          return {
            ...list,
            items: [...list.items, newItem],
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  // 移除物品
  const removeItem = useCallback((listId: string, itemId: number) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.filter(i => i.itemId !== itemId),
          updatedAt: new Date().toISOString(),
        };
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  // 更新物品數量
  const updateItemQuantity = useCallback((listId: string, itemId: number, quantity: number) => {
    if (quantity < 1) return;
    const updated = lists.map(list => {
      if (list.id === listId) {
        const newItems = list.items.map(item =>
          item.itemId === itemId ? { ...item, quantity } : item
        );
        return { ...list, items: newItems, updatedAt: new Date().toISOString() };
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  // 更新已完成數量
  const updateItemCompleted = useCallback((listId: string, itemId: number, completed: number) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        const newItems = list.items.map(item => {
          if (item.itemId === itemId) {
            return { ...item, completed: Math.max(0, Math.min(completed, item.quantity)) };
          }
          return item;
        });
        return { ...list, items: newItems, updatedAt: new Date().toISOString() };
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  // 清空清單物品
  const clearItems = useCallback((listId: string) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        return { ...list, items: [], updatedAt: new Date().toISOString() };
      }
      return list;
    });
    saveLists(updated);
  }, [lists, saveLists]);

  return {
    lists,
    selectedList,
    selectedListId,
    isLoading,
    setSelectedListId,
    createList,
    deleteList,
    renameList,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemCompleted,
    clearItems,
    reload: loadLists,
  };
}
