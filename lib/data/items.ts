// ============================================
// 本地物品資料庫
// ============================================
// 取代先前 import tw-items.json（2.1 MB 進 bundle）+ 逐筆打 XIVAPI v2 的做法。
// 資料由 scripts/build-data/build-items.mjs 產生。

import { loadPack, peekPack } from './msgpack-loader';

const PACK = 'items.msgpack';

// 與 build-items.mjs 的旗標定義必須一致
const FLAG_UNTRADABLE = 1;
const FLAG_COLLECTABLE = 2;
const FLAG_MARKETABLE = 4;
const FLAG_CAN_BE_HQ = 8;

/** msgpack 中的原始紀錄（短鍵是為了壓縮體積） */
interface RawItem {
  n: string;  // 繁中名稱
  e: string;  // 英文名稱
  c: number;  // icon id
  l: number;  // item level
  s: number;  // stack size
  u: number;  // ItemUICategory id
  f: number;  // 旗標
}

interface ItemsPack {
  v: number;
  generatedAt: string;
  game: { schema: string; version: string };
  items: Record<string, RawItem>;
  categories: Record<string, string>;
}

export interface GameItem {
  id: number;
  name: string;       // 顯示名稱：有繁中用繁中，否則用英文
  nameTw: string;
  nameEn: string;
  iconId: number;
  iconUrl: string;
  itemLevel: number;
  stackSize: number;
  categoryId: number;
  categoryName: string;
  isUntradable: boolean;
  isCollectable: boolean;
  isMarketable: boolean;
  /** 能否以 HQ 製作／取得（求解器的 HQ 材料勾選依賴這個欄位） */
  canBeHQ: boolean;
}

/**
 * 由 icon id 組出圖示網址。
 * XIVAPI 的圖示路徑規則：id 20803 → ui/icon/020000/020803.tex
 * 這也是為什麼資料檔只存數字就夠了。
 */
export function iconUrlFromId(iconId: number, highRes = true): string {
  if (!iconId) return '';

  const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
  const file = String(iconId).padStart(6, '0');
  const path = `ui/icon/${folder}/${file}${highRes ? '_hr1' : ''}.tex`;

  return `https://v2.xivapi.com/api/asset?path=${encodeURIComponent(path)}&format=png`;
}

function toGameItem(id: number, raw: RawItem, categories: Record<string, string>): GameItem {
  return {
    id,
    name: raw.n || raw.e || `物品 #${id}`,
    nameTw: raw.n,
    nameEn: raw.e,
    iconId: raw.c,
    iconUrl: iconUrlFromId(raw.c),
    itemLevel: raw.l,
    stackSize: raw.s,
    categoryId: raw.u,
    categoryName: categories[String(raw.u)] || '',
    isUntradable: (raw.f & FLAG_UNTRADABLE) !== 0,
    isCollectable: (raw.f & FLAG_COLLECTABLE) !== 0,
    isMarketable: (raw.f & FLAG_MARKETABLE) !== 0,
    canBeHQ: (raw.f & FLAG_CAN_BE_HQ) !== 0,
  };
}

export function loadItemsPack(): Promise<ItemsPack> {
  return loadPack<ItemsPack>(PACK);
}

/** 取得單一物品；查不到回傳 null */
export async function getItem(itemId: number): Promise<GameItem | null> {
  const pack = await loadItemsPack();
  const raw = pack.items[String(itemId)];
  return raw ? toGameItem(itemId, raw, pack.categories) : null;
}

/** 批次取得多個物品 */
export async function getItems(itemIds: number[]): Promise<Map<number, GameItem>> {
  const pack = await loadItemsPack();
  const result = new Map<number, GameItem>();

  for (const id of itemIds) {
    const raw = pack.items[String(id)];
    if (raw) result.set(id, toGameItem(id, raw, pack.categories));
  }

  return result;
}

/** 同步版本：資料尚未載入時回傳 null，不觸發請求 */
export function peekItem(itemId: number): GameItem | null {
  const pack = peekPack<ItemsPack>(PACK);
  if (!pack) return null;

  const raw = pack.items[String(itemId)];
  return raw ? toGameItem(itemId, raw, pack.categories) : null;
}

export interface ItemSearchOptions {
  limit?: number;
  /** 只回傳可在市場交易的物品（市場頁使用） */
  marketableOnly?: boolean;
}

/**
 * 依名稱搜尋物品。中英文都走同一份本地索引，完全離線。
 * 排序：完全相符 > 前綴相符 > 部分相符，同組內名稱短者優先。
 */
