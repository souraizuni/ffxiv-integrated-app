// ============================================
// 本地配方資料庫
// ============================================
// 取代先前「每個材料節點都要打 XIVAPI + yyyy.games」的做法。
// 資料由 scripts/build-data/build-recipes.mjs 產生，數值已與 yyyy.games 交叉驗證。

import { loadPack, peekPack } from './msgpack-loader';
import type { Recipe, CraftJob, RecipeIngredient } from '@/types';

const PACK = 'recipes.msgpack';

// 與 build-recipes.mjs 的旗標定義必須一致
const FLAG_CAN_HQ = 1;
const FLAG_QUICK_SYNTH = 2;
const FLAG_EXPERT = 4;
const FLAG_SPECIALIST = 8;

interface RawRecipe {
  i: number;                    // recipe id
  t: number;                    // 成品 item id
  a: number;                    // 產出數量
  j: number;                    // CraftType row id
  r: number;                    // rlv
  df: number; qf: number; uf: number; mf: number;
  rc: number; ro: number; rq: number;
  b: number;                    // 祕籍 id
  f: number;                    // 旗標
  g: Array<[number, number]>;   // [材料 id, 數量]
}

interface RawLevel {
  i: number; l: number; s: number; sc: number;
  d: number; q: number; u: number;
  pd: number; qd: number; pm: number; qm: number; c: number;
}

interface RecipesPack {
  v: number;
  generatedAt: string;
  game: { schema: string; version: string };
  recipes: RawRecipe[];
  levels: RawLevel[];
  byItem: Record<string, number[]>;
}

// CraftType row id 的順序即 XIVAPI 的 sheet 順序，已由 canary 測試鎖住
const CRAFT_JOBS: CraftJob[] = ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'];

// rlv → RawLevel 的索引。
// 用 WeakMap 綁在 pack 物件上，而不是模組層的單一變數 ——
// 後者在資料重新載入（clearPackCache）後會殘留舊索引，
// 症狀是配方數值悄悄套用到舊的等級表，不會有任何錯誤訊息。
const levelIndexByPack = new WeakMap<RecipesPack, Map<number, RawLevel>>();

function getLevelIndex(pack: RecipesPack): Map<number, RawLevel> {
  let index = levelIndexByPack.get(pack);
  if (!index) {
    index = new Map(pack.levels.map((level) => [level.i, level]));
    levelIndexByPack.set(pack, index);
  }
  return index;
}

export function loadRecipesPack(): Promise<RecipesPack> {
  return loadPack<RecipesPack>(PACK);
}

/**
 * 把壓縮紀錄還原成專案的 Recipe 型別。
 * 計算方式與原本 lib/recipe-datasource.ts 的 convertToRecipe 完全相同
 * （基礎值 × 因子 / 100，向下取整），確保模擬器結果不變。
 */
function toRecipe(raw: RawRecipe, level: RawLevel | undefined): Recipe {
  const baseDifficulty = level?.d ?? 0;
  const baseQuality = level?.q ?? 0;
  const baseDurability = level?.u ?? 0;

  const ingredients: RecipeIngredient[] = raw.g
    .filter(([itemId]) => itemId >= 20) // 過濾水晶，與既有行為一致
    .map(([itemId, amount]) => ({ itemId, amount, isHQ: false }));

  return {
    id: raw.i,
    itemId: raw.t,
    craftType: CRAFT_JOBS[raw.j] ?? 'CRP',
    craftTypeLevel: raw.a,
    recipeLevel: level?.l ?? 1,
    difficulty: Math.floor((baseDifficulty * raw.df) / 100),
    durability: Math.floor((baseDurability * raw.uf) / 100),
    quality: Math.floor((baseQuality * raw.qf) / 100),
    requiredCraftsmanship: raw.rc,
    requiredControl: raw.ro,
    ingredients,
    canQuickSynth: (raw.f & FLAG_QUICK_SYNTH) !== 0,
    canHQ: (raw.f & FLAG_CAN_HQ) !== 0,
    stars: level?.s ?? 0,
    amountResult: raw.a,
    materialQualityFactor: raw.mf,
    baseDifficulty,
    baseQuality,
    baseDurability,
    recipeLevelId: raw.r,
    progressDivider: level?.pd ?? 100,
    progressModifier: level?.pm ?? 100,
    qualityDivider: level?.qd ?? 100,
    qualityModifier: level?.qm ?? 100,
    conditionsFlag: level?.c ?? 15,
  };
}

