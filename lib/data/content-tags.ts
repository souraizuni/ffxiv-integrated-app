// ============================================
// 活動／內容配方標記
// ============================================
// 整份配方庫有 13,892 個配方，但玩家在跑某個活動時只關心該活動的那幾百個。
// 宇宙探索（7.2）光一個活動就有 1,584 個配方，混在全部清單裡等於找不到。
//
// 清單來自遊戲資料的專屬表格（見 scripts/build-data/build-content-tags.mjs），
// 不是用「材料是不是宇宙貨箱」推斷的 —— 那樣會漏掉不使用該材料的中間製品
// （實測宇宙探索有 280 個這種配方）。

import { loadPack } from './msgpack-loader';

const PACK = 'content-tags.msgpack';

interface RawContent {
  id: string;
  label: string;
  recipes: number[];
}

interface ContentTagsPack {
  v: number;
  generatedAt: string;
  game: { schema: string; version: string };
  contents: RawContent[];
}

export interface ContentTag {
  /** 內部識別碼，例如 'cosmic' */
  id: string;
  /** 顯示名稱，例如「宇宙探索」 */
  label: string;
  /** 該活動的配方數量 */
  recipeCount: number;
}

// recipeId 集合的索引，綁在 pack 物件上避免資料重載後殘留
const recipeSetByPack = new WeakMap<ContentTagsPack, Map<string, Set<number>>>();

function getRecipeSets(pack: ContentTagsPack): Map<string, Set<number>> {
  let index = recipeSetByPack.get(pack);

  if (!index) {
    index = new Map(pack.contents.map((c) => [c.id, new Set(c.recipes)]));
    recipeSetByPack.set(pack, index);
  }

  return index;
}

function loadContentTagsPack(): Promise<ContentTagsPack> {
  return loadPack<ContentTagsPack>(PACK);
}

/** 取得可篩選的活動清單 */
export async function getContentTags(): Promise<ContentTag[]> {
  try {
    const pack = await loadContentTagsPack();
    return pack.contents.map((c) => ({
      id: c.id,
      label: c.label,
      recipeCount: c.recipes.length,
    }));
  } catch (error) {
    // 資料檔缺失不該讓配方面板整個壞掉，只是少了篩選選項
    console.warn('[content-tags] 載入活動標記失敗:', error);
    return [];
  }
}

/** 取得某個活動的配方 id 集合 */
export async function getContentRecipeIds(contentId: string): Promise<Set<number>> {
  try {
    const pack = await loadContentTagsPack();
    return getRecipeSets(pack).get(contentId) ?? new Set();
  } catch (error) {
    console.warn(`[content-tags] 載入 ${contentId} 的配方清單失敗:`, error);
    return new Set();
  }
}

/** 判斷某個配方是否屬於指定活動 */
export async function isRecipeInContent(recipeId: number, contentId: string): Promise<boolean> {
  return (await getContentRecipeIds(contentId)).has(recipeId);
}
