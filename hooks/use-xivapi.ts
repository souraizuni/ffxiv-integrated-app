// ============================================
// 物品 / 配方資料 Hooks
// ============================================
// 資料來源沿革：
//   舊：Cafemaker（cafemaker.wakingsands.com）—— 已停止服務，固定回 HTTP 530 /
//       Cloudflare error 1016。因為 fetchItem 只走這個來源、失敗即 throw，
//       而材料樹是 Promise.all 遞歸建構的（任一節點拋錯整棵樹就 reject），
//       症狀是「材料樹」與「所需材料」兩個區塊同時整塊消失。
//   現在：本地 msgpack 資料庫（public/data/*.msgpack，由 npm run build-data 產生），
//       完全不需網路往返；XIVAPI v2 僅作為本地資料尚未涵蓋時的備援。

import useSWR from 'swr';
import type { Item, Recipe } from '@/types';
import {
  getItem as getLocalItem,
  getItems as getLocalItems,
  searchItems as searchLocalItems,
  type GameItem,
} from '@/lib/data/items';
import { getRecipeByItemId as getLocalRecipeByItemId } from '@/lib/data/recipes';
import { getItemRow, getItemIconUrl } from '@/lib/xivapi-v2';
import { getRecipeByItemId as getRemoteRecipeByItemId } from '@/lib/recipe-datasource';

/** 把本地資料庫的 GameItem 轉成專案既有的 Item 型別 */
function toItem(game: GameItem): Item {
  return {
    id: game.id,
    name: game.name,
    name_en: game.nameEn,
    name_ja: game.nameEn,
    name_zh: game.nameTw || game.nameEn,
    icon: String(game.iconId),
    iconUrl: game.iconUrl,
    description: '',
    itemLevel: game.itemLevel,
    stackSize: game.stackSize,
    isUntradable: game.isUntradable,
    // 求解器設定彈窗依賴這個欄位決定哪些材料可以勾 HQ，缺了會讓可 HQ 材料無法選取
    canBeHQ: game.canBeHQ,
    categoryId: game.categoryId,
    categoryName: game.categoryName,
  };
}

/** 本地與線上都查不到時的降級物件（見 fetchItem 說明：絕不拋錯） */
function placeholderItem(itemId: number): Item {
  return {
    id: itemId,
    name: `物品 #${itemId}`,
    name_en: `Item #${itemId}`,
    name_ja: '',
    name_zh: '',
    icon: '',
    iconUrl: '',
    description: '',
    itemLevel: 1,
    stackSize: 1,
    isUntradable: false,
    canBeHQ: false,
    categoryId: 0,
    categoryName: '',
  };
}

// ---- 物品資料 ----
export function useItem(itemId: number | null) {
  const { data, error, isLoading } = useSWR<Item | null>(
    itemId ? ['item', itemId] : null,
    async () => (itemId ? fetchItem(itemId) : null),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return { item: data ?? null, isLoading, error };
}

// ---- 配方資料 ----
export function useRecipe(itemId: number | null) {
  const { data, error, isLoading } = useSWR<Recipe | null>(
    itemId ? ['recipe', itemId] : null,
    async () => (itemId ? fetchRecipe(itemId) : null),
    { revalidateOnFocus: false }
  );

  return { recipe: data ?? null, isLoading, error };
}

// ---- 搜尋物品 ----
export function useItemSearch(query: string, limit: number = 20) {
  // 本地索引夠快，一個字就能查，不必再區分中英文最小長度
  const shouldSearch = query.trim().length >= 1;

  const { data, error, isLoading } = useSWR<Item[]>(
    shouldSearch ? ['item-search', query, limit] : null,
    async () => searchItems(query, limit),
    { revalidateOnFocus: false, dedupingInterval: 5000, keepPreviousData: true }
  );

  return { items: data || [], isLoading, error };
}

/** 搜尋物品（中英文皆走本地索引，完全離線） */
export async function searchItems(query: string, limit: number = 20): Promise<Item[]> {
  const hits = await searchLocalItems(query, { limit });
  return hits.map(toItem);
}

// ---- 獨立的 Fetch 函式 ----

/**
 * 取得單一物品。
 *
 * 刻意不拋錯：材料樹是 Promise.all 遞歸建構的，任一節點拋錯會讓整棵樹 reject，
 * 使用者看到的是「材料清單整塊消失」—— 這正是 Cafemaker 停止服務時發生的事。
 */
export async function fetchItem(itemId: number): Promise<Item> {
  try {
    const local = await getLocalItem(itemId);
    if (local) return toItem(local);

    // 本地查不到：可能是資料檔尚未涵蓋的新版本物品，退回線上查詢
    const row = await getItemRow(itemId);
    if (row) {
      return {
        ...placeholderItem(itemId),
        name: row.name || `物品 #${itemId}`,
        name_en: row.name,
        icon: row.iconPath,
        iconUrl: getItemIconUrl(row),
        itemLevel: row.itemLevel,
        stackSize: row.stackSize,
        isUntradable: row.isUntradable,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
      };
    }
  } catch (error) {
    console.warn(`[use-xivapi] 取得物品 ${itemId} 失敗:`, error);
  }

  return placeholderItem(itemId);
}

/** 批次取得多個物品（材料清單預載用） */
export async function fetchItems(itemIds: number[]): Promise<Map<number, Item>> {
  const result = new Map<number, Item>();

  try {
    const locals = await getLocalItems(itemIds);
    for (const id of itemIds) {
      const local = locals.get(id);
      result.set(id, local ? toItem(local) : placeholderItem(id));
    }
  } catch (error) {
    console.warn('[use-xivapi] 批次取得物品失敗:', error);
    for (const id of itemIds) result.set(id, placeholderItem(id));
  }

  return result;
}

/**
 * 依成品物品 ID 取得配方。
 *
 * 本地資料庫是完整的，因此「查無此配方」是確定的答案（該物品就是採集／掉落物），
 * 必須直接回 null。若改成查無就打線上 API，材料樹裡每一個基礎材料都會產生
 * 一次網路請求 —— 那正是本地化想消除的成本。
 * 只有資料檔本身載入失敗時才退回線上查詢。
 */
export async function fetchRecipe(itemId: number): Promise<Recipe | null> {
  try {
    return await getLocalRecipeByItemId(itemId);
  } catch (error) {
    console.warn(`[use-xivapi] 本地配方資料載入失敗 (item ${itemId})，改用線上查詢:`, error);
    return getRemoteRecipeByItemId(itemId);
  }
}
