// ============================================
// 配方資料來源 - 使用 yyyy.games API
// 支援繁體中文直接搜尋配方（無需翻譯）
// ============================================

import type { Recipe, CraftJob, RecipeIngredient } from '@/types';

// API 端點 - yyyy.games 提供多語言支援包含繁中
const YYYY_GAMES_BASE = 'https://tnze.yyyy.games/api/datasource/zh-TW/';

// ---- 配方資訊類型 ----
export interface RecipeInfo {
  id: number;
  rlv: number;  // RecipeLevelTable ID
  item_id: number;
  item_name: string;
  item_amount: number;
  job: string;
  difficulty_factor: number;
  quality_factor: number;
  durability_factor: number;
  material_quality_factor: number;
  required_craftsmanship: number;
  required_control: number;
  can_hq: boolean;
}

// ---- 配方搜尋結果 ----
export interface RecipeSearchResult {
  results: RecipeInfo[];
  totalPages: number;
}

// ---- 配方等級表 ----
export interface RecipeLevel {
  id: number;
  stars: number;
  class_job_level: number;
  suggested_craftsmanship: number;
  suggested_control: number;
  difficulty: number;
  quality: number;
  durability: number;
  progress_divider: number;
  quality_divider: number;
  progress_modifier: number;
  quality_modifier: number;
  conditions_flag: number;
}

// ---- 製作職業類型 ----
export interface CraftType {
  id: number;
  name: string;
}

// ---- 搜尋配方（支援繁中直接搜尋）----
export async function searchRecipes(
  searchName: string = '',
  page: number = 1,
  craftTypeId?: number,
  jobLevelMin?: number,
  jobLevelMax?: number,
  rlv?: number
): Promise<RecipeSearchResult> {
  const query = new URLSearchParams({
    page_id: String(page - 1),
    search_name: '%' + searchName + '%',
  });

  if (rlv !== undefined) {
    query.set('rlv', String(rlv));
  }
  if (craftTypeId !== undefined) {
    query.set('craft_type_id', String(craftTypeId));
  }
  if (jobLevelMin !== undefined) {
    query.set('job_level_min', String(jobLevelMin));
  }
  if (jobLevelMax !== undefined) {
    query.set('job_level_max', String(jobLevelMax));
  }

  const url = `${YYYY_GAMES_BASE}recipe_table?${query.toString()}`;
  
  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`配方搜尋失敗: ${resp.status}`);
  }

  const { data: results, p: totalPages } = (await resp.json()) as {
    data: RecipeInfo[];
    p: number;
  };

  return { results, totalPages };
}

// ---- 取得配方詳情 ----
export async function getRecipeInfo(recipeId: number): Promise<RecipeInfo> {
  const query = new URLSearchParams({ recipe_id: String(recipeId) });
  const url = `${YYYY_GAMES_BASE}recipe_info?${query.toString()}`;

  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`取得配方失敗: ${resp.status}`);
  }

  return resp.json();
}

