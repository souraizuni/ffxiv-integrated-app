// ============================================
// Universalis 市場資料 Hooks & 工具函式
// ============================================

import useSWR from 'swr';
import type { MarketData, MarketListing, MarketHistoryEntry } from '@/types';

const UNIVERSALIS_BASE = 'https://universalis.app/api/v2';

// ============================================
// 伺服器設定相關
// ============================================

export interface DataCenter {
  name: string;
  region: string;
  worlds: number[];
}

export interface World {
  id: number;
  name: string;
}

// 預設伺服器設定
export const DEFAULT_SERVER_CONFIG = {
  dcName: '陸行鳥',
  worldId: 4031,
  worldName: '鳳凰',
};

const SERVER_CONFIG_KEY = 'ffxiv-server-config';

export function loadServerConfig(): { dcName: string; worldId: number; worldName: string } {
  try {
    const raw = localStorage.getItem(SERVER_CONFIG_KEY);
    if (raw) {
      const config = JSON.parse(raw);
      return {
        dcName: config.dcName || DEFAULT_SERVER_CONFIG.dcName,
        worldId: config.worldId || DEFAULT_SERVER_CONFIG.worldId,
        worldName: config.worldName || DEFAULT_SERVER_CONFIG.worldName,
      };
    }
  } catch {}
  return { ...DEFAULT_SERVER_CONFIG };
}

export function saveServerConfig(config: { dcName: string; worldId: number; worldName: string }): void {
  try {
    localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('儲存伺服器設定失敗:', e);
  }
}

// 取得資料中心與伺服器列表（模組層級快取，避免多個元件重複請求）
let _dcWorldsCache: { dataCenters: DataCenter[]; worlds: World[] } | null = null;
let _dcWorldsPromise: Promise<{ dataCenters: DataCenter[]; worlds: World[] }> | null = null;

export async function fetchDataCentersAndWorlds(): Promise<{
  dataCenters: DataCenter[];
  worlds: World[];
}> {
  if (_dcWorldsCache) return _dcWorldsCache;
  // 如果已有進行中的請求，共用同一個 Promise（避免並發重複呼叫）
  if (_dcWorldsPromise) return _dcWorldsPromise;

  _dcWorldsPromise = (async () => {
    const [dcs, worlds] = await Promise.all([
      fetcher<DataCenter[]>(`${UNIVERSALIS_BASE}/data-centers`),
      fetcher<World[]>(`${UNIVERSALIS_BASE}/worlds`),
    ]);
    const result = { dataCenters: dcs, worlds };
    _dcWorldsCache = result;
    _dcWorldsPromise = null;
    return result;
  })();

  return _dcWorldsPromise;
}

// ============================================
// 市場價格批次查詢（命令式，非 Hook）
// ============================================

export interface MarketPriceInfo {
  itemId: number;
  minPriceNQ: number;
  minPriceHQ: number;
  currentAveragePriceNQ: number;
  currentAveragePriceHQ: number;
  currentAveragePrice: number;
  listings: Array<{
    pricePerUnit: number;
    quantity: number;
    total: number;
    hq: boolean;
    worldName?: string;
    retainerName?: string;
  }>;
  lastUploadTime: number;
}

/**
 * 批次查詢多個物品的市場價格
 * @param worldOrDC 伺服器名稱、ID、資料中心名稱或地區名稱
 * @param itemIds 要查詢的物品 ID 陣列
 * @param onProgress 進度回呼
 */
export async function fetchMarketPrices(
  worldOrDC: string | number,
  itemIds: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, MarketPriceInfo>> {
  const result = new Map<number, MarketPriceInfo>();
  if (itemIds.length === 0) return result;

  const uniqueIds = [...new Set(itemIds)];
  const BATCH_SIZE = 100;
  const batches: number[][] = [];

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const idsString = batch.join(',');
    const url = `${UNIVERSALIS_BASE}/${worldOrDC}/${idsString}?listings=20&entries=10`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (batch.length === 1) {
        // 單一物品回應（扁平結構）
        if (data.itemID) {
          result.set(data.itemID, parseMarketPriceInfo(data));
        }
      } else {
        // 多物品回應（巢狀在 items 中）
        if (data.items) {
          for (const [itemId, itemData] of Object.entries(data.items)) {
            result.set(Number(itemId), parseMarketPriceInfo(itemData as Record<string, unknown>));
          }
        }
      }
    } catch (e) {
      console.error(`批次查詢市場價格失敗 (batch ${bi + 1}/${batches.length}):`, e);
    }

    processed += batch.length;
    onProgress?.(processed, uniqueIds.length);

    // 速率限制：批次間等待
    if (bi < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return result;
}

function parseMarketPriceInfo(data: Record<string, unknown>): MarketPriceInfo {
  const listings = Array.isArray(data.listings) ? data.listings : [];
  return {
    itemId: (data.itemID as number) || 0,
    minPriceNQ: (data.minPriceNQ as number) || 0,
    minPriceHQ: (data.minPriceHQ as number) || 0,
    currentAveragePriceNQ: (data.currentAveragePriceNQ as number) || 0,
    currentAveragePriceHQ: (data.currentAveragePriceHQ as number) || 0,
    currentAveragePrice: (data.currentAveragePrice as number) || 0,
    listings: listings.map((l: Record<string, unknown>) => ({
      pricePerUnit: (l.pricePerUnit as number) || 0,
      quantity: (l.quantity as number) || 0,
      total: (l.total as number) || 0,
      hq: (l.hq as boolean) || false,
      worldName: (l.worldName as string) || '',
      retainerName: (l.retainerName as string) || '',
    })),
    lastUploadTime: (data.lastUploadTime as number) || 0,
  };
}

/**
 * 根據需要的數量計算智慧購買成本
 * 從最低價的上架開始累計，直到滿足需求量
 */
export function calculateSmartCost(
  listings: MarketPriceInfo['listings'],
  quantityNeeded: number,
  preferHQ: boolean = false
): { avgUnitCost: number; totalCost: number; listingsUsed: number; fullyAvailable: boolean } {
  if (quantityNeeded <= 0 || listings.length === 0) {
    return { avgUnitCost: 0, totalCost: 0, listingsUsed: 0, fullyAvailable: false };
  }

  // 依品質篩選，然後按價格排序
  const filtered = listings
    .filter((l) => (preferHQ ? l.hq : !l.hq) || listings.every((ll) => ll.hq === l.hq))
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  // 如果沒有符合條件的，用全部
  const sorted = filtered.length > 0
    ? filtered
    : [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  let remaining = quantityNeeded;
  let totalCost = 0;
  let listingsUsed = 0;

  for (const listing of sorted) {
    if (remaining <= 0) break;
    const buyQty = Math.min(remaining, listing.quantity);
    totalCost += buyQty * listing.pricePerUnit;
    remaining -= buyQty;
    listingsUsed++;
  }

  // 如果市場庫存不足，剩餘的用最後一個價格
  const fullyAvailable = remaining <= 0;
  if (remaining > 0 && sorted.length > 0) {
    totalCost += remaining * sorted[sorted.length - 1].pricePerUnit;
  }

  const avgUnitCost = quantityNeeded > 0 ? Math.round(totalCost / quantityNeeded) : 0;
  return { avgUnitCost, totalCost, listingsUsed, fullyAvailable };
}

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
