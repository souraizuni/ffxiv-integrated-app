// ============================================
// 共用 Market Price 查詢 Hook
// 抽取自 material-cost-calculator 和 material-summary 的共用邏輯
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { fetchMarketPrices, type MarketPriceInfo } from '@/hooks/use-universalis';

export type { MarketPriceInfo } from '@/hooks/use-universalis';

/**
 * 共用的市場價格查詢 Hook
 * 管理查詢狀態（載入中、進度、結果、時間戳記）
 * 各元件可在取得 prices 後自行處理特有邏輯
 */
export function useMarketPrices(worldId: number) {
  const [marketPrices, setMarketPrices] = useState<Map<number, MarketPriceInfo>>(new Map());
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /**
   * 查詢指定物品 ID 列表的市場價格
   * @param itemIds 物品 ID 陣列（會自動去重）
   * @returns 查詢結果的 Map<itemId, MarketPriceInfo>
   */
  const fetchPrices = useCallback(async (itemIds: number[]): Promise<Map<number, MarketPriceInfo>> => {
    const uniqueIds = [...new Set(itemIds)].filter(id => id > 0);
    if (uniqueIds.length === 0) return new Map();

    setIsFetchingPrices(true);
    setFetchError(null);
    setFetchProgress({ current: 0, total: uniqueIds.length });

    try {
      const prices = await fetchMarketPrices(worldId, uniqueIds, (current, total) => {
        setFetchProgress({ current, total });
      });
      setMarketPrices(prices);
      setLastFetchTime(new Date());
      return prices;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知錯誤';
      console.error('市場價格查詢失敗:', e);
      setFetchError(`市場價格查詢失敗：${msg}`);
      return new Map();
    } finally {
      setIsFetchingPrices(false);
    }
  }, [worldId]);

  /** 清除錯誤訊息 */
  const clearError = useCallback(() => setFetchError(null), []);

  return {
    marketPrices,
    isFetchingPrices,
    fetchProgress,
    lastFetchTime,
    fetchError,
    fetchPrices,
    clearError,
  };
}