// ---- 取得配方等級表 ----
export async function getRecipeLevelTable(rlv: number): Promise<RecipeLevel> {
  const query = new URLSearchParams({ rlv: String(rlv) });
  const url = `${YYYY_GAMES_BASE}recipe_level_table?${query.toString()}`;

  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`取得配方等級表失敗: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    id: rlv,
    stars: 0, // API 未提供
    ...data,
  };
}

// ---- 取得配方材料 ----
export async function getRecipeIngredients(recipeId: number): Promise<Array<{ ingredient_id: number; amount: number }>> {
  const query = new URLSearchParams({ recipe_id: String(recipeId) });
  const url = `${YYYY_GAMES_BASE}recipes_ingredientions?${query.toString()}`;

  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`取得配方材料失敗: ${resp.status}`);
  }

  const ings: [number, number][] = await resp.json();
  return ings.map(x => ({ ingredient_id: x[0], amount: x[1] }));
}

// ---- 取得物品資訊 ----
export async function getItemInfo(itemId: number): Promise<{
  id: number;
  name: string;
  level: number;
  can_be_hq: boolean;
  category_id?: number;
}> {
  const query = new URLSearchParams({ item_id: String(itemId) });
  const url = `${YYYY_GAMES_BASE}item_info?${query.toString()}`;

  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`取得物品資訊失敗: ${resp.status}`);
  }

  const { id, name, level, can_be_hq, category_id } = await resp.json();
  return { id, name, level, can_be_hq: can_be_hq !== 0, category_id };
}

// ---- 取得製作職業列表 ----
export async function getCraftTypeList(): Promise<CraftType[]> {
  const url = `${YYYY_GAMES_BASE}craft_type`;

  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!resp.ok) {
    throw new Error(`取得職業列表失敗: ${resp.status}`);
  }

  return resp.json();
}

// ---- 職業名稱轉職業代碼 ----
const jobNameMap: Record<string, CraftJob> = {
  '木工': 'CRP',
  '鍛造': 'BSM',
  '甲冑': 'ARM',
  '金工': 'GSM',
  '皮革': 'LTW',
  '裁縫': 'WVR',
  '鍊金': 'ALC',
  '烹調': 'CUL',
  // 簡體中文支援
  '刻木': 'CRP',
  '锻铁': 'BSM',
  '铸甲': 'ARM',
  '雕金': 'GSM',
  '制革': 'LTW',
  '裁衣': 'WVR',
  '炼金': 'ALC',
  // 英文支援
  'Woodworking': 'CRP',
  'Smithing': 'BSM',
  'Armorcraft': 'ARM',
  'Goldsmithing': 'GSM',
  'Leatherworking': 'LTW',
  'Clothcraft': 'WVR',
  'Alchemy': 'ALC',
  'Cooking': 'CUL',
};

export function jobNameToCode(jobName: string): CraftJob {
  // 嘗試直接對應
  if (jobNameMap[jobName]) {
    return jobNameMap[jobName];
  }
  // 嘗試部分比對
  for (const [key, code] of Object.entries(jobNameMap)) {
    if (jobName.includes(key)) {
      return code;
    }
  }
  return 'CRP';  // 預設
}

// ---- 將 RecipeInfo 轉換為本專案的 Recipe 類型 ----
export async function convertToRecipe(recipeInfo: RecipeInfo): Promise<Recipe> {
  // 取得配方等級表以計算實際數值
  const levelTable = await getRecipeLevelTable(recipeInfo.rlv);
  
  // 取得材料列表
  const ingredients = await getRecipeIngredients(recipeInfo.id);
  
  // 計算實際配方值（基礎值 * 因子 / 100）
  const actualDifficulty = Math.floor((levelTable.difficulty * recipeInfo.difficulty_factor) / 100);
  const actualDurability = Math.floor((levelTable.durability * recipeInfo.durability_factor) / 100);
  const actualQuality = Math.floor((levelTable.quality * recipeInfo.quality_factor) / 100);

  const recipeIngredients: RecipeIngredient[] = ingredients
    .filter(ing => ing.ingredient_id >= 20) // 過濾水晶
    .map(ing => ({
      itemId: ing.ingredient_id,
      amount: ing.amount,
      isHQ: false,
    }));

  return {
    id: recipeInfo.id,
    itemId: recipeInfo.item_id,
    craftType: jobNameToCode(recipeInfo.job),
    craftTypeLevel: recipeInfo.item_amount,
    recipeLevel: levelTable.class_job_level,
    difficulty: actualDifficulty,
    durability: actualDurability,
    quality: actualQuality,
    requiredCraftsmanship: recipeInfo.required_craftsmanship,
    requiredControl: recipeInfo.required_control,
    ingredients: recipeIngredients,
    canQuickSynth: true,
    canHQ: recipeInfo.can_hq,
    stars: levelTable.stars,
    // RecipeLevelTable 基礎值
    baseDifficulty: levelTable.difficulty,
    baseDurability: levelTable.durability,
    baseQuality: levelTable.quality,
    recipeLevelId: recipeInfo.rlv,
    // 配方等級參數
    progressDivider: levelTable.progress_divider,
    progressModifier: levelTable.progress_modifier,
    qualityDivider: levelTable.quality_divider,
    qualityModifier: levelTable.quality_modifier,
    conditionsFlag: levelTable.conditions_flag,
  };
}

// ---- 根據物品 ID 取得配方（用於整合現有系統）----
export async function getRecipeByItemId(itemId: number): Promise<Recipe | null> {
  try {
    // 搜尋包含此物品 ID 的配方
    // 由於 API 不直接支援物品 ID 搜尋，需要先取得物品名稱
    const itemInfo = await getItemInfo(itemId);
    
    // 用物品名稱搜尋配方
    const searchResult = await searchRecipes(itemInfo.name, 1);
    
    // 找到對應的配方（物品 ID 匹配）
    const matchingRecipe = searchResult.results.find(r => r.item_id === itemId);
    
    if (!matchingRecipe) {
      return null;
    }
    
    return convertToRecipe(matchingRecipe);
  } catch (e) {
    console.error('取得配方失敗:', e);
    return null;
  }
}
