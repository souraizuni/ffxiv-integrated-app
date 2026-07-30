// ============================================
// XIVAPI v2 資料存取層（批次 + 快取）
// ============================================
// 背景：原本的中文資料來源 Cafemaker（cafemaker.wakingsands.com）已停止服務，
// 所有請求回傳 HTTP 530 / Cloudflare error 1016，導致物品名稱、圖示、配方查詢
// 全部失敗，材料樹與材料清單無法建立。
//
// 本模組改用仍在服務中的 XIVAPI v2 取得「圖示、英文名稱、配方 ID」，
// 中文名稱則由本地 tw-items.json 與 yyyy.games 提供（見 lib/i18n、lib/recipe-datasource）。
//
// 為避免材料樹遞歸時產生大量單筆請求，這裡以微批次（micro-batch）合併同一個
// event loop 週期內的查詢，一次請求最多帶 50 筆 row。

const XIVAPI_V2_BASE = 'https://v2.xivapi.com/api';

// 微批次收集視窗（毫秒）。材料樹遞歸的請求會落在同一個視窗內合併。
const BATCH_WINDOW_MS = 12;
// 單次 /sheet 請求最多帶入的 row 數（避免 URL 過長）
const MAX_ROWS_PER_REQUEST = 50;
// 單次 /search 請求最多帶入的 item 數
const MAX_SEARCH_ITEMS_PER_REQUEST = 20;

// ---- 物品 row ----
export interface XivItemRow {
  rowId: number;
  name: string;
  iconPath: string;
  iconPathHr: string;
  itemLevel: number;
  stackSize: number;
  isUntradable: boolean;
  categoryId: number;
  categoryName: string;
}

/**
 * 由 XIVAPI v2 的圖示路徑組出可直接放進 <img src> 的 URL
 */
export function getAssetUrl(iconPath: string): string {
  if (!iconPath) return '';
  return `${XIVAPI_V2_BASE}/asset?path=${encodeURIComponent(iconPath)}&format=png`;
}

/**
 * 取得物品圖示 URL（優先高解析度）
 */
export function getItemIconUrl(row: XivItemRow | null | undefined): string {
  if (!row) return '';
  return getAssetUrl(row.iconPathHr || row.iconPath);
}

// ---- 微批次載入器 ----
interface Batcher<T> {
  load(key: number): Promise<T | null>;
  loadMany(keys: number[]): Promise<Map<number, T | null>>;
  peek(key: number): T | null | undefined;
  clear(): void;
}

function createBatcher<T>(
  loader: (keys: number[]) => Promise<Map<number, T | null>>,
  chunkSize: number
): Batcher<T> {
  const cache = new Map<number, T | null>();
  let pendingKeys = new Set<number>();
  let pendingBatch: Promise<Map<number, T | null>> | null = null;

  // 逐塊送出請求；任何一塊失敗只讓該塊的 key 變成 null，不影響其他塊
  async function flush(keys: number[]): Promise<Map<number, T | null>> {
    const result = new Map<number, T | null>();

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      try {
        const loaded = await loader(chunk);
        for (const key of chunk) {
          result.set(key, loaded.get(key) ?? null);
        }
      } catch (error) {
        console.warn('[xivapi-v2] 批次查詢失敗，該批以 null 處理:', error);
        for (const key of chunk) {
          result.set(key, null);
        }
      }
    }

    return result;
  }

  function schedule(): Promise<Map<number, T | null>> {
    if (pendingBatch) return pendingBatch;

    pendingBatch = new Promise<Map<number, T | null>>((resolve) => {
      setTimeout(() => {
        const keys = [...pendingKeys];
        pendingKeys = new Set();
        pendingBatch = null;
        void flush(keys).then(resolve);
      }, BATCH_WINDOW_MS);
    });

    return pendingBatch;
  }

  function load(key: number): Promise<T | null> {
    if (cache.has(key)) {
      return Promise.resolve(cache.get(key) ?? null);
    }

    pendingKeys.add(key);
    const batch = schedule();

    return batch.then((map) => {
      const value = map.get(key) ?? null;
      cache.set(key, value);
      return value;
    });
  }

  async function loadMany(keys: number[]): Promise<Map<number, T | null>> {
    const unique = [...new Set(keys)];
    const values = await Promise.all(unique.map((key) => load(key)));
    const result = new Map<number, T | null>();
    unique.forEach((key, index) => result.set(key, values[index]));
    return result;
  }

  return {
    load,
    loadMany,
    peek: (key) => cache.get(key),
    clear: () => cache.clear(),
  };
}

// ---- 物品 row 載入 ----
const ITEM_FIELDS = 'Name,Icon,StackSize,IsUntradable,ItemUICategory.Name,LevelItem@as(raw)';

interface RawItemRow {
  row_id: number;
  fields: {
    Name?: string;
    Icon?: { id: number; path: string; path_hr1: string };
    StackSize?: number;
    IsUntradable?: boolean;
    ItemUICategory?: { row_id?: number; value?: number; fields?: { Name?: string } };
    'LevelItem@as(raw)'?: number;
  };
}

function parseItemRow(raw: RawItemRow): XivItemRow {
  const fields = raw.fields || {};
  return {
    rowId: raw.row_id,
    name: fields.Name || '',
    iconPath: fields.Icon?.path || '',
    iconPathHr: fields.Icon?.path_hr1 || '',
    itemLevel: fields['LevelItem@as(raw)'] ?? 1,
    stackSize: fields.StackSize ?? 1,
    isUntradable: fields.IsUntradable === true,
    categoryId: fields.ItemUICategory?.row_id ?? fields.ItemUICategory?.value ?? 0,
    categoryName: fields.ItemUICategory?.fields?.Name || '',
  };
}

