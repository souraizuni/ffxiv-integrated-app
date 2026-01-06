'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Item } from '@/types';
import { ItemSourceInfo, ItemSourceBadges } from './item-source-info';

interface ItemCardProps {
  item: Item;
  isCollected?: boolean;
  showPrice?: boolean;
  price?: number;
  showSources?: boolean;
  onToggleCollect?: (itemId: number) => void;
  onClick?: (item: Item) => void;
}

export function ItemCard({
  item,
  isCollected = false,
  showPrice = false,
  price,
  showSources = false,
  onToggleCollect,
  onClick,
}: ItemCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);

  return (
    <div
      className={`
        relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
        ${isCollected
          ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
          : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700'
        }
      `}
      onClick={() => onClick?.(item)}
    >
      {/* 物品圖標 */}
      <div className="relative w-10 h-10 flex-shrink-0">
        {!imageError ? (
          <Image
            src={item.iconUrl}
            alt={item.name}
            fill
            className="object-contain"
            onError={() => setImageError(true)}
            unoptimized // 使用外部圖片
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
            <span className="text-xs text-gray-400">?</span>
          </div>
        )}
      </div>

      {/* 物品資訊 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate">
          {item.name_zh || item.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {item.categoryName}
          {item.itemLevel > 0 && ` · IL ${item.itemLevel}`}
        </p>
        {/* 來源標籤 */}
        {showSources && (
          <div className="mt-1">
            <ItemSourceBadges
              itemId={item.id}
              onClick={() => setShowSourceModal(true)}
            />
          </div>
        )}
      </div>

      {/* 價格顯示 */}
      {showPrice && price !== undefined && (
        <div className="text-right">
          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {price.toLocaleString()} Gil
          </span>
        </div>
      )}

      {/* 收集按鈕 */}
      {onToggleCollect && (
        <button
          className={`
            w-8 h-8 rounded-full flex items-center justify-center transition-colors
            ${isCollected
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }
          `}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollect(item.id);
          }}
          aria-label={isCollected ? '取消收集' : '標記為已收集'}
        >
          {isCollected ? '✓' : '+'}
        </button>
      )}

      {/* 已收集標記 */}
      {isCollected && !onToggleCollect && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}

      {/* 來源詳情彈出視窗 */}
      {showSourceModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowSourceModal(false);
          }}
        >
          <div
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <ItemSourceInfo
              itemId={item.id}
              itemName={item.name_zh || item.name}
              onClose={() => setShowSourceModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 物品卡片載入狀態
export function ItemCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}
