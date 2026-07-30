'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import {
  SOURCE_CATEGORIES,
  PATCH_VERSIONS,
  COLLECTION_NAMES,
  getIconUrl,
  passesFilters,
  createDefaultFilterState,
  type CollectionItem,
  type FilterState,
} from '@/lib/collection/filters';
import { useAuth } from '@/hooks/use-auth';
import { useFirestoreCollection } from '@/hooks/use-firestore';
import {
  getCollectionIndex,
  getCollection,
  type CollectionSummary,
} from '@/lib/data/collections';

// 每頁顯示數量
const PAGE_SIZE = 100;

export default function CollectionPage() {
  // 當前選擇的收集類型
  const [currentCollection, setCurrentCollection] = useState<string>('Mounts');

  // 收集類型索引很小（約 700 B），一開始就載入
  const { data: indexData, isLoading } = useSWR('collection-index', getCollectionIndex, {
    revalidateOnFocus: false,
  });
  const collectionIndex: CollectionSummary[] = useMemo(
    () => indexData?.collections ?? [],
    [indexData]
  );

  const currentSlug = collectionIndex.find((c) => c.name === currentCollection)?.slug;

  // 只載入目前選取的分頁。SWR 會保留已載入過的分頁，切回去時不再重抓。
  const { data: currentCollectionData, isLoading: isSwitching } = useSWR(
    currentSlug ? ['collection', currentSlug] : null,
    ([, slug]: [string, string]) => getCollection(slug),
    { revalidateOnFocus: false, keepPreviousData: false }
  );

  // 篩選狀態
  const [filterState, setFilterState] = useState<FilterState>(createDefaultFilterState());
  
  // 擁有的項目 (本地儲存)
  const [ownedItems, setOwnedItems] = useState<Record<string, Set<number>>>({});
  
  // 願望清單
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  
  // 詳情 Modal
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  
  // 分頁顯示數量
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  
  // 滾動載入更多的參考
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Firebase Auth
  const { user, isLoggedIn, login, logout, isConfigured } = useAuth();
  const { cloudData, saveToCloud, isLoading: isSyncing } = useFirestoreCollection(user);

  // 載入本地儲存的擁有項目
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (collectionIndex.length === 0) return;

    // 載入擁有項目
    const storedOwned: Record<string, Set<number>> = {};
    collectionIndex.forEach((collection) => {
      const key = `ffxiv-owned-${collection.name}`;
      const data = localStorage.getItem(key);
      storedOwned[collection.name] = data ? new Set(JSON.parse(data)) : new Set();
    });
    setOwnedItems(storedOwned);

    // 載入願望清單
    const wishlistData = localStorage.getItem('ffxiv-wishlist');
    if (wishlistData) {
      setWishlist(new Set(JSON.parse(wishlistData)));
    }
  }, [collectionIndex]);

  // 當使用者登入時，從雲端載入資料
  useEffect(() => {
    if (user && cloudData) {
      // 合併雲端資料
      if (cloudData.ownedItems) {
        const merged: Record<string, Set<number>> = {};
        for (const [key, ids] of Object.entries(cloudData.ownedItems)) {
          merged[key] = new Set(ids);
        }
        setOwnedItems(merged);
      }
      if (cloudData.wishlist) {
        setWishlist(new Set(cloudData.wishlist));
      }
    }
  }, [user, cloudData]);

  // 篩選後的項目
  const filteredItems = useMemo(() => {
    if (!currentCollectionData) return [];

    const isOwned = (id: number) => ownedItems[currentCollection]?.has(id) ?? false;
    
    return currentCollectionData.Items.filter((item) =>
      passesFilters(item, filterState, isOwned)
    );
  }, [currentCollectionData, filterState, ownedItems, currentCollection]);
  
  // 當前顯示的項目（分頁）
  const displayedItems = useMemo(() => {
    return filteredItems.slice(0, displayCount);
  }, [filteredItems, displayCount]);
  
  // 是否還有更多項目可載入
  const hasMore = displayCount < filteredItems.length;
  
  // 載入更多
  const loadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length));
  }, [filteredItems.length]);
  
  // 當篩選條件變更時重置顯示數量
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [currentCollection, filterState]);
  
  // 無限滾動觀察器
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // 切換擁有狀態
  const toggleOwned = useCallback((itemId: number) => {
    setOwnedItems((prev) => {
      const current = prev[currentCollection] || new Set();
      const updated = new Set(current);
      
      if (updated.has(itemId)) {
        updated.delete(itemId);
      } else {
        updated.add(itemId);
      }

      // 儲存到 localStorage
      localStorage.setItem(
        `ffxiv-owned-${currentCollection}`,
        JSON.stringify([...updated])
      );

      return { ...prev, [currentCollection]: updated };
    });
  }, [currentCollection]);

  // 切換願望清單
  const toggleWishlist = useCallback((itemId: number) => {
    const key = `${currentCollection}:${itemId}`;
    setWishlist((prev) => {
      const updated = new Set(prev);
      if (updated.has(key)) {
        updated.delete(key);
      } else {
        updated.add(key);
      }

      // 儲存到 localStorage
      localStorage.setItem('ffxiv-wishlist', JSON.stringify([...updated]));

      return updated;
    });
  }, [currentCollection]);

  // 切換分類篩選
  const toggleCategory = useCallback((category: string) => {
    setFilterState((prev) => {
      const updated = new Set(prev.activeCategories);
      if (updated.has(category)) {
        updated.delete(category);
      } else {
        updated.add(category);
      }
      return { ...prev, activeCategories: updated };
    });
  }, []);

  // 切換版本篩選
  const togglePatch = useCallback((patch: string) => {
    setFilterState((prev) => {
      const updated = new Set(prev.activePatches);
      if (updated.has(patch)) {
        updated.delete(patch);
      } else {
        updated.add(patch);
      }
      return { ...prev, activePatches: updated };
    });
  }, []);

  // 清除所有篩選
  const clearFilters = useCallback(() => {
    setFilterState(createDefaultFilterState());
  }, []);

  // 儲存至雲端
  const handleSaveToCloud = async () => {
    if (!isLoggedIn) {
      await login();
      return;
    }

    // 轉換資料格式
    const ownedItemsForCloud: Record<string, number[]> = {};
    for (const [key, set] of Object.entries(ownedItems)) {
      ownedItemsForCloud[key] = [...set];
    }

    const success = await saveToCloud(ownedItemsForCloud, [...wishlist]);
    if (success) {
      alert('已成功儲存至雲端！');
    } else {
      alert('儲存失敗，請稍後再試');
    }
  };

  // 計算擁有數量
  const ownedCount = ownedItems[currentCollection]?.size || 0;
  const totalCount = currentCollectionData?.Items.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* 標題列 */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">FFXIV 收集追蹤</h1>
            
            {/* 搜尋框 */}
            <div className="flex-1 max-w-md mx-4">
              <input
                type="text"
                placeholder="搜尋收藏品..."
                value={filterState.searchQuery}
                onChange={(e) => setFilterState((prev) => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
              />
            </div>

            {/* 登入/同步按鈕 */}
            <div className="flex items-center gap-2">
              {isConfigured && (
                <>
                  {isLoggedIn ? (
                    <>
                      <button
                        onClick={handleSaveToCloud}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSyncing ? '同步中...' : '☁️ 儲存至雲端'}
                      </button>
                      <button
                        onClick={logout}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400"
                      >
                        登出
                      </button>
                      {user?.photoURL && (
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                      )}
                    </>
                  ) : (
                    <button
                      onClick={login}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                    >
                      🔑 使用 Google 登入
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 收集類型分頁 */}
      <nav className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {collectionIndex.map((collection) => (
              <button
                key={collection.name}
                onClick={() => setCurrentCollection(collection.name)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  currentCollection === collection.name
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {COLLECTION_NAMES[collection.name] || collection.name}
                <span className="ml-1.5 text-xs opacity-60">{collection.count}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* 左側篩選欄 */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-40">
              {/* 擁有狀態篩選 */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">擁有狀態</h3>
                <div className="space-y-2">
                  {(['all', 'owned', 'not-owned'] as const).map((value) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="ownership"
                        checked={filterState.ownershipFilter === value}
                        onChange={() => setFilterState((prev) => ({ ...prev, ownershipFilter: value }))}
                        className="w-4 h-4"
                      />
                      <span>{value === 'all' ? '全部' : value === 'owned' ? '已擁有' : '未擁有'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 來源篩選 */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">來源篩選</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {Object.entries(SOURCE_CATEGORIES).map(([key, info]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        filterState.activeCategories.has(key)
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filterState.activeCategories.has(key)}
                        onChange={() => toggleCategory(key)}
                        className="w-4 h-4"
                      />
                      <img
                        src={getIconUrl(info.iconId)}
                        alt=""
                        className="w-5 h-5"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <span className="text-sm">{info.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 版本篩選 */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">版本篩選</h3>
                <div className="flex flex-wrap gap-2">
                  {PATCH_VERSIONS.map((patch) => (
                    <button
                      key={patch.label}
                      onClick={() => togglePatch(patch.label)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        filterState.activePatches.has(patch.label)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {patch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 清除篩選 */}
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-red-500 border border-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                清除所有篩選
              </button>
            </div>
          </aside>

          {/* 主內容區 */}
          <main className="flex-1">
            {/* 進度顯示 */}
            <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">收集進度</span>
                <span className="text-blue-600 dark:text-blue-400">
                  顯示 {filteredItems.length} / {totalCount} 項（已擁有 {ownedCount} 項）
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${totalCount > 0 ? (ownedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 物品格子 */}
            {isSwitching && filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p>載入 {COLLECTION_NAMES[currentCollection] || currentCollection} 中…</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>找不到符合條件的收藏品</p>
                <p className="text-sm mt-2">嘗試調整篩選條件或搜尋關鍵字</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {displayedItems.map((item) => {
                  const isOwned = ownedItems[currentCollection]?.has(item.Id) ?? false;
                  const isWishlisted = wishlist.has(`${currentCollection}:${item.Id}`);

                  return (
                    <div
                      key={item.Id}
                      className={`relative bg-white dark:bg-gray-800 rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-lg ${
                        isOwned
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* 擁有標記 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOwned(item.Id);
                        }}
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          isOwned
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {isOwned ? '✓' : ''}
                      </button>

                      {/* 願望清單標記 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(item.Id);
                        }}
                        className={`absolute top-2 left-2 w-6 h-6 flex items-center justify-center transition-colors ${
                          isWishlisted ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                        }`}
                      >
                        {isWishlisted ? '★' : '☆'}
                      </button>

                      {/* 圖示 */}
                      <div className="flex justify-center mb-2 mt-4">
                        <img
                          src={item.IconUrl}
                          alt={item.Name}
                          className="w-16 h-16 object-contain"
                          onError={(e) => (e.currentTarget.src = 'https://xivapi.com/i/000000/000000.png')}
                        />
                      </div>

                      {/* 名稱 */}
                      <p className="text-center text-sm font-medium truncate" title={item.Name}>
                        {item.Name}
                      </p>

                      {/* 版本 */}
                      <p className="text-center text-xs text-gray-500 mt-1">
                        {item.DisplayPatch}
                      </p>
                    </div>
                  );
                })}
                </div>
                
                {/* 載入更多指示器 */}
                {hasMore && (
                  <div ref={loadMoreRef} className="text-center py-8">
                    <div className="inline-flex items-center gap-2 text-gray-500">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <span>載入更多... ({displayedItems.length} / {filteredItems.length})</span>
                    </div>
                  </div>
                )}
                
                {/* 已顯示全部 */}
                {!hasMore && filteredItems.length > PAGE_SIZE && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    已顯示全部 {filteredItems.length} 項
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* 物品詳情 Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* 標題 */}
              <div className="flex items-start gap-4 mb-4">
                <img
                  src={selectedItem.IconUrl}
                  alt={selectedItem.Name}
                  className="w-20 h-20 object-contain"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{selectedItem.Name}</h2>
                  <p className="text-gray-500">版本 {selectedItem.DisplayPatch}</p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* 描述 */}
              {selectedItem.Description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedItem.Description}
                </p>
              )}

              {/* 取得來源 */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">取得來源</h3>
                {selectedItem.Sources && selectedItem.Sources.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItem.Sources.map((source, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
                      >
                        <img
                          src={getIconUrl(SOURCE_CATEGORIES[source.Categories?.[0] || 'Other']?.iconId || 60414)}
                          alt=""
                          className="w-8 h-8"
                        />
                        <div>
                          <p className="font-medium">{source.Name}</p>
                          <p className="text-sm text-gray-500">
                            {SOURCE_CATEGORIES[source.Categories?.[0] || 'Other']?.name || source.Type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">無來源資料</p>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleOwned(selectedItem.Id)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                    ownedItems[currentCollection]?.has(selectedItem.Id)
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {ownedItems[currentCollection]?.has(selectedItem.Id)
                    ? '✓ 已擁有 (點擊取消)'
                    : '標記為已擁有'}
                </button>
                <button
                  onClick={() => toggleWishlist(selectedItem.Id)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    wishlist.has(`${currentCollection}:${selectedItem.Id}`)
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {wishlist.has(`${currentCollection}:${selectedItem.Id}`) ? '★' : '☆'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
