'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCraftingLists } from '@/hooks/use-crafting-lists';
import { MaterialSummary } from '@/components/material-summary';
import { searchRecipes } from '@/lib/recipe-datasource';
import type { RecipeInfo } from '@/lib/recipe-datasource';

export default function RequirementListsPage() {
  const {
    lists,
    selectedList,
    selectedListId,
    isLoading,
    setSelectedListId,
    createList,
    deleteList,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemCompleted,
    clearItems,
  } = useCraftingLists();

  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'materials'>('items');

  // 搜尋狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 搜尋配方
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const result = await searchRecipes(query, 1);
      setSearchResults(result.results.slice(0, 20));
    } catch (error) {
      console.error('搜尋失敗:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 防抖搜尋
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // 建構圖示 URL（統一格式）
  const buildIconUrl = (itemId: number): string => {
    const folder = Math.floor(itemId / 1000) * 1000;
    return `https://cafemaker.wakingsands.com/i/${folder}/${String(itemId).padStart(6, '0')}.png`;
  };

  // 新增物品到清單
  const handleAddItem = async (recipe: RecipeInfo) => {
    if (!selectedListId) return;

    // 建構圖示 URL
    const iconUrl = buildIconUrl(recipe.item_id);
    
    addItem(
      selectedListId,
      recipe.item_id,
      recipe.item_name,
      iconUrl,
      recipe.id
    );

    // 清除搜尋
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // 建立新清單
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createList(newListName.trim());
    setNewListName('');
    setShowNewListForm(false);
  };

  // 刪除清單確認
  const handleDeleteList = (listId: string, listName: string) => {
    if (confirm(`確定要刪除清單「${listName}」嗎？此操作無法復原。`)) {
      deleteList(listId);
    }
  };

  // 清空清單確認
  const handleClearItems = () => {
    if (!selectedListId || !selectedList) return;
    if (confirm(`確定要清空清單「${selectedList.name}」中的所有物品嗎？`)) {
      clearItems(selectedListId);
    }
  };

  // 點擊外部關閉搜尋結果
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-500">載入清單中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 標題區 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">📝 需求清單</h1>
          <p className="text-gray-500 mt-1">建立製作清單，統計所需材料總覽</p>
        </div>
        <button
          onClick={() => setShowNewListForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>新增清單</span>
        </button>
      </div>

      {/* 新增清單表單 */}
      {showNewListForm && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">建立新清單</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="輸入清單名稱（例：7.2 新裝備、週製作計畫）"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreateList}
              disabled={!newListName.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              建立
            </button>
            <button
              onClick={() => {
                setShowNewListForm(false);
                setNewListName('');
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 主要內容區 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左側：清單列表 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold mb-4">我的清單</h2>
            <div className="space-y-2">
              {lists.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">尚無清單</p>
                  <p className="text-sm">點擊上方按鈕建立新清單</p>
                </div>
              ) : (
                lists.map((list) => {
                  const totalItems = list.items.reduce((sum, item) => sum + item.quantity, 0);
                  const completedItems = list.items.reduce((sum, item) => sum + item.completed, 0);
                  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

                  return (
                    <button
                      key={list.id}
                      onClick={() => setSelectedListId(list.id)}
                      className={`
                        w-full text-left p-4 rounded-lg border-2 transition-all
                        ${selectedListId === list.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }
                      `}
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {list.name}
                      </h3>
                      <div className="mt-2 text-sm text-gray-500">
                        <p>{list.items.length} 項裝備</p>
                        {list.items.length > 0 && (
                          <>
                            <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-green-500 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs">
                              進度: {completedItems} / {totalItems}
                            </p>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右側：清單詳情 */}
        <div className="lg:col-span-3">
          {selectedList ? (
            <div className="space-y-6">
              {/* 清單標題和操作 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedList.name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      建立於 {new Date(selectedList.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteList(selectedList.id, selectedList.name)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      刪除清單
                    </button>
                  </div>
                </div>

                {/* 搜尋新增裝備 */}
                <div className="search-container relative mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="搜尋裝備名稱（例：傳說指環）..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 搜尋結果下拉 */}
                  {showSearchResults && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      {searchResults.length === 0 && !isSearching && searchQuery.length >= 1 && (
                        <div className="p-4 text-gray-500 text-center">
                          找不到符合的配方
                        </div>
                      )}
                      {searchResults.map((recipe) => (
                        <button
                          key={recipe.id}
                          onClick={() => handleAddItem(recipe)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <img
                            src={buildIconUrl(recipe.item_id)}
                            alt={recipe.item_name}
                            className="w-10 h-10 rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">
                              {recipe.item_name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <span>{recipe.job}</span>
                              <span>•</span>
                              <span>Lv.{recipe.rlv}</span>
                            </div>
                          </div>
                          <span className="text-blue-500 text-sm">+ 新增</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 分頁標籤 */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('items')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'items'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    📦 裝備列表 ({selectedList.items.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === 'materials'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🪨 材料總覽
                  </button>
                </div>
              </div>

              {/* 裝備列表 */}
              {activeTab === 'items' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  {selectedList.items.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-5xl mb-4">🔍</div>
                      <p className="text-lg mb-2">此清單為空</p>
                      <p className="text-sm">使用上方搜尋欄位搜尋並新增裝備</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm text-gray-500">
                          共 {selectedList.items.length} 項裝備
                        </span>
                        <button
                          onClick={handleClearItems}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          清空清單
                        </button>
                      </div>
                      <div className="space-y-3">
                        {selectedList.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            {/* 物品圖示 */}
                            {item.iconUrl && (
                              <img
                                src={item.iconUrl}
                                alt={item.itemName}
                                className="w-12 h-12 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}

                            {/* 物品名稱 */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                {item.itemName}
                              </h4>
                              <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    item.completed >= item.quantity ? 'bg-green-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (item.completed / item.quantity) * 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                完成: {item.completed} / {item.quantity}
                              </p>
                            </div>

                            {/* 數量控制 */}
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-xs text-gray-500">需求數量</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateItemQuantity(selectedList.id, item.itemId, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    updateItemQuantity(selectedList.id, item.itemId, Math.max(1, val));
                                  }}
                                  className="w-16 text-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800"
                                />
                                <button
                                  onClick={() => updateItemQuantity(selectedList.id, item.itemId, item.quantity + 1)}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* 完成數量控制 */}
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-xs text-gray-500">已完成</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateItemCompleted(selectedList.id, item.itemId, item.completed - 1)}
                                  disabled={item.completed <= 0}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="w-12 text-center font-semibold">
                                  {item.completed}
                                </span>
                                <button
                                  onClick={() => updateItemCompleted(selectedList.id, item.itemId, item.completed + 1)}
                                  disabled={item.completed >= item.quantity}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* 移除按鈕 */}
                            <button
                              onClick={() => removeItem(selectedList.id, item.itemId)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="移除此項目"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 材料總覽 */}
              {activeTab === 'materials' && (
                <MaterialSummary items={selectedList.items} />
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center py-16 text-gray-500">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-lg mb-2">選擇一個清單開始</p>
                <p className="text-sm">或建立新的需求清單來統計所需材料</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
