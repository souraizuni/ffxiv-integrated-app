'use client';

import { useState, useEffect } from 'react';
import { ItemCard, ItemSearch, Sidebar } from '@/components';
import { useLocalCollectedItems } from '@/hooks/use-collection';
import { useItem } from '@/hooks/use-xivapi';
import type { Item } from '@/types';

// 收集類別定義
const collectionCategories = [
  { id: 'mounts', name: '坐騎', icon: '🐎' },
  { id: 'minions', name: '寵物', icon: '🐾' },
  { id: 'glamour', name: '幻化', icon: '👗' },
  { id: 'orchestrion', name: '管弦樂譜', icon: '🎵' },
  { id: 'emotes', name: '表情', icon: '😄' },
  { id: 'hairstyles', name: '髮型', icon: '💇' },
];

export default function CollectionPage() {
  const [selectedCategory, setSelectedCategory] = useState('mounts');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const { items, toggleItem, isCollected } = useLocalCollectedItems();

  // 示範用的物品列表（實際應從 API 獲取）
  const [categoryItems, setCategoryItems] = useState<number[]>([]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">收集追蹤</h1>

      {/* 類別選擇 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {collectionCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${selectedCategory === category.id
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
              }
            `}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      {/* 搜尋 */}
      <div className="mb-8">
        <ItemSearch
          onSelect={(item) => setSelectedItemId(item.id)}
          placeholder="搜尋物品以加入收集..."
        />
      </div>

      {/* 收集進度 */}
      <div className="mb-8 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">收集進度</span>
          <span className="text-blue-600 dark:text-blue-400">
            {items.length} 項已收集
          </span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, items.length)}%` }}
          />
        </div>
      </div>

      {/* 已收集物品 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">已收集的物品</h2>
        
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>尚未收集任何物品</p>
            <p className="text-sm mt-2">使用上方搜尋框開始追蹤您的收集</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((itemId) => (
              <CollectedItemCard
                key={itemId}
                itemId={itemId}
                onRemove={() => toggleItem(itemId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 物品詳情側邊欄 */}
      <Sidebar
        isOpen={selectedItemId !== null}
        onClose={() => setSelectedItemId(null)}
        title="物品詳情"
      >
        {selectedItemId && (
          <ItemDetailPanel
            itemId={selectedItemId}
            isCollected={isCollected(selectedItemId)}
            onToggleCollect={() => {
              toggleItem(selectedItemId);
            }}
          />
        )}
      </Sidebar>
    </div>
  );
}

// 已收集物品卡片
function CollectedItemCard({
  itemId,
  onRemove,
}: {
  itemId: number;
  onRemove: () => void;
}) {
  const { item, isLoading } = useItem(itemId);

  if (isLoading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <ItemCard
      item={item}
      isCollected={true}
      onToggleCollect={onRemove}
    />
  );
}

// 物品詳情面板
function ItemDetailPanel({
  itemId,
  isCollected,
  onToggleCollect,
}: {
  itemId: number;
  isCollected: boolean;
  onToggleCollect: () => void;
}) {
  const { item, isLoading } = useItem(itemId);

  if (isLoading) {
    return <div className="animate-pulse">載入中...</div>;
  }

  if (!item) {
    return <div className="text-red-500">無法載入物品資訊</div>;
  }

  return (
    <div className="space-y-6">
      {/* 物品基本資訊 */}
      <div className="flex items-start gap-4">
        <img
          src={item.iconUrl}
          alt={item.name}
          className="w-16 h-16"
        />
        <div>
          <h3 className="text-xl font-bold">{item.name_zh || item.name}</h3>
          <p className="text-gray-500">{item.categoryName}</p>
          {item.itemLevel > 0 && (
            <p className="text-sm text-gray-400">物品等級 {item.itemLevel}</p>
          )}
        </div>
      </div>

      {/* 描述 */}
      {item.description && (
        <div className="prose dark:prose-invert">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {item.description}
          </p>
        </div>
      )}

      {/* 收集按鈕 */}
      <button
        onClick={onToggleCollect}
        className={`
          w-full py-3 rounded-lg font-medium transition-colors
          ${isCollected
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-blue-500 text-white hover:bg-blue-600'
          }
        `}
      >
        {isCollected ? '✓ 已收集 (點擊取消)' : '標記為已收集'}
      </button>
    </div>
  );
}
