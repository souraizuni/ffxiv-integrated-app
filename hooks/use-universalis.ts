// ============================================
// Universalis 市場資料 Hooks
// ============================================

import useSWR from 'swr';
import type { MarketData, MarketListing, MarketHistoryEntry } from '@/types';

const UNIVERSALIS_BASE = 'https://universalis.app/api/v2';

// ---- Fetcher 函式 ----
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Universalis 請求失敗: ${res.status}`);
  }
  return res.json();
}

// ---- 取得單一物品市場資料 ----
export function useMarketData(
  worldOrDC: string | null,
  itemId: number | null
) {
  const url =
    worldOrDC && itemId
      ? `${UNIVERSALIS_BASE}/${worldOrDC}/${itemId}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<UniversalisResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 秒內不重複請求
      refreshInterval: 60000, // 每分鐘自動更新
    }
  );

  const marketData: MarketData | null = data
    ? {
        itemId: data.itemID,
        worldId: data.worldID,
        dcName: data.dcName,
        listings: data.listings.map(parseListingResponse),
        recentHistory: data.recentHistory.map(parseHistoryResponse),
        currentAveragePrice: data.currentAveragePrice,
        currentAveragePriceNQ: data.currentAveragePriceNQ,
        currentAveragePriceHQ: data.currentAveragePriceHQ,
        minPriceNQ: data.minPriceNQ,
        minPriceHQ: data.minPriceHQ,
        lastUploadTime: data.lastUploadTime,
      }
    : null;

  return {
    data: marketData,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ---- 取得多個物品市場資料 ----
export function useMultiMarketData(
  worldOrDC: string | null,
  itemIds: number[]
) {
  const idsString = itemIds.slice(0, 100).join(','); // Universalis 最多 100 個
  const url =
    worldOrDC && itemIds.length > 0
      ? `${UNIVERSALIS_BASE}/${worldOrDC}/${idsString}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<UniversalisMultiResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const marketDataMap = new Map<number, MarketData>();
  
  if (data?.items) {
    for (const [itemId, itemData] of Object.entries(data.items)) {
      marketDataMap.set(Number(itemId), {
        itemId: Number(itemId),
        worldId: itemData.worldID,
        dcName: itemData.dcName,
        listings: itemData.listings?.map(parseListingResponse) || [],
        recentHistory: itemData.recentHistory?.map(parseHistoryResponse) || [],
        currentAveragePrice: itemData.currentAveragePrice || 0,
        currentAveragePriceNQ: itemData.currentAveragePriceNQ || 0,
        currentAveragePriceHQ: itemData.currentAveragePriceHQ || 0,
        minPriceNQ: itemData.minPriceNQ || 0,
        minPriceHQ: itemData.minPriceHQ || 0,
        lastUploadTime: itemData.lastUploadTime || 0,
      });
    }
  }

  return {
    dataMap: marketDataMap,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ---- 取得市場歷史 ----
export function useMarketHistory(
  worldOrDC: string | null,
  itemId: number | null,
  entries: number = 100
) {
  const url =
    worldOrDC && itemId
      ? `${UNIVERSALIS_BASE}/history/${worldOrDC}/${itemId}?entries=${entries}`
      : null;

  const { data, error, isLoading } = useSWR<UniversalisHistoryResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    history: data?.entries?.map(parseHistoryResponse) || [],
    isLoading,
    error,
  };
}

// ---- 取得伺服器列表 ----
export function useWorlds() {
  const { data, error, isLoading } = useSWR<WorldsResponse>(
    `${UNIVERSALIS_BASE}/worlds`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 3600000, // 1 小時
    }
  );

  return {
    worlds: data || [],
    isLoading,
    error,
  };
}

// ---- 取得 Data Center 列表 ----
export function useDataCenters() {
  const { data, error, isLoading } = useSWR<string[]>(
    `${UNIVERSALIS_BASE}/data-centers`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 3600000,
    }
  );

  return {
    dataCenters: data || [],
    isLoading,
    error,
  };
}

// ---- 解析函式 ----
function parseListingResponse(listing: UniversalisListing): MarketListing {
  return {
    listingId: listing.listingID,
    itemId: 0, // 需要從外部取得
    worldId: listing.worldID || 0,
    worldName: listing.worldName || '',
    pricePerUnit: listing.pricePerUnit,
    quantity: listing.quantity,
    total: listing.total,
    isHQ: listing.hq,
    retainerName: listing.retainerName,
    lastReviewTime: listing.lastReviewTime,
  };
}

function parseHistoryResponse(entry: UniversalisHistoryEntry): MarketHistoryEntry {
  return {
    pricePerUnit: entry.pricePerUnit,
    quantity: entry.quantity,
    timestamp: entry.timestamp,
    isHQ: entry.hq,
    buyerName: entry.buyerName,
  };
}

// ---- Universalis API 類型 ----
interface UniversalisResponse {
  itemID: number;
  worldID?: number;
  dcName?: string;
  listings: UniversalisListing[];
  recentHistory: UniversalisHistoryEntry[];
  currentAveragePrice: number;
  currentAveragePriceNQ: number;
  currentAveragePriceHQ: number;
  minPriceNQ: number;
  minPriceHQ: number;
  lastUploadTime: number;
}

interface UniversalisMultiResponse {
  items: Record<string, UniversalisResponse>;
}

interface UniversalisHistoryResponse {
  itemID: number;
  entries: UniversalisHistoryEntry[];
}

interface UniversalisListing {
  listingID: string;
  worldID?: number;
  worldName?: string;
  pricePerUnit: number;
  quantity: number;
  total: number;
  hq: boolean;
  retainerName: string;
  lastReviewTime: number;
}

interface UniversalisHistoryEntry {
  pricePerUnit: number;
  quantity: number;
  timestamp: number;
  hq: boolean;
  buyerName?: string;
}

interface WorldsResponse extends Array<{
  id: number;
  name: string;
}> {}
