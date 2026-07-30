'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { searchItems, getItem, type GameItem } from '@/lib/data/items';
import { ItemMarketDetail } from './item-market-detail';
import {
  subscribeMarketHistory,
  getMarketHistorySnapshot,
  getMarketHistoryServerSnapshot,
  pushMarketHistory,
} from '@/lib/market/item-history';

// ============================================
// 單一物品行情查詢
// ============================================
// 掃描器解的是「批次找商機」，這一塊解的是「我就想看某個物品現在多少錢」——
// 不必先跑一次全分類掃描。搜尋走本地 items.msgpack，完全離線且即時。

interface ItemLookupProps {
  /** 查詢對象：世界名或資料中心名 */
  queryTarget: string;
}

export function ItemLookup({ queryTarget }: ItemLookupProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<GameItem | null>(null);
  const [showResults, setShowResults] = useState(false);

  // 訂閱瀏覽歷史而非在 effect 裡讀 localStorage，避免預渲染與 hydration 不一致
  const history = useSyncExternalStore(
    subscribeMarketHistory,
    getMarketHistorySnapshot,
    getMarketHistoryServerSnapshot
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // 只搜尋可在市場交易的物品；查不到行情的東西列出來只會干擾
  const { data: results = [], isLoading } = useSWR(
    query.trim().length >= 1 ? ['market-item-search', query] : null,
    ([, q]: [string, string]) => searchItems(q, { limit: 20, marketableOnly: true }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const selectItem = useCallback((item: GameItem) => {
    setSelected(item);
    setQuery('');
    setShowResults(false);
    pushMarketHistory({ id: item.id, name: item.name, iconUrl: item.iconUrl });

    // 同步到網址，讓查詢結果可以分享／加書籤
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('item', String(item.id));
      window.history.replaceState(null, '', url.toString());
    } catch {
      // 網址操作失敗不影響主功能
    }
  }, []);

  // 掛載後才讀網址參數：預渲染階段沒有 window，且這裡是非同步取資料，
  // 不會造成 render 期間的同步 setState
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = Number(params.get('item'));
    if (!itemId) return;

    let cancelled = false;
    getItem(itemId).then((item) => {
      if (!cancelled && item) setSelected(item);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 點擊外部關閉搜尋結果
  useEffect(() => {
    if (!showResults) return;

    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showResults]);

  const clearSelection = () => {
    setSelected(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('item');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // 忽略
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative" ref={containerRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="查詢單一物品行情（繁中或英文）…"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {showResults && query.trim() && (
          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {isLoading && results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">搜尋中…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">找不到可在市場交易的物品</p>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.iconUrl} alt="" className="w-8 h-8 shrink-0" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.categoryName}
                      {item.itemLevel > 1 && ` · iLv ${item.itemLevel}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 最近查詢 */}
      {history.length > 0 && !selected && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 shrink-0">最近查詢：</span>
          {history.map((h) => (
            <button
              key={h.id}
              onClick={async () => {
                const item = await getItem(h.id);
                if (item) selectItem(item);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs hover:border-blue-400 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {h.iconUrl && <img src={h.iconUrl} alt="" className="w-4 h-4" loading="lazy" />}
              <span className="truncate max-w-[120px]">{h.name}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ItemMarketDetail
          item={selected}
          queryTarget={queryTarget}
          onClose={clearSelection}
          onSelectItem={selectItem}
        />
      )}
    </div>
  );
}