/** 依成品物品 ID 取得配方；有多個配方時取 recipe id 最小者 */
export async function getRecipeByItemId(itemId: number): Promise<Recipe | null> {
  const pack = await loadRecipesPack();
  const indices = pack.byItem[String(itemId)];
  if (!indices || indices.length === 0) return null;

  const levels = getLevelIndex(pack);
  const raw = indices
    .map((index) => pack.recipes[index])
    .filter(Boolean)
    .sort((a, b) => a.i - b.i)[0];

  return raw ? toRecipe(raw, levels.get(raw.r)) : null;
}

/** 依成品物品 ID 取得所有配方（同一物品可能有多個職業的配方） */
export async function getRecipesByItemId(itemId: number): Promise<Recipe[]> {
  const pack = await loadRecipesPack();
  const indices = pack.byItem[String(itemId)] || [];
  const levels = getLevelIndex(pack);

  return indices
    .map((index) => pack.recipes[index])
    .filter(Boolean)
    .sort((a, b) => a.i - b.i)
    .map((raw) => toRecipe(raw, levels.get(raw.r)));
}

/** 依配方 ID 取得配方 */
export async function getRecipeById(recipeId: number): Promise<Recipe | null> {
  const pack = await loadRecipesPack();
  const raw = pack.recipes.find((recipe) => recipe.i === recipeId);
  if (!raw) return null;

  return toRecipe(raw, getLevelIndex(pack).get(raw.r));
}

/** 該物品是否可製作（材料樹遞歸的判斷依據，同步版本） */
export function peekHasRecipe(itemId: number): boolean | null {
  const pack = peekPack<RecipesPack>(PACK);
  if (!pack) return null;
  return Boolean(pack.byItem[String(itemId)]?.length);
}

export interface RecipeSearchFilters {
  /** 職業代碼，未指定則不限 */
  job?: CraftJob;
  levelMin?: number;
  levelMax?: number;
  limit?: number;
}

/** 取得配方列表（生產指引的左側面板用） */
export async function listRecipes(filters: RecipeSearchFilters = {}): Promise<Recipe[]> {
  const { job, levelMin, levelMax, limit = 200 } = filters;

  const pack = await loadRecipesPack();
  const levels = getLevelIndex(pack);
  const jobIndex = job ? CRAFT_JOBS.indexOf(job) : -1;

  const results: Recipe[] = [];

  for (const raw of pack.recipes) {
    if (jobIndex >= 0 && raw.j !== jobIndex) continue;

    const level = levels.get(raw.r);
    const classLevel = level?.l ?? 0;
    if (levelMin !== undefined && classLevel < levelMin) continue;
    if (levelMax !== undefined && classLevel > levelMax) continue;

    results.push(toRecipe(raw, level));
    if (results.length >= limit) break;
  }

  return results;
}

/** 資料檔統計，用於健康檢查與版本標示 */
export async function getRecipeDataStats(): Promise<{
  generatedAt: string;
  version: string;
  recipeCount: number;
  craftableItemCount: number;
}> {
  const pack = await loadRecipesPack();
  return {
    generatedAt: pack.generatedAt,
    version: pack.game?.version || 'unknown',
    recipeCount: pack.recipes.length,
    craftableItemCount: Object.keys(pack.byItem).length,
  };
}

// ---- 配方面板用的搜尋 ----
// 回傳與 lib/recipe-datasource.ts 的 searchRecipes 相同的形狀（RecipeInfo），
// 讓配方面板可以直接換掉資料來源而不必改型別契約。
// 換成本地之後才有辦法依「活動」篩選 —— 那需要用配方 id 集合過濾，
// 而 yyyy.games 的搜尋 API 不支援。

import type { RecipeInfo } from '@/lib/recipe-datasource';
import { getItem } from './items';
import { getContentRecipeIds } from './content-tags';