export async function searchItems(
  query: string,
  options: ItemSearchOptions = {}
): Promise<GameItem[]> {
  const { limit = 20, marketableOnly = false } = options;

  const trimmed = query.trim();
  if (!trimmed) return [];

  const pack = await loadItemsPack();
  const needle = trimmed.toLowerCase();

  const exact: GameItem[] = [];
  const prefix: GameItem[] = [];
  const partial: GameItem[] = [];

  for (const [idStr, raw] of Object.entries(pack.items)) {
    if (marketableOnly && (raw.f & FLAG_MARKETABLE) === 0) continue;

    const tw = raw.n;
    const en = raw.e.toLowerCase();

    let bucket: GameItem[] | null = null;
    if (tw === trimmed || en === needle) {
      bucket = exact;
    } else if (tw.startsWith(trimmed) || en.startsWith(needle)) {
      bucket = prefix;
    } else if (tw.includes(trimmed) || en.includes(needle)) {
      bucket = partial;
    }

    if (bucket) {
      bucket.push(toGameItem(Number(idStr), raw, pack.categories));
    }
  }

  const byNameLength = (a: GameItem, b: GameItem) => a.name.length - b.name.length;
  prefix.sort(byNameLength);
  partial.sort(byNameLength);

  return [...exact, ...prefix, ...partial].slice(0, limit);
}

/** 以完全相符的名稱反查物品 ID */
export async function getItemIdByName(name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const pack = await loadItemsPack();
  const needle = trimmed.toLowerCase();

  for (const [idStr, raw] of Object.entries(pack.items)) {
    if (raw.n === trimmed || raw.e.toLowerCase() === needle) {
      return Number(idStr);
    }
  }

  return null;
}

/** 資料檔對應的遊戲版本，用於在畫面上標示資料新舊 */
export async function getGameDataVersion(): Promise<{ generatedAt: string; version: string }> {
  const pack = await loadItemsPack();
  return { generatedAt: pack.generatedAt, version: pack.game?.version || 'unknown' };
}

/** 依分類批次取得物品（市場掃描器用） */
export interface CategoryQuery {
  /** ItemUICategory row id 清單 */
  categoryIds: number[];
  /** 物品等級上限；未指定則不限 */
  maxItemLevel?: number;
  /** 只要可在市場交易的物品 */
  marketableOnly?: boolean;
}

/**
 * 依分類 + 物品等級取出物品。
 *
 * 這取代了先前對 Cafemaker 的分頁爬取
 * （每個分類最多 20 頁 × 250 筆、併發 3，且該服務已停止運作）。
 * 本地一次過濾即可完成，不需要任何網路請求。
 */
export async function getItemsByCategories(query: CategoryQuery): Promise<GameItem[]> {
  const { categoryIds, maxItemLevel, marketableOnly = false } = query;
  if (categoryIds.length === 0) return [];

  const pack = await loadItemsPack();
  const wanted = new Set(categoryIds);
  const result: GameItem[] = [];

  for (const [idStr, raw] of Object.entries(pack.items)) {
    if (!wanted.has(raw.u)) continue;
    if (maxItemLevel !== undefined && raw.l > maxItemLevel) continue;
    if (marketableOnly && (raw.f & FLAG_MARKETABLE) === 0) continue;

    result.push(toGameItem(Number(idStr), raw, pack.categories));
  }

  return result;
}

/** 取得分類 id → 英文名稱對照（繁中名稱見 lib/i18n/item-categories.ts） */
export async function getCategoryNames(): Promise<Record<string, string>> {
  const pack = await loadItemsPack();
  return pack.categories;
}

/**
 * 找出與指定物品相關的物品：同分類、物品等級相近。
 * 用於市場查詢頁的「相關物品」，讓使用者能橫向比較同級品的價差。
 */
export async function getRelatedItems(
  itemId: number,
  limit = 12
): Promise<GameItem[]> {
  const pack = await loadItemsPack();
  const raw = pack.items[String(itemId)];
  if (!raw) return [];

  const candidates: Array<{ item: GameItem; distance: number }> = [];

  for (const [idStr, other] of Object.entries(pack.items)) {
    const id = Number(idStr);
    if (id === itemId) continue;
    if (other.u !== raw.u) continue;
    // 只列可交易的，否則點進去也查不到行情
    if ((other.f & FLAG_MARKETABLE) === 0) continue;

    candidates.push({
      item: toGameItem(id, other, pack.categories),
      distance: Math.abs(other.l - raw.l),
    });
  }

  // 等級最接近的優先；同距離時以等級高者優先（通常是玩家更關心的版本）
  candidates.sort((a, b) => a.distance - b.distance || b.item.itemLevel - a.item.itemLevel);

  return candidates.slice(0, limit).map((c) => c.item);
}
