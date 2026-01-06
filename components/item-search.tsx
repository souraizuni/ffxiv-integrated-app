'use client';

import { useState, useCallback, useEffect } from 'react';
import { useItemSearch } from '@/hooks/use-xivapi';
import type { Item } from '@/types';

// 檢測是否包含中文
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

interface ItemSearchProps {
  onSelect: (item: Item) => void;
  placeholder?: string;
}

export function ItemSearch({
  onSelect,
  placeholder = '搜尋物品...',
}: ItemSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { items, isLoading, error } = useItemSearch(query);

  // 處理點擊外部關閉
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (item: Item) => {
      onSelect(item);
      setQuery('');
      setIsOpen(false);
    },
    [onSelect]
  );

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* 搜尋輸入框 */}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
      />

      {/* 載入指示 */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 搜尋結果 */}
      {isOpen && query.length >= (containsChinese(query) ? 1 : 2) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {error && (
            <div className="p-4 text-red-500">
              搜尋失敗: {error.message}
            </div>
          )}

          {!error && items.length === 0 && !isLoading && (
            <div className="p-4 text-gray-500">
              找不到符合的物品
            </div>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <img
                src={item.iconUrl}
                alt={item.name}
                className="w-8 h-8"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {item.name}
                </div>
                {item.categoryName && (
                  <div className="text-sm text-gray-500">
                    {item.categoryName}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