async function requestItemRows(ids: number[]): Promise<Map<number, XivItemRow | null>> {
  const url =
    `${XIVAPI_V2_BASE}/sheet/Item` +
    `?rows=${ids.join(',')}` +
    `&fields=${encodeURIComponent(ITEM_FIELDS)}`;

  const res = await fetch(url);

  // XIVAPI v2 只要批次中有一個不存在的 row 就整批 404，
  // 此時退回逐筆查詢，避免一顆壞掉的 ID 讓整棵材料樹失去名稱與圖示。
  if (res.status === 404 && ids.length > 1) {
    const result = new Map<number, XivItemRow | null>();
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const single = await requestItemRows([id]);
          return single.get(id) ?? null;
        } catch {
          return null;
        }
      })
    );
    ids.forEach((id, index) => result.set(id, rows[index]));
    return result;
  }

  if (!res.ok) {
    throw new Error(`XIVAPI v2 物品查詢失敗: ${res.status}`);
  }

  const json = (await res.json()) as { rows?: RawItemRow[] };
  const result = new Map<number, XivItemRow | null>();
  for (const raw of json.rows || []) {
    result.set(raw.row_id, parseItemRow(raw));
  }
  return result;
}

const itemRowBatcher = createBatcher<XivItemRow>(requestItemRows, MAX_ROWS_PER_REQUEST);

/** 取得單一物品的 XIVAPI v2 row（自動批次 + 快取） */
export function getItemRow(itemId: number): Promise<XivItemRow | null> {
  return itemRowBatcher.load(itemId);
}

/** 批次取得多個物品的 XIVAPI v2 row */
export function getItemRows(itemIds: number[]): Promise<Map<number, XivItemRow | null>> {
  return itemRowBatcher.loadMany(itemIds);
}

/** 讀取已快取的 row（不觸發請求） */
export function peekItemRow(itemId: number): XivItemRow | null | undefined {
  return itemRowBatcher.peek(itemId);
}

// ---- 配方 ID 查詢 ----
interface RawSearchResult {
  row_id: number;
  fields: { 'ItemResult@as(raw)'?: number };
}

/**
 * 以 ItemResult 反查配方 row id。
 * XIVAPI v2 的查詢語法中，空白分隔代表 OR，因此可一次查多個物品。
 */
async function requestRecipeRowIds(itemIds: number[]): Promise<Map<number, number | null>> {
  const query = itemIds.map((id) => `ItemResult=${id}`).join(' ');
  const url =
    `${XIVAPI_V2_BASE}/search` +
    `?query=${encodeURIComponent(query)}` +
    `&sheets=Recipe` +
    `&fields=${encodeURIComponent('ItemResult@as(raw)')}` +
    `&limit=${Math.min(500, itemIds.length * 8)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`XIVAPI v2 配方查詢失敗: ${res.status}`);
  }

  const json = (await res.json()) as { results?: RawSearchResult[] };
  const result = new Map<number, number | null>();

  // 同一個物品可能有多個配方（不同職業／版本），取 row id 最小的一筆，
  // 與舊版 Cafemaker 實作的「取第一筆」行為一致。
  for (const entry of json.results || []) {
    const itemId = entry.fields?.['ItemResult@as(raw)'];
    if (typeof itemId !== 'number') continue;
    const existing = result.get(itemId);
    if (existing == null || entry.row_id < existing) {
      result.set(itemId, entry.row_id);
    }
  }

  for (const id of itemIds) {
    if (!result.has(id)) result.set(id, null);
  }

  return result;
}

const recipeIdBatcher = createBatcher<number>(
  requestRecipeRowIds,
  MAX_SEARCH_ITEMS_PER_REQUEST
);

/** 取得某個物品的配方 row id（沒有配方回傳 null） */
export function getRecipeRowId(itemId: number): Promise<number | null> {
  return recipeIdBatcher.load(itemId);
}

/** 批次取得多個物品的配方 row id */
export function getRecipeRowIds(itemIds: number[]): Promise<Map<number, number | null>> {
  return recipeIdBatcher.loadMany(itemIds);
}

// ---- 英文名稱搜尋 ----
export interface XivSearchHit {
  rowId: number;
  name: string;
  iconPath: string;
  iconPathHr: string;
  itemLevel: number;
  categoryName: string;
}

/** 以英文名稱搜尋物品（中文搜尋請改用 lib/i18n 的本地索引） */
export async function searchItemsByName(
  query: string,
  limit: number = 20
): Promise<XivSearchHit[]> {
  const url =
    `${XIVAPI_V2_BASE}/search` +
    `?query=${encodeURIComponent(`Name~"${query}"`)}` +
    `&sheets=Item` +
    `&fields=${encodeURIComponent('Name,Icon,ItemUICategory.Name,LevelItem@as(raw)')}` +
    `&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`XIVAPI v2 搜尋失敗: ${res.status}`);
  }

  const json = (await res.json()) as {
    results?: Array<{ row_id: number; fields: RawItemRow['fields'] }>;
  };

  return (json.results || []).map((entry) => ({
    rowId: entry.row_id,
    name: entry.fields?.Name || '',
    iconPath: entry.fields?.Icon?.path || '',
    iconPathHr: entry.fields?.Icon?.path_hr1 || '',
    itemLevel: entry.fields?.['LevelItem@as(raw)'] ?? 1,
    categoryName: entry.fields?.ItemUICategory?.fields?.Name || '',
  }));
}

/** 清除本模組所有快取（測試 / 手動重新整理用） */
export function clearXivApiCache(): void {
  itemRowBatcher.clear();
  recipeIdBatcher.clear();
}
