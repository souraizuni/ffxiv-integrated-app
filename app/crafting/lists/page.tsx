'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CraftingList {
  id: string;
  name: string;
  items: CraftingListItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface CraftingListItem {
  id: string;
  itemId: number;
  itemName: string;
  quantity: number;
  completed: number;
  notes?: string;
}

export default function CraftingListsPage() {
  const [lists, setLists] = useState<CraftingList[]>([]);
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState<CraftingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 載入清單
  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = () => {
    setIsLoading(true);
    try {
      const saved = localStorage.getItem('ffxiv-crafting-lists');
      if (saved) {
        const parsedLists = JSON.parse(saved) as CraftingList[];
        setLists(parsedLists);
      }
    } catch (error) {
      console.error('載入清單失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLists = (updatedLists: CraftingList[]) => {
    try {
      localStorage.setItem('ffxiv-crafting-lists', JSON.stringify(updatedLists));
      setLists(updatedLists);
    } catch (error) {
      console.error('儲存清單失敗:', error);
    }
  };

  const createNewList = () => {
    if (!newListName.trim()) return;

    const newList: CraftingList = {
      id: Date.now().toString(),
      name: newListName,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveLists([...lists, newList]);
    setNewListName('');
    setShowNewListForm(false);
  };

  const deleteList = (id: string) => {
    if (confirm('確定要刪除此清單嗎？')) {
      const updated = lists.filter(l => l.id !== id);
      saveLists(updated);
      if (selectedList?.id === id) {
        setSelectedList(null);
      }
    }
  };

  const updateListItem = (listId: string, itemIndex: number, updates: Partial<CraftingListItem>) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        const newItems = [...list.items];
        newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
        return { ...list, items: newItems, updatedAt: new Date() };
      }
      return list;
    });
    saveLists(updated);
  };

  const removeListItem = (listId: string, itemIndex: number) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.filter((_, i) => i !== itemIndex),
          updatedAt: new Date(),
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const addItemToList = (listId: string, itemId: number, itemName: string) => {
    const updated = lists.map(list => {
      if (list.id === listId) {
        const existingItem = list.items.find(i => i.itemId === itemId);
        if (existingItem) {
          // 如果已存在，增加數量
          const newItems = list.items.map(i =>
            i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i
          );
          return { ...list, items: newItems, updatedAt: new Date() };
        } else {
          // 新增物品
          return {
            ...list,
            items: [
              ...list.items,
              {
                id: `${listId}-${itemId}-${Date.now()}`,
                itemId,
                itemName,
                quantity: 1,
                completed: 0,
              },
            ],
            updatedAt: new Date(),
          };
        }
      }
      return list;
    });
    saveLists(updated);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-500">載入清單中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">📋 製作清單</h1>
        <button
          onClick={() => setShowNewListForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          + 新增清單
        </button>
      </div>

      {/* 新增清單表單 */}
      {showNewListForm && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">新增清單</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="輸入清單名稱..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createNewList()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              autoFocus
            />
            <button
              onClick={createNewList}
              disabled={!newListName.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              建立
            </button>
            <button
              onClick={() => setShowNewListForm(false)}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 清單列表和詳細視圖 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 清單列表 */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">我的清單</h2>
          <div className="space-y-2">
            {lists.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">無清單</p>
            ) : (
              lists.map((list) => {
                const completedCount = list.items.reduce(
                  (sum, item) => sum + item.completed,
                  0
                );
                const totalCount = list.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );
                const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                return (
                  <button
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={`
                      w-full text-left p-4 rounded-lg border-2 transition-all
                      ${
                        selectedList?.id === list.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <h3 className="font-semibold text-sm truncate text-gray-900 dark:text-white">
                      {list.name}
                    </h3>
                    <div className="text-xs text-gray-500 mt-2">
                      <p>{list.items.length} 項物品</p>
                      <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs">
                        {completedCount} / {totalCount}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 清單詳細內容 */}
        <div className="lg:col-span-3">
          {selectedList ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedList.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    建立於 {selectedList.createdAt ? new Date(selectedList.createdAt).toLocaleDateString('zh-TW') : '未知'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/crafting"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  >
                    前往配方頁
                  </Link>
                  <button
                    onClick={() => deleteList(selectedList.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                  >
                    刪除清單
                  </button>
                </div>
              </div>

              {selectedList.items.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">此清單為空</p>
                  <p className="text-sm">前往生產指引頁面，搜尋配方並加入到此清單</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedList.items.map((item, index) => {
                    const completionPercent =
                      item.quantity > 0
                        ? (item.completed / item.quantity) * 100
                        : 100;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        {/* 物品資訊 */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                            {item.itemName}
                          </h4>
                          <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${completionPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.completed} / {item.quantity}
                          </p>
                        </div>

                        {/* 控制按鈕 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateListItem(selectedList.id, index, {
                                completed: Math.max(0, item.completed - 1),
                              })
                            }
                            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-semibold text-sm">
                            {item.completed}
                          </span>
                          <button
                            onClick={() =>
                              updateListItem(selectedList.id, index, {
                                completed: Math.min(item.quantity, item.completed + 1),
                              })
                            }
                            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeListItem(selectedList.id, index)}
                            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg">選擇一個清單來檢視詳情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