const CRAFT_JOB_NAMES = ['木工', '鍛造', '甲冑', '金工', '皮革', '裁縫', '鍊金', '烹調'];

export interface RecipeSearchOptions {
  /** 名稱關鍵字（比對成品的繁中／英文名稱） */
  keyword?: string;
  /** CraftType row id（0=木工 … 7=烹調） */
  craftTypeId?: number;
  levelMin?: number;
  levelMax?: number;
  /** 活動識別碼，例如 'cosmic'（宇宙探索） */
  contentId?: string;
  page?: number;
  pageSize?: number;
}

export interface RecipeSearchPage {
  results: RecipeInfo[];
  totalPages: number;
  totalCount: number;
}

/** 依成品 id 取得顯示用名稱（優先繁中） */
async function resolveItemName(itemId: number): Promise<string> {
  const item = await getItem(itemId);
  return item?.name || `物品 #${itemId}`;
}

function toRecipeInfo(raw: RawRecipe, level: RawLevel | undefined, itemName: string): RecipeInfo {
  return {
    id: raw.i,
    rlv: raw.r,
    item_id: raw.t,
    item_name: itemName,
    item_amount: raw.a,
    job: CRAFT_JOB_NAMES[raw.j] ?? '木工',
    difficulty_factor: raw.df,
    quality_factor: raw.qf,
    durability_factor: raw.uf,
    material_quality_factor: raw.mf,
    required_craftsmanship: raw.rc,
    required_control: raw.ro,
    can_hq: (raw.f & FLAG_CAN_HQ) !== 0,
  };
}

/**
 * 搜尋配方（全部走本地資料庫，無網路往返）。
 */
export async function searchRecipeInfos(
  options: RecipeSearchOptions = {}
): Promise<RecipeSearchPage> {
  const {
    keyword = '',
    craftTypeId,
    levelMin,
    levelMax,
    contentId,
    page = 1,
    pageSize = 50,
  } = options;

  const pack = await loadRecipesPack();
  const levels = getLevelIndex(pack);

  // 活動篩選：配方 id 集合來自遊戲資料的專屬表格
  const contentIds = contentId ? await getContentRecipeIds(contentId) : null;

  const matched: RawRecipe[] = [];

  for (const raw of pack.recipes) {
    if (contentIds && !contentIds.has(raw.i)) continue;
    if (craftTypeId !== undefined && raw.j !== craftTypeId) continue;

    const level = levels.get(raw.r);
    const classLevel = level?.l ?? 0;
    if (levelMin !== undefined && classLevel < levelMin) continue;
    if (levelMax !== undefined && classLevel > levelMax) continue;

    matched.push(raw);
  }

  // 名稱比對需要查物品庫，放在數量收斂之後才做
  let filtered = matched;

  if (keyword.trim()) {
    const terms = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const withNames = await Promise.all(
      matched.map(async (raw) => ({ raw, name: await resolveItemName(raw.t) }))
    );

    filtered = withNames
      .filter(({ raw, name }) => {
        const haystack = `${name}`.toLowerCase();
        return terms.every((t) => haystack.includes(t)) || String(raw.i) === keyword.trim();
      })
      .map(({ raw }) => raw);
  }

  // 等級由低到高，同級以配方 id 排序，結果穩定
  filtered.sort((a, b) => {
    const la = levels.get(a.r)?.l ?? 0;
    const lb = levels.get(b.r)?.l ?? 0;
    return la - lb || a.i - b.i;
  });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = (Math.max(1, page) - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const results = await Promise.all(
    slice.map(async (raw) => toRecipeInfo(raw, levels.get(raw.r), await resolveItemName(raw.t)))
  );

  return { results, totalPages, totalCount };
}

/**
 * 製作職業清單。
 * 順序即 XIVAPI 的 CraftType sheet 順序，已由 upstream-canary 測試鎖住。
 * 提供本地版本是為了讓配方面板在上游服務失效時仍可運作 ——
 * 這份清單是固定的遊戲資料，沒有理由每次都上網拿。
 */
export function getCraftTypesLocal(): Array<{ id: number; name: string }> {
  return CRAFT_JOB_NAMES.map((name, id) => ({ id, name }));
}
